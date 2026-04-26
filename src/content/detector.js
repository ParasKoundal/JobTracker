/**
 * Content script for detecting job pages and showing revisit banners.
 * 
 * NOTE: Content scripts cannot use ES module imports. All data operations
 * are done via messaging to the background service worker.
 */

// Status colors (inline to avoid imports)
const STATUS_COLORS = {
    interested: '#6b7280',
    applied: '#3b82f6',
    interviewing: '#f59e0b',
    offer: '#10b981',
    rejected: '#ef4444'
};

/**
 * Send a message to the background service worker and get a response
 */
function sendMessage(action, data = {}) {
    return new Promise((resolve) => {
        try {
            if (!chrome.runtime || !chrome.runtime.sendMessage) {
                return resolve(null);
            }
            chrome.runtime.sendMessage({ action, ...data }, (response) => {
                if (chrome.runtime.lastError) {
                    // Swallow connection errors
                }
                resolve(response || null);
            });
        } catch (e) {
            resolve(null); // Context invalidated
        }
    });
}

// Initialize on page load
(async function init() {
    try {
        const currentUrl = window.location.href;
        const response = await sendMessage('getJobForURL', { url: currentUrl });

        if (response && response.job) {
            showCornerMarker(response.job, response.theme);
        }
    } catch (error) {
        console.error('Job Tracker: Error initializing content script', error);
    }
})();

/**
 * Show prominent status badge for tracked job
 */
function showCornerMarker(job, theme) {
    // Remove existing badge if it exists
    const existingBadge = document.getElementById('job-tracker-status-badge');
    if (existingBadge) {
        existingBadge.remove();
    }

    const statusColor = STATUS_COLORS[job.status] || STATUS_COLORS.applied;
    theme = theme || 'light';

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
function showTrackButton() {
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
        chrome.runtime.sendMessage({ action: 'openPopup' });
    });
}

// Listen for page visibility changes (when user comes back to tab)
document.addEventListener('visibilitychange', async () => {
    if (!document.hidden) {
        try {
            const response = await sendMessage('getJobForURL', { url: window.location.href });
            if (response && response.job) {
                showCornerMarker(response.job, response.theme);
            }
        } catch (error) {
            console.error('Job Tracker: Error checking job on visibility change', error);
        }
    }
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'capturePageHTML') {
        const html = document.documentElement.outerHTML;
        sendResponse({ html });
        return true;
    }

    if (message.action === 'jobUpdated') {
        const existingBadge = document.getElementById('job-tracker-status-badge');
        if (existingBadge) existingBadge.remove();

        sendMessage('getJobForURL', { url: window.location.href }).then(response => {
            if (response && response.job) showCornerMarker(response.job, response.theme);
        });
    }

    if (message.action === 'showMarker' && message.job) {
        const existingBadge = document.getElementById('job-tracker-status-badge');
        if (existingBadge) existingBadge.remove();

        const trackBtn = document.getElementById('job-tracker-float-btn');
        if (trackBtn) trackBtn.remove();

        showCornerMarker(message.job);
    }

    if (message.action === 'themeChanged') {
        const existingBadge = document.getElementById('job-tracker-status-badge');
        if (existingBadge) {
            existingBadge.dataset.theme = message.theme;
        }
    }
});
