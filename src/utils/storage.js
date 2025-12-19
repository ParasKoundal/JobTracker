/**
 * Storage service for managing job applications
 * Uses Chrome Storage API
 */

const STORAGE_KEY = 'job_tracker_jobs';

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
    return job;
  },

  /**
   * Get a job by its key
   * @param {string} jobKey - Job key
   * @returns {Promise<Object|null>} Job data or null
   */
  async getJob(jobKey) {
    const jobs = await this.getAllJobs();
    return jobs[jobKey] || null;
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
    return Object.values(jobs);
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
    
    delete jobs[jobKey];
    await chrome.storage.local.set({ [STORAGE_KEY]: jobs });
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
    const { canonicalizeURL } = await import('./urlCanonicalizer.js');
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
  }
};
