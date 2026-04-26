/**
 * Background service worker
 * Monitors tab updates and manages extension state
 */

import { DEFAULT_STATUS_COLORS } from '../utils/helpers.js';
import { StorageService } from '../utils/storage.js';

// Cache for generated icon data URLs
const iconCache = new Map();

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Only process when page has finished loading
    if (changeInfo.status === 'complete' && tab.url) {
        handleTabUpdate(tabId, tab.url);
    }
});

/**
 * Generate a minimalist flat icon for a specific status (Swiss design)
 * @param {string} status - Job status
 * @param {number} size - Icon size
 * @param {string} color - Hex color
 * @returns {ImageData} Icon image data
 */
function generateStatusIcon(status, size, color) {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    const centerX = size / 2;
    const centerY = size / 2;
    const squareSize = size * 0.7;

    // Draw flat rounded square background
    ctx.fillStyle = color;
    ctx.beginPath();
    roundRect(ctx,
        centerX - squareSize / 2,
        centerY - squareSize / 2,
        squareSize,
        squareSize,
        size * 0.15
    );
    ctx.fill();

    // Draw minimalist checkmark
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = size * 0.12;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';

    ctx.beginPath();
    const checkScale = size / 128;
    ctx.moveTo(40 * checkScale, 64 * checkScale);
    ctx.lineTo(56 * checkScale, 80 * checkScale);
    ctx.lineTo(88 * checkScale, 48 * checkScale);
    ctx.stroke();

    return ctx.getImageData(0, 0, size, size);
}

/**
 * Draw rounded rectangle helper
 */
function roundRect(ctx, x, y, width, height, radius) {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
}

/**
 * Update extension icon based on job status
 * @param {string} status - Job status
 * @param {number} tabId - Tab ID (optional)
 */
async function updateIconForStatus(status, tabId = null) {
    try {
        console.log('updateIconForStatus called with:', status, 'tabId:', tabId);

        // Get custom colors from storage
        const settings = await StorageService.getSettings();
        const colors = settings?.statusColors || DEFAULT_STATUS_COLORS;
        const statusColor = colors[status] || DEFAULT_STATUS_COLORS.applied;

        console.log('Using color:', statusColor, 'for status:', status);

        // Check cache first (cache key includes color in case colors changed)
        const cacheKey = `${status}_${statusColor}`;
        if (iconCache.has(cacheKey)) {
            console.log('Using cached icon for:', cacheKey);
            const iconData = iconCache.get(cacheKey);
            await chrome.action.setIcon({
                imageData: iconData,
                tabId: tabId
            });
            return;
        }

        console.log('Generating new icon for:', status);

        // Generate icons for all sizes
        const iconData = {
            16: generateStatusIcon(status, 16, statusColor),
            48: generateStatusIcon(status, 48, statusColor),
            128: generateStatusIcon(status, 128, statusColor)
        };

        // Cache the icon data
        iconCache.set(cacheKey, iconData);

        // Set the icon
        await chrome.action.setIcon({
            imageData: iconData,
            tabId: tabId
        });

        console.log('Icon updated successfully for status:', status);
    } catch (error) {
        console.error('Error updating icon:', error);
        // Fallback to default icon on error
        chrome.action.setIcon({
            path: {
                16: '/icons/icon16.png',
                48: '/icons/icon48.png',
                128: '/icons/icon128.png'
            },
            tabId: tabId
        });
    }
}

/**
 * Handle tab update
 * @param {number} tabId - Tab ID
 * @param {string} url - Tab URL
 */
