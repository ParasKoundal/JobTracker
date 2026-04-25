/**
 * Dashboard script for managing tracked jobs
 */

import { StorageService } from '../utils/storage.js';
import { formatDate, formatRelativeTime } from '../utils/dateFormatter.js';
import { jobsToCSV, downloadCSV } from '../utils/csvExporter.js';
import { capitalizeStatus, escapeHtml } from '../utils/helpers.js';

let allJobs = [];
let filteredJobs = [];

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    await StorageService.migratePageStorage();
    await loadTheme();
    await loadJobs();
    setupEventListeners();
});

/**
 * Load all jobs from storage
 */
async function loadJobs() {
    try {
        allJobs = await StorageService.getAllJobsArray();
        applyFiltersAndSort();
        updateStats();
    } catch (error) {
        console.error('Error loading jobs:', error);
    }
}

/**
 * Apply filters and sorting
 */
function applyFiltersAndSort() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    const sortBy = document.getElementById('sortBy').value;

    // Filter
    filteredJobs = allJobs.filter(job => {
        const matchesSearch =
            (job.company || '').toLowerCase().includes(searchTerm) ||
            (job.title || '').toLowerCase().includes(searchTerm) ||
            (job.location || '').toLowerCase().includes(searchTerm);

        const matchesStatus = statusFilter === 'all' || job.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    // Sort
    filteredJobs.sort((a, b) => {
        switch (sortBy) {
            case 'updated_desc':
                return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
            case 'created_desc':
                return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            case 'applied_desc':
                const aDate = a.applied_at ? new Date(a.applied_at) : new Date(0);
                const bDate = b.applied_at ? new Date(b.applied_at) : new Date(0);
                return bDate - aDate;
            case 'company_asc':
                return (a.company || '').localeCompare(b.company || '');
            case 'title_asc':
                return (a.title || '').localeCompare(b.title || '');
            default:
                return 0;
        }
    });

    renderTable();
}

/**
 * Render jobs table
 */
async function renderTable() {
    const tbody = document.getElementById('jobsTableBody');
    const emptyState = document.getElementById('emptyState');
    const noResults = document.getElementById('noResults');
    const table = document.getElementById('jobsTable');

    // Clear table
    tbody.innerHTML = '';

    if (allJobs.length === 0) {
        table.style.display = 'none';
        emptyState.style.display = 'flex';
        noResults.style.display = 'none';
        return;
    }

    if (filteredJobs.length === 0) {
        table.style.display = 'none';
        emptyState.style.display = 'none';
        noResults.style.display = 'flex';
        return;
    }

    table.style.display = 'table';
    emptyState.style.display = 'none';
    noResults.style.display = 'none';

    // Check which jobs have saved pages
    const savedPages = await StorageService.getAllPageHTML();

    // Render rows
    filteredJobs.forEach(job => {
        const hasSavedPage = !!savedPages[job.job_key];
        const row = document.createElement('tr');
        row.innerHTML = `
      <td>
        <div class="company-cell">
          <strong>${escapeHtml(job.company)}</strong>
        </div>
      </td>
      <td>
        <div class="title-cell">
          ${escapeHtml(job.title)}
          ${job.location ? `<div class="location">${escapeHtml(job.location)}</div>` : ''}
        </div>
      </td>
      <td>
        <span class="status-badge status-${job.status}">
          ${capitalizeStatus(job.status)}
        </span>
      </td>
      <td>
        <div class="date-cell">
          ${job.applied_at ? formatDate(job.applied_at) : '—'}
        </div>
      </td>
      <td>
        <div class="date-cell">
          ${job.last_seen_at ? formatRelativeTime(job.last_seen_at) : '—'}
        </div>
      </td>
      <td>
        <span class="source-badge">${escapeHtml(job.source)}</span>
      </td>
      <td>
        <div class="action-buttons">
          <button class="action-btn open-job-btn" data-job-key="${job.job_key}" title="Open job">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 3H3V13H13V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M9 3H13V7M13 3L7 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          ${hasSavedPage ? `
          <button class="action-btn view-page-btn" data-job-key="${job.job_key}" title="View saved page">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 2H10L13 5V14H3V2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
              <path d="M10 2V5H13" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
              <path d="M5 8H11M5 11H9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
          ` : ''}
          <button class="action-btn edit-job-btn" data-job-key="${job.job_key}" title="Edit job">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M11 2L14 5L6 13H3V10L11 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="action-btn delete-btn delete-job-btn" data-job-key="${job.job_key}" title="Delete job">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 4H13M5 4V3H11V4M6 7V11M10 7V11M5 4L5.5 12H10.5L11 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </td>
    `;
        tbody.appendChild(row);

        // Add event listeners to action buttons
        const rowElement = tbody.lastElementChild;
        rowElement.querySelector('.open-job-btn').addEventListener('click', () => openJob(job.job_key));
        if (hasSavedPage) {
            rowElement.querySelector('.view-page-btn').addEventListener('click', () => viewSavedPage(job.job_key));
        }
        rowElement.querySelector('.edit-job-btn').addEventListener('click', () => editJob(job.job_key));
        rowElement.querySelector('.delete-job-btn').addEventListener('click', () => deleteJob(job.job_key));
    });
}

/**
 * Update stats
 */
function updateStats() {
    document.getElementById('totalJobs').textContent = allJobs.length;
    document.getElementById('appliedJobs').textContent =
        allJobs.filter(j => j.status === 'applied').length;
    document.getElementById('interviewingJobs').textContent =
        allJobs.filter(j => j.status === 'interviewing').length;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const sortBy = document.getElementById('sortBy');
    const exportBtn = document.getElementById('exportBtn');
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    const importJsonBtn = document.getElementById('importJsonBtn');
    const importFileInput = document.getElementById('importFileInput');
    const editForm = document.getElementById('editForm');
    const closeModal = document.getElementById('closeModal');
    const cancelEdit = document.getElementById('cancelEdit');
    const toggleThemeBtn = document.getElementById('toggleTheme');

    searchInput.addEventListener('input', applyFiltersAndSort);
    statusFilter.addEventListener('change', applyFiltersAndSort);
    sortBy.addEventListener('change', applyFiltersAndSort);
    exportBtn.addEventListener('click', handleExport);
    exportJsonBtn.addEventListener('click', handleJsonExport);
    importJsonBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', handleJsonImport);
    editForm.addEventListener('submit', handleEditSubmit);
    closeModal.addEventListener('click', closeEditModal);
    cancelEdit.addEventListener('click', closeEditModal);
    toggleThemeBtn.addEventListener('click', toggleTheme);

    // Close modal on background click
    document.getElementById('editModal').addEventListener('click', (e) => {
        if (e.target.id === 'editModal') {
            closeEditModal();
        }
    });
}

/**
 * Handle CSV export
 */
function handleExport() {
    const csv = jobsToCSV(filteredJobs);
    const timestamp = new Date().toISOString().split('T')[0];
    downloadCSV(csv, `job-tracker-export-${timestamp}.csv`);
}

/**
 * Handle JSON export (includes saved pages)
 */
async function handleJsonExport() {
    const jobs = await StorageService.getAllJobs();
    const pages = await StorageService.getAllPageHTML();
    const exportData = { version: 1, jobs, pages };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `job-tracker-export-${timestamp}.json`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Handle JSON import (backward compatible with old exports without pages)
 */
async function handleJsonImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const data = JSON.parse(text);

        let jobsToImport = {};
        let pagesToImport = {};

        // Support both formats:
        // 1. New format: { version, jobs, pages }
        // 2. Old format: plain object of jobs keyed by job_key (backward compat)
        if (data.version && data.jobs) {
            jobsToImport = data.jobs;
            pagesToImport = data.pages || {};
        } else {
            // Old format - treat entire object as jobs
            jobsToImport = data;
        }

        // Validate that we have actual job data
        const jobKeys = Object.keys(jobsToImport);
        if (jobKeys.length === 0) {
            alert('No jobs found in the imported file.');
            e.target.value = '';
            return;
        }

        // Check first entry looks like a job
        const firstJob = jobsToImport[jobKeys[0]];
        if (!firstJob.job_key && !firstJob.company) {
            alert('Invalid file format. Expected Job Tracker export data.');
            e.target.value = '';
            return;
        }

        const existingJobs = await StorageService.getAllJobs();
        const existingCount = Object.keys(existingJobs).length;
        let newCount = 0;
        let updatedCount = 0;

        // Merge: new entries are added, existing entries are skipped
        for (const [key, job] of Object.entries(jobsToImport)) {
            if (!existingJobs[key]) {
                existingJobs[key] = job;
                newCount++;
            } else {
                updatedCount++;
            }
        }

        await chrome.storage.local.set({ job_tracker_jobs: existingJobs });

        // Import saved pages (per-job keys)
        if (Object.keys(pagesToImport).length > 0) {
            for (const [key, html] of Object.entries(pagesToImport)) {
                const existing = await StorageService.getPageHTML(key);
                if (!existing) {
                    await StorageService.savePageHTML(key, html);
                }
            }
        }

        alert(`Import complete: ${newCount} new jobs added, ${updatedCount} already existed (skipped).`);
        await loadJobs();
    } catch (error) {
        console.error('Error importing JSON:', error);
        alert('Error importing file. Please check the file format.');
    }

    // Reset file input
    e.target.value = '';
}

