/**
 * Content script for detecting job pages and showing revisit banners
 */

import { StorageService } from '../utils/storage.js';
import { canonicalizeURL } from '../utils/urlCanonicalizer.js';
import { formatDate, formatRelativeTime } from '../utils/dateFormatter.js';
import { DEFAULT_STATUS_COLORS, isLightColor, lightenColor } from '../utils/helpers.js';

// Initialize on page load
(async function init() {
    try {
        // Check if current page matches a tracked job
        const currentUrl = window.location.href;
        const job = await StorageService.findJobByURL(currentUrl);

        if (job) {
            // Update last seen timestamp
            await StorageService.updateLastSeen(job.job_key);

            // Show minimal corner marker
            showCornerMarker(job);
        } else {
            // Show minimal track button
            showTrackButton();
        }
    } catch (error) {
        console.error('Job Tracker: Error initializing content script', error);
    }
})();

/**
 * Show prominent status badge for tracked job
 * @param {Object} job - Job data
 */
async function showCornerMarker(job) {
    // Remove existing badge if it exists
    const existingBadge = document.getElementById('job-tracker-status-badge');
    if (existingBadge) {
        existingBadge.remove();
    }

    // Get custom colors and theme from storage
    const settings = await StorageService.getSettings();
    const colors = settings?.statusColors || DEFAULT_STATUS_COLORS;
    const statusColor = colors[job.status] || DEFAULT_STATUS_COLORS[job.status];
    const theme = settings?.theme || 'light';

    // Create minimalist status badge
    const badge = document.createElement('div');
    badge.id = 'job-tracker-status-badge';
    badge.className = 'job-tracker-status-badge';
    badge.dataset.theme = theme;

    // Flat color, no gradients
    badge.style.background = statusColor;
    badge.title = `Job Tracked: ${job.company} - ${job.title}`;
    badge.style.color = '#ffffff';

    badge.innerHTML = `
        <div class="job-tracker-badge-content">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M13 4L6 11L3 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="job-tracker-badge-text">${job.status.toUpperCase()}</span>
        </div>
    `;

    // Click to open popup
    badge.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'openPopup' });
    });

    document.body.appendChild(badge);
}

/**
 * Show floating track button
 */
async function showTrackButton() {
    // Don't show if button already exists
    if (document.getElementById('job-tracker-float-btn')) {
        return;
    }

    const button = document.createElement('button');
    button.id = 'job-tracker-float-btn';
    button.className = 'job-tracker-float-btn';
    button.title = 'Track this job';
    button.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 3L12.5 8L18 8.5L14 12.5L15 18L10 15L5 18L6 12.5L2 8.5L7.5 8L10 3Z"
            fill="currentColor" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `;

    document.body.appendChild(button);

    button.addEventListener('click', () => {
        // Open extension popup (will trigger popup to load current page)
        chrome.runtime.sendMessage({ action: 'openPopup' });
    });
}

// Listen for page visibility changes (when user comes back to tab)
document.addEventListener('visibilitychange', async () => {
    if (!document.hidden) {
        // Page became visible again, check if it's a tracked job
        try {
            const job = await StorageService.findJobByURL(window.location.href);
            if (job) {
                showCornerMarker(job);
            }
        } catch (error) {
            console.error('Job Tracker: Error checking job on visibility change', error);
        }
    }
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'jobUpdated') {
        // Refresh badge if job was updated
        const existingBadge = document.getElementById('job-tracker-status-badge');
        if (existingBadge) existingBadge.remove();

        StorageService.findJobByURL(window.location.href).then(job => {
            if (job) showCornerMarker(job);
        });
    }

    if (message.action === 'showMarker' && message.job) {
        // Show badge triggered by navigation (SPA support)
        // Remove existing badge first
        const existingBadge = document.getElementById('job-tracker-status-badge');
        if (existingBadge) existingBadge.remove();

        // Remove track button if exists
        const trackBtn = document.getElementById('job-tracker-float-btn');
        if (trackBtn) trackBtn.remove();

        showCornerMarker(message.job);
    }

    if (message.action === 'themeChanged') {
        // Update badge theme
        const existingBadge = document.getElementById('job-tracker-status-badge');
        if (existingBadge) {
            existingBadge.dataset.theme = message.theme;
        }
    }
});