async function handleTabUpdate(tabId, url) {
    try {
        // Check if this URL matches a tracked job
        const job = await StorageService.findJobByURL(url);

        if (job) {
            // Update last_seen_at timestamp
            await StorageService.updateLastSeen(job.job_key);

            // Update icon color based on job status
            await updateIconForStatus(job.status, tabId);

            // Update badge to show job is tracked
            chrome.action.setBadgeText({
                text: '✓',
                tabId: tabId
            });

            // Get status color for badge
            const settings = await StorageService.getSettings();
            const colors = settings?.statusColors || DEFAULT_STATUS_COLORS;
            const statusColor = colors[job.status] || DEFAULT_STATUS_COLORS.applied;

            chrome.action.setBadgeBackgroundColor({
                color: statusColor,
                tabId: tabId
            });

            // Notify content script to show marker (Critical for SPAs)
            try {
                await chrome.tabs.sendMessage(tabId, {
                    action: 'showMarker',
                    job: job
                });
            } catch (e) {
                // Content script might not be ready, detected on load normally
            }
        } else {
            // Reset to default icon if no job tracked
            chrome.action.setIcon({
                path: {
                    16: 'icons/icon16.png',
                    48: 'icons/icon48.png',
                    128: 'icons/icon128.png'
                },
                tabId: tabId
            });

            // Clear badge
            chrome.action.setBadgeText({
                text: '',
                tabId: tabId
            });
        }
    } catch (error) {
        console.error('Error handling tab update:', error);
    }
}

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'openPopup') {
        // This is called when floating button is clicked
        // Chrome will handle opening the popup automatically
        return true;
    }

    if (message.action === 'openDashboard') {
        chrome.tabs.create({
            url: chrome.runtime.getURL('src/dashboard/dashboard.html')
        });
        return true;
    }

    if (message.action === 'colorsUpdated') {
        // Clear icon cache when colors are updated
        iconCache.clear();
        return true;
    }

    if (message.action === 'jobStatusUpdated') {
        // Update icon for the active tab when job status changes
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (tabs[0]) {
                console.log('Updating icon for status:', message.status, 'on tab:', tabs[0].id);
                await updateIconForStatus(message.status, tabs[0].id);
            }
        });
        return true;
    }

    if (message.action === 'getJobForURL') {
        // Content script asks for job data (can't import storage directly)
        (async () => {
            try {
                const job = await StorageService.findJobByURL(message.url);
                if (job) {
                    await StorageService.updateLastSeen(job.job_key);
                    const settings = await StorageService.getSettings();
                    sendResponse({ job, theme: settings?.theme || 'light' });
                } else {
                    sendResponse({ job: null });
                }
            } catch (e) {
                console.error('Error in getJobForURL:', e);
                sendResponse({ job: null });
            }
        })();
        return true; // keep message channel open for async response
    }

    if (message.action === 'checkAlarms') {
        syncAlarms();
        sendResponse({ success: true });
        return true;
    }

    return false;
});

// Listen for extension installation
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
        // Open dashboard on first install
        chrome.tabs.create({
            url: chrome.runtime.getURL('src/dashboard/dashboard.html')
        });
    }
    syncAlarms(); // Setup alarms initially
    await StorageService.migratePageStorage();

    // On install or update, push local data to sync and pull remote data
    try {
        await StorageService.pushToSync();
        console.log('Job Tracker: Pushed local data to sync on install/update');
        const pulled = await StorageService.pullFromSync();
        if (pulled) console.log('Job Tracker: Pulled remote data on install/update');
    } catch (e) {
        console.warn('Job Tracker: Initial sync failed:', e);
    }
});

// Startup logic — pull from sync in case another device pushed changes
chrome.runtime.onStartup.addListener(async () => {
    syncAlarms();
    try {
        const pulled = await StorageService.pullFromSync();
        if (pulled) {
            console.log('Job Tracker: Pulled remote data on startup');
            chrome.runtime.sendMessage({ action: 'syncUpdated' }).catch(() => {});
        }
    } catch (e) {
        console.warn('Job Tracker: Startup sync pull failed:', e);
    }
});

// --- Follow-up Reminders Logic ---

async function syncAlarms() {
    const settings = await StorageService.getSettings();
    const enabled = settings?.reminders_enabled === true; // default false
    
    if (enabled) {
        chrome.alarms.create('checkStaleJobs', { periodInMinutes: 1440 }); // Checks daily
        checkStaleJobs(); // Run immediately
    } else {
        chrome.alarms.clear('checkStaleJobs');
        if (chrome.action && chrome.action.setBadgeText) {
            chrome.action.setBadgeText({ text: '' });
        }
    }
}

async function checkStaleJobs() {
    try {
        const jobs = await StorageService.getAllJobsArray();
        const today = new Date();
        
        const staleJobs = jobs.filter(job => {
            if (job.status !== 'applied' || !job.applied_at) return false;
            
            const appliedDate = new Date(job.applied_at);
            const diffDays = (today - appliedDate) / (1000 * 60 * 60 * 24);
            
            return diffDays >= 14;
        });
        
        if (chrome.action && chrome.action.setBadgeText) {
            if (staleJobs.length > 0) {
                chrome.action.setBadgeText({ text: staleJobs.length.toString() });
                chrome.action.setBadgeBackgroundColor({ color: '#ef4444' }); // Red
            } else {
                chrome.action.setBadgeText({ text: '' });
            }
        }
    } catch (err) {
        console.error('Error checking stale jobs:', err);
    }
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'checkStaleJobs') {
        checkStaleJobs();
    }
});

// Listen for sync storage changes natively
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync') {
        // Debounce or just pull all right away
        StorageService.pullFromSync().then(madeChanges => {
            if (madeChanges) {
                console.log('Job Tracker: Synced new data from remote device');
                checkStaleJobs();
                // Optionally broadcast a message to the dashboard to refresh
                chrome.runtime.sendMessage({ action: 'syncUpdated' }).catch(() => {});
            }
        }).catch(err => {
            console.error('Job Tracker sync pull error:', err);
        });
    }
});