/**
 * Dashboard actions
 */
async function openJob(jobKey) {
    const job = await StorageService.getJob(jobKey);
    if (job && job.original_url) {
        chrome.tabs.create({ url: job.original_url });
    }
}

async function viewSavedPage(jobKey) {
    const html = await StorageService.getPageHTML(jobKey);
    if (html) {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        chrome.tabs.create({ url });
    }
}

async function editJob(jobKey) {
    const job = await StorageService.getJob(jobKey);
    if (job) {
        showEditModal(job);
    }
}

async function deleteJob(jobKey) {
    if (confirm('Are you sure you want to delete this job?')) {
        await StorageService.deleteJob(jobKey);
        await loadJobs();
    }
}

/**
 * Show edit modal
 */
function showEditModal(job) {
    document.getElementById('editJobKey').value = job.job_key;
    document.getElementById('editCompany').value = job.company || '';
    document.getElementById('editTitle').value = job.title || '';
    document.getElementById('editLocation').value = job.location || '';
    document.getElementById('editStatus').value = job.status || 'applied';
    document.getElementById('editNotes').value = job.notes || '';

    document.getElementById('editModal').style.display = 'flex';
}

/**
 * Close edit modal
 */
function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

/**
 * Handle edit form submission
 */
async function handleEditSubmit(e) {
    e.preventDefault();

    try {
        const jobKey = document.getElementById('editJobKey').value;
        const job = await StorageService.getJob(jobKey);

        if (!job) {
            alert('Job not found');
            return;
        }

        const updates = {
            company: document.getElementById('editCompany').value.trim(),
            title: document.getElementById('editTitle').value.trim(),
            location: document.getElementById('editLocation').value.trim(),
            status: document.getElementById('editStatus').value,
            notes: document.getElementById('editNotes').value.trim()
        };

        // Update applied_at if status changed to 'applied'
        if (updates.status === 'applied' && job.status !== 'applied' && !job.applied_at) {
            updates.applied_at = new Date().toISOString();
        }

        await StorageService.saveJob({ ...job, ...updates });

        closeEditModal();
        await loadJobs();
    } catch (error) {
        console.error('Error updating job:', error);
        alert('Error updating job. Please try again.');
    }
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
 * Apply theme to dashboard
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

