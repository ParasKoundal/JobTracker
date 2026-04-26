/**
 * Popup script for tracking jobs
 */

import { StorageService } from '../utils/storage.js';
import { canonicalizeURL, generateJobKey, detectSource } from '../utils/urlCanonicalizer.js';
import { formatRelativeTime } from '../utils/dateFormatter.js';
import { capitalizeStatus } from '../utils/helpers.js';

let currentTab = null;
let existingJob = null;
let capturedPageHTML = null; // Pre-captured on popup open while activeTab is fresh

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Migrate old page storage format (one-time, idempotent)
        await StorageService.migratePageStorage();

        // Get current tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        currentTab = tab;

        // Pre-capture page HTML immediately while activeTab permission is fresh
        capturedPageHTML = await capturePageHTML(tab.id);

        // Check if this job is already tracked
        existingJob = await StorageService.findJobByURL(tab.url);

        if (existingJob) {
            showExistingJobStatus(existingJob);
            populateForm(existingJob);
            await checkSavedPage(existingJob);
        } else {
            // Try to auto-detect job details from page
            await autoFillJobDetails();
        }

        // Set up event listeners
        setupEventListeners();
    } catch (error) {
        console.error('Error initializing popup:', error);
    }
});

/**
 * Pre-capture page HTML using multiple methods
 */
async function capturePageHTML(tabId) {
    // Attempt 1: chrome.scripting.executeScript (needs activeTab, freshest right after popup opens)
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => document.documentElement.outerHTML
        });
        if (results && results[0] && results[0].result) {
            return results[0].result;
        }
    } catch (err) {
        console.warn('Job Tracker: scripting.executeScript failed:', err.message);
    }

    // Attempt 2: fallback via content script message
    try {
        const response = await chrome.tabs.sendMessage(tabId, { action: 'capturePageHTML' });
        if (response && response.html) {
            return response.html;
        }
    } catch (err2) {
        console.warn('Job Tracker: content script fallback failed:', err2.message);
    }

    return null;
}

/**
 * Show existing job status
 */
function showExistingJobStatus(job) {
    const statusSection = document.getElementById('currentJobStatus');
    const statusBadge = document.getElementById('statusBadge');
    const statusDate = document.getElementById('statusDate');
    const saveBtnText = document.getElementById('saveBtnText');

    statusSection.style.display = 'flex';
    statusBadge.textContent = capitalizeStatus(job.status);
    statusBadge.className = `status-badge status-${job.status}`;

    const dateText = job.applied_at
        ? `Applied ${formatRelativeTime(job.applied_at)}`
        : `Tracked ${formatRelativeTime(job.created_at)}`;
    statusDate.textContent = dateText;

    saveBtnText.textContent = 'Update Job';
}

/**
 * Populate form with job data
 */
function populateForm(job) {
    document.getElementById('company').value = job.company || '';
    document.getElementById('title').value = job.title || '';
    document.getElementById('location').value = job.location || '';
    document.getElementById('status').value = job.status || 'applied';
    document.getElementById('notes').value = job.notes || '';
    document.getElementById('tags').value = (job.tags || []).join(', ');
}

/**
 * Check if a saved page exists for this job and show the button
 */
async function checkSavedPage(job) {
    const hasSavedPage = await StorageService.hasPageHTML(job.job_key);
    if (hasSavedPage) {
        const btn = document.getElementById('viewSavedPageBtn');
        btn.style.display = 'flex';
        btn.addEventListener('click', () => viewSavedPage(job.job_key));
    }
}

/**
 * Open saved page HTML in a new tab
 */
async function viewSavedPage(jobKey) {
    const html = await StorageService.getPageHTML(jobKey);
    if (html) {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        chrome.tabs.create({ url });
    }
}

/**
 * Auto-fill job details from page
 */
