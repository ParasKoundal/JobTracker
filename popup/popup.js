/**
 * Popup script for tracking jobs
 */

import { StorageService } from '../utils/storage.js';
import { canonicalizeURL, generateJobKey, detectSource } from '../utils/urlCanonicalizer.js';
import { formatRelativeTime } from '../utils/dateFormatter.js';
import { capitalizeStatus } from '../utils/helpers.js';

let currentTab = null;
let existingJob = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Get current tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        currentTab = tab;

        // Check if this job is already tracked
        existingJob = await StorageService.findJobByURL(tab.url);

        if (existingJob) {
            showExistingJobStatus(existingJob);
            populateForm(existingJob);
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
}

/**
 * Auto-fill job details from page
 */
async function autoFillJobDetails() {
    try {
        // Try to extract job details from page title and URL
        const source = detectSource(currentTab.url);

        // Basic extraction from page title
        const title = currentTab.title || '';

        // Common patterns in job posting titles
        // "Software Engineer - Google - LinkedIn"
        // "Product Manager | Apple | San Francisco"

        let company = '';
        let jobTitle = '';

        // Try to parse title
        const parts = title.split(/[-|•]/);
        if (parts.length >= 2) {
            jobTitle = parts[0].trim();
            company = parts[1].trim();
        }

        // Update form if we found something
        if (company) {
            document.getElementById('company').value = company;
        }
        if (jobTitle) {
            document.getElementById('title').value = jobTitle;
        }
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
            tags: []
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

        // Show success message
        showSuccessMessage();

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
 * Open dashboard
 */
function openDashboard() {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/dashboard.html') });
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
