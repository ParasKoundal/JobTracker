/**
 * Storage service for managing job applications
 * Uses Chrome Storage API + Firebase for cross-device sync
 */
import { canonicalizeURL } from './urlCanonicalizer.js';
import { FirebaseSync } from './firebaseSync.js';

const STORAGE_KEY = 'job_tracker_jobs';
const PAGE_KEY_PREFIX = 'job_page_';
const OLD_PAGE_HTML_KEY = 'job_tracker_pages';

export const StorageService = {
  /**
   * Save or update a job entry
   * @param {Object} jobData - Job data to save
   * @returns {Promise<Object>} Saved job data
   */
  async saveJob(jobData) {
    const jobs = await this.getAllJobs();
    
    const timestamp = new Date().toISOString();
    const job = {
      ...jobData,
      updated_at: timestamp,
      created_at: jobData.created_at || timestamp
    };
    
    jobs[job.job_key] = job;
    
    await chrome.storage.local.set({ [STORAGE_KEY]: jobs });
    
    // Attempt Firebase sync implicitly
    if (FirebaseSync.isReady()) {
      FirebaseSync.pushJob(job).catch(e => console.warn('Firebase sync failed:', e));
    } else {
      chrome.runtime.sendMessage({ action: 'triggerSync' }).catch(() => {});
    }
    
    return job;
  },

  /**
   * Get a job by its key
   * @param {string} jobKey - Job key
   * @returns {Promise<Object|null>} Job data or null
   */
  async getJob(jobKey) {
    const jobs = await this.getAllJobs();
    const job = jobs[jobKey] || null;
    return (job && !job.deleted) ? job : null;
  },

  /**
   * Get all jobs
   * @returns {Promise<Object>} All jobs as an object keyed by job_key
   */
  async getAllJobs() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY] || {};
  },

  /**
   * Get all jobs as an array
   * @returns {Promise<Array>} All jobs as an array
   */
  async getAllJobsArray() {
    const jobs = await this.getAllJobs();
    return Object.values(jobs).filter(job => !job.deleted);
  },

  /**
   * Delete a job
   * @param {string} jobKey - Job key to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteJob(jobKey) {
    const jobs = await this.getAllJobs();

    if (!jobs[jobKey]) {
      return false;
    }

    // Leave a tombstone instead of completely deleting to sync the deletion
    jobs[jobKey] = {
      job_key: jobKey,
      deleted: true,
      updated_at: new Date().toISOString()
    };
    
    await chrome.storage.local.set({ [STORAGE_KEY]: jobs });

    // Also delete saved page HTML if it exists
    await this.deletePageHTML(jobKey);

    if (FirebaseSync.isReady()) {
      FirebaseSync.pushJob(jobs[jobKey]).catch(e => console.warn('Firebase sync delete failed:', e));
    } else {
      chrome.runtime.sendMessage({ action: 'triggerSync' }).catch(() => {});
    }

    return true;
  },

  /**
   * Update job status
   * @param {string} jobKey - Job key
   * @param {string} status - New status
   * @param {Object} metadata - Additional metadata to update
   * @returns {Promise<Object|null>} Updated job or null
   */
  async updateJobStatus(jobKey, status, metadata = {}) {
    const job = await this.getJob(jobKey);
    
    if (!job) {
      return null;
    }
    
    const updates = {
      ...metadata,
      status,
      updated_at: new Date().toISOString()
    };
    
    // Set applied_at timestamp if status changes to 'applied'
    if (status === 'applied' && !job.applied_at) {
      updates.applied_at = new Date().toISOString();
    }
    
    return await this.saveJob({ ...job, ...updates });
  },

  /**
   * Update last_seen_at timestamp
   * @param {string} jobKey - Job key
   * @returns {Promise<Object|null>} Updated job or null
   */
  async updateLastSeen(jobKey) {
    const job = await this.getJob(jobKey);
    
    if (!job) {
      return null;
    }
    
    return await this.saveJob({
      ...job,
      last_seen_at: new Date().toISOString()
    });
  },

  /**
   * Find a job by URL (canonical matching)
   * @param {string} url - URL to search for
   * @returns {Promise<Object|null>} Matching job or null
   */
  async findJobByURL(url) {
    const canonicalUrl = canonicalizeURL(url);

    const jobs = await this.getAllJobsArray();
    return jobs.find(job => job.canonical_url === canonicalUrl) || null;
  },

  /**
   * Get settings
   * @returns {Promise<Object>} Settings object
   */
  async getSettings() {
    const result = await chrome.storage.local.get('job_tracker_settings');
    return result.job_tracker_settings || {};
  },

  /**
   * Save settings
   * @param {Object} settings - Settings to save
   * @returns {Promise<void>}
   */
  async saveSettings(settings) {
    await chrome.storage.local.set({ job_tracker_settings: settings });
  },

  /**
   * Migrate old monolithic page storage to per-job keys.
   * Idempotent — safe to call multiple times.
   * @returns {Promise<void>}
   */
  async migratePageStorage() {
    try {
      const result = await chrome.storage.local.get(OLD_PAGE_HTML_KEY);
      const oldPages = result[OLD_PAGE_HTML_KEY];
      if (!oldPages || typeof oldPages !== 'object') return;

      const entries = Object.entries(oldPages);

      // Remove the old monolithic key FIRST to free space
      await chrome.storage.local.remove(OLD_PAGE_HTML_KEY);

      // Then write each page to its own key individually
      for (const [jobKey, html] of entries) {
        try {
          await chrome.storage.local.set({ [PAGE_KEY_PREFIX + jobKey]: html });
        } catch (e) {
          console.warn(`Job Tracker: Could not migrate page for ${jobKey}:`, e);
        }
      }

      console.log(`Job Tracker: Migrated ${entries.length} saved page(s) to per-job storage.`);
    } catch (e) {
      console.error('Job Tracker: Migration error:', e);
    }
  },

  /**
   * Save page HTML for a job (each job's page stored under its own key)
   * @param {string} jobKey - Job key
   * @param {string} html - Page HTML content
   * @returns {Promise<void>}
   */
  async savePageHTML(jobKey, html) {
    await chrome.storage.local.set({ [PAGE_KEY_PREFIX + jobKey]: html });
  },

  /**
   * Get saved page HTML for a job
   * @param {string} jobKey - Job key
   * @returns {Promise<string|null>} HTML content or null
   */
  async getPageHTML(jobKey) {
    const result = await chrome.storage.local.get(PAGE_KEY_PREFIX + jobKey);
    return result[PAGE_KEY_PREFIX + jobKey] || null;
  },

  /**
   * Get all saved page HTML entries
   * @returns {Promise<Object>} All pages keyed by job_key
   */
  async getAllPageHTML() {
    const all = await chrome.storage.local.get(null);
    const pages = {};
    for (const [key, value] of Object.entries(all)) {
      if (key.startsWith(PAGE_KEY_PREFIX)) {
        pages[key.slice(PAGE_KEY_PREFIX.length)] = value;
      }
    }
    return pages;
  },

  /**
   * Delete saved page HTML for a job
   * @param {string} jobKey - Job key
   * @returns {Promise<void>}
   */
  async deletePageHTML(jobKey) {
    await chrome.storage.local.remove(PAGE_KEY_PREFIX + jobKey);
  },

  /**
   * Check if a job has saved page HTML
   * @param {string} jobKey - Job key
   * @returns {Promise<boolean>}
   */
  async hasPageHTML(jobKey) {
    const result = await chrome.storage.local.get(PAGE_KEY_PREFIX + jobKey);
    return !!result[PAGE_KEY_PREFIX + jobKey];
  },

  // --- CROSS DEVICE SYNC (Firebase) ---

  /**
   * Generate a secure, time-seeded unique Sync Code
   * @returns {string}
   */
  generateSyncCode() {
      // Time seed based on exact millisecond of creation
      const timestamp = Date.now().toString(36).toUpperCase();
      
      // Cryptographically secure randomness
      const array = new Uint32Array(2);
      // In service workers and extension contexts, crypto is available
      crypto.getRandomValues(array);
      const random1 = array[0].toString(36).toUpperCase().padStart(6, '0').substring(0, 6);
      const random2 = array[1].toString(36).toUpperCase().padStart(6, '0').substring(0, 6);
      
      return `JT-${timestamp}-${random1}-${random2}`;
  },

  /**
   * Get saved sync code from local storage
   * Auto-generates one if it doesn't exist
   * @returns {Promise<string>}
   */
  async getSyncPassphrase() {
      const result = await chrome.storage.local.get('job_tracker_sync_passphrase');
      let code = result.job_tracker_sync_passphrase;
      if (!code) {
          code = this.generateSyncCode();
          await this.setSyncPassphrase(code);
      }
      return code;
  },

  /**
   * Save sync passphrase to local storage
   * @param {string} passphrase
   */
  async setSyncPassphrase(passphrase) {
      await chrome.storage.local.set({ job_tracker_sync_passphrase: passphrase });
  },

  /**
   * Clear sync passphrase
   */
  async clearSyncPassphrase() {
      await chrome.storage.local.remove('job_tracker_sync_passphrase');
  },

  /**
   * Save last sync timestamp
   * @param {string} timestamp - ISO timestamp
   */
  async setLastSyncTime(timestamp) {
      await chrome.storage.local.set({ job_tracker_last_sync: timestamp });
  },

  /**
   * Get last sync timestamp
   * @returns {Promise<string|null>}
   */
  async getLastSyncTime() {
      const result = await chrome.storage.local.get('job_tracker_last_sync');
      return result.job_tracker_last_sync || null;
  }
};