async function autoFillJobDetails() {
    try {
        let company = '';
        let jobTitle = '';

        // Extract base domain to serve as extreme fallback company name (e.g. tower-research.com -> Tower-research)
        let domainCompany = '';
        try {
            const host = new URL(currentTab.url).hostname.replace('www.', '');
            domainCompany = host.split('.')[0];
            domainCompany = domainCompany.charAt(0).toUpperCase() + domainCompany.slice(1);
        } catch(e) {}

        // Inject script to pull strictly normalized job classes (Greenhouse/Lever/Workday) or standard H1 across ALL frames
        const results = await chrome.scripting.executeScript({
            target: { tabId: currentTab.id, allFrames: true },
            func: () => {
                const titleNode = document.querySelector('h1, .app-title, .posting-headline h2');
                const ogTitle = document.querySelector('meta[property="og:title"]');
                const ogSiteName = document.querySelector('meta[property="og:site_name"]');
                return {
                    exactTitle: titleNode ? titleNode.innerText.trim() : '',
                    ogTitle: ogTitle ? ogTitle.content : '',
                    ogSiteName: ogSiteName ? ogSiteName.content : '',
                    pageTitle: document.title || ''
                };
            }
        });

        if (results && results.length > 0) {
            // Find the active frame containing the real HTML title (solves iframe embedding like Greenhouse)
            let bestFrame = results[0].result;
            for (const r of results) {
                 if (r.result && r.result.exactTitle && r.result.exactTitle.length > 2) {
                     bestFrame = r.result;
                     break;
                 }
            }
            
            const { exactTitle, ogTitle, ogSiteName, pageTitle } = bestFrame || results[0].result;
            
            // Override domainCompany completely if the site natively broadcasts its organization's name!
            if (ogSiteName && ogSiteName.length < 50) {
                 domainCompany = ogSiteName;
            }
            
            // Heavily prioritize Semantic HTML and explicit Open-Graph tags over raw page title splits
            const bestTargetTitle = (exactTitle && exactTitle.length > 2 && exactTitle.length < 100) 
                 ? exactTitle 
                 : (ogTitle || pageTitle);
            
            const parts = bestTargetTitle.split(/[-|•|:]/).map(p => p.trim()).filter(Boolean);
            
            if (parts.length >= 2) {
                jobTitle = parts[0];
                company = parts[1];
                
                // If split produced a generic path slug like 'positions', 'careers', revert to the Domain
                if (company.toLowerCase().includes('position') || company.toLowerCase().includes('career')) {
                    company = domainCompany;
                }
            } else if (parts.length === 1) {
                jobTitle = parts[0];
                company = domainCompany;
            }
        }
        
        // Final sanity checks on weird empty splits
        if (!company || company.toLowerCase() === 'open') company = domainCompany;
        if (jobTitle.toLowerCase() === 'open' || jobTitle.toLowerCase() === 'open positions') jobTitle = '';

        // Update form if we successfully found data
        if (company) document.getElementById('company').value = company;
        if (jobTitle) document.getElementById('title').value = jobTitle;
        
    } catch (error) {
        console.error('Error auto-filling details:', error);
    }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    const form = document.getElementById('trackJobForm');
    const openDashboardBtn = document.getElementById('openDashboard');
    const updateStatusBtn = document.getElementById('updateStatusBtn');
    const toggleThemeBtn = document.getElementById('toggleTheme');

    form.addEventListener('submit', handleFormSubmit);
    openDashboardBtn.addEventListener('click', openDashboard);
    toggleThemeBtn.addEventListener('click', toggleTheme);

    if (updateStatusBtn) {
        updateStatusBtn.addEventListener('click', () => {
            // Scroll to status selector
            document.getElementById('status').focus();
        });
    }

    // Load saved theme
    loadTheme();

    // Load settings
    loadSettings();
}

/**
 * Handle form submission
 */
async function handleFormSubmit(e) {
    e.preventDefault();

    try {
        const formData = new FormData(e.target);
        const company = formData.get('company').trim();
        const title = formData.get('title').trim();
        const location = formData.get('location').trim();
        const status = formData.get('status');
        const notes = formData.get('notes').trim();
        const tagsInput = formData.get('tags').trim();
        const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];

        if (!company || !title) {
            alert('Company and Title are required');
            return;
        }

        // Generate job key
        const jobKey = await generateJobKey(currentTab.url, { title, company });
        const canonicalUrl = canonicalizeURL(currentTab.url);
        const source = detectSource(currentTab.url);

        // Prepare job data
        const jobData = {
            job_key: jobKey,
            canonical_url: canonicalUrl,
            original_url: currentTab.url,
            source,
            company,
            title,
            location,
            status,
            notes,
            tags
        };

        // Set applied_at if status is 'applied' and it's a new job
        if (status === 'applied' && !existingJob) {
            jobData.applied_at = new Date().toISOString();
        } else if (existingJob && existingJob.applied_at) {
            jobData.applied_at = existingJob.applied_at;
        }

        // If status changed to 'applied', update applied_at
        if (status === 'applied' && existingJob && existingJob.status !== 'applied') {
            jobData.applied_at = new Date().toISOString();
        }

        // Save job
        await StorageService.saveJob(jobData);

        // Save pre-captured page HTML if toggle is on
        const savePageToggle = document.getElementById('savePageToggle');
        let pageSaveWarning = null;
        if (savePageToggle.checked) {
            if (capturedPageHTML) {
                try {
                    await StorageService.savePageHTML(jobKey, capturedPageHTML);
                } catch (err) {
                    console.warn('Job Tracker: storage write failed:', err.message);
                    pageSaveWarning = err?.message?.includes('QUOTA') ? 'Storage full — page not saved.' : 'Could not save page.';
                }
            } else {
                pageSaveWarning = 'Could not capture page — this page may be restricted.';
            }
        }

        // Persist the save page & reminders preference
        const settings = await StorageService.getSettings();
        const remindersToggle = document.getElementById('remindersToggle');
        const syncToggle = document.getElementById('syncToggle');
        
        await StorageService.saveSettings({
            ...settings,
            save_page_html: savePageToggle ? savePageToggle.checked : true,
            reminders_enabled: remindersToggle ? remindersToggle.checked : true,
            sync_enabled: syncToggle ? syncToggle.checked : true
        });

        // Trigger alarm check in service worker if toggled
        if (remindersToggle && remindersToggle.checked) {
            chrome.runtime.sendMessage({ action: 'checkAlarms' }).catch(() => {});
        }
        
        // Push initial sync if enabled
        if (syncToggle && syncToggle.checked) {
            StorageService.pushToSync().catch(e => console.warn('Initial sync failed:', e));
        }

        // Show success message
        showSuccessMessage();

        // Show page save warning if applicable (after success is visible)
        if (pageSaveWarning) {
            showSaveWarning(pageSaveWarning);
        }

        // Notify background script about status update
        chrome.runtime.sendMessage({
            action: 'jobStatusUpdated',
            status: status
        });

        // Notify content script to update UI
        chrome.tabs.sendMessage(currentTab.id, { action: 'jobUpdated' }).catch(() => {
            // Ignore errors if content script not loaded
        });

        // Close popup after a short delay
        setTimeout(() => {
            window.close();
        }, 1000);
    } catch (error) {
        console.error('Error saving job:', error);
        alert('Error saving job. Please try again.');
    }
}

/**
 * Show success message
 */
function showSuccessMessage() {
    const form = document.getElementById('trackJobForm');
    const successMsg = document.getElementById('successMessage');

    form.style.display = 'none';
    successMsg.style.display = 'block';
}

/**
 * Show a brief warning about page save failure (non-blocking)
 */
function showSaveWarning(text) {
    const successMsg = document.getElementById('successMessage');
    if (successMsg) {
        const warning = document.createElement('div');
        warning.textContent = '⚠️ ' + text;
        warning.style.cssText = 'color:#f59e0b;font-size:12px;margin-top:8px;';
        successMsg.appendChild(warning);
    }
}

/**
 * Open dashboard
 */
function openDashboard() {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/dashboard.html') });
}


/**
 * Load save page & reminders setting
 */
async function loadSettings() {
    const settings = await StorageService.getSettings();
    const savePage = settings?.save_page_html !== false; // default true
    const reminders = settings?.reminders_enabled === true; // default false
    const syncEnabled = settings?.sync_enabled !== false; // default true
    
    document.getElementById('savePageToggle').checked = savePage;
    document.getElementById('remindersToggle').checked = reminders;
    document.getElementById('syncToggle').checked = syncEnabled;
}

/**
 * Load current theme
 */
async function loadTheme() {
    const settings = await StorageService.getSettings();
    const theme = settings?.theme || 'light';
    applyTheme(theme);
}

/**
 * Toggle between light and dark theme
 */
async function toggleTheme() {
    const settings = await StorageService.getSettings();
    const currentTheme = settings?.theme || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    await StorageService.saveSettings({ ...settings, theme: newTheme });
    applyTheme(newTheme);

    // Notify content scripts to update
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
                action: 'themeChanged',
                theme: newTheme
            }).catch(() => {
                // Ignore errors for tabs without content script
            });
        });
    });
}

/**
 * Apply theme to popup
 */
function applyTheme(theme) {
    document.body.dataset.theme = theme;

    // Update theme icon
    const themeIcon = document.getElementById('themeIcon');
    if (theme === 'dark') {
        // Moon icon for dark mode
        themeIcon.innerHTML = `
            <path d="M17 13.5C13 13.5 9.5 10 9.5 6C9.5 4.5 10 3 11 2C6.5 2.5 3 6.3 3 11C3 15.9 7.1 20 12 20C16.7 20 20.5 16.5 21 12C20 13 18.5 13.5 17 13.5Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
        `;
    } else {
        // Sun icon for light mode
        themeIcon.innerHTML = `
            <circle cx="10" cy="10" r="4" stroke="currentColor" stroke-width="1.5"/>
            <path d="M10 2v2M10 16v2M18 10h-2M4 10H2M15.5 4.5l-1.4 1.4M5.9 14.1l-1.4 1.4M15.5 15.5l-1.4-1.4M5.9 5.9L4.5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        `;
    }
}
