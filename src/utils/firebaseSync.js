/**
 * Firebase Realtime Database sync via REST API
 * No SDK — lightweight fetch-only implementation
 */

const FIREBASE_CONFIG = {
    databaseURL: 'https://jobtracker-paraskoundal-default-rtdb.firebaseio.com'
};

// SHA-256 hash of 'jobtracker_admin_' + admin passphrase
// Default passphrase is 'admin123'
const ADMIN_HASH = '4eea8f9cab94dc1a4211ecc2fbbb6140749bb17817061cce57947550b6deb5cb';

/**
 * Generate SHA-256 hash of a string
 * @param {string} str
 * @returns {Promise<string>} hex hash
 */
async function sha256(str) {
    const buffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Firebase REST API helper
 * @param {string} path - Database path
 * @param {string} method - HTTP method
 * @param {*} data - Request body
 * @returns {Promise<*>} Response JSON
 */
async function firebaseRequest(path, method = 'GET', data = null) {
    const url = `${FIREBASE_CONFIG.databaseURL}/${path}.json`;
    const options = { method };

    if (data !== null) {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
        throw new Error(`Firebase ${method} ${path} failed: ${response.status}`);
    }

    return await response.json();
}

export const FirebaseSync = {
    _channelId: null,

    /**
     * Initialize sync with a passphrase
     * @param {string} passphrase - User's sync passphrase
     * @returns {Promise<boolean>} Whether init succeeded
     */
    async init(passphrase) {
        if (!passphrase || !passphrase.trim()) return false;
        this._channelId = await sha256('jobtracker_sync_' + passphrase.trim());
        return true;
    },

    /**
     * Check if sync is initialized
     * @returns {boolean}
     */
    isReady() {
        return !!this._channelId;
    },

    /**
     * Get the current channel ID
     * @returns {string|null}
     */
    getChannelId() {
        return this._channelId;
    },

    // --- Job Sync ---

    /**
     * Push a single job to Firebase
     * @param {Object} job - Job object
     */
    async pushJob(job) {
        if (!this._channelId || job.sync_disabled) return;
        await firebaseRequest(
            `sync/${this._channelId}/jobs/${job.job_key}`,
            'PUT',
            job
        );
    },

    /**
     * Push all jobs to Firebase (full overwrite of channel)
     * @param {Object|Array} jobs - Jobs object or array
     */
    async pushAllJobs(jobs) {
        if (!this._channelId) return;

        const jobsObj = {};
        const jobList = Array.isArray(jobs) ? jobs : Object.values(jobs);
        for (const job of jobList) {
            if (!job.sync_disabled) {
                jobsObj[job.job_key] = job;
            }
        }

        await firebaseRequest(
            `sync/${this._channelId}/jobs`,
            'PUT',
            jobsObj
        );

        // Update channel metadata
        await firebaseRequest(
            `sync/${this._channelId}/meta`,
            'PATCH',
            {
                last_sync: new Date().toISOString(),
                job_count: Object.keys(jobsObj).length
            }
        );
    },

    /**
     * Delete a job from Firebase
     * @param {string} jobKey - Job key to delete
     */
    async deleteJob(jobKey) {
        if (!this._channelId) return;
        await firebaseRequest(
            `sync/${this._channelId}/jobs/${jobKey}`,
            'DELETE'
        );
    },

    /**
     * Pull all jobs from Firebase
     * @returns {Promise<Object|null>} Jobs object or null
     */
    async pullJobs() {
        if (!this._channelId) return null;
        const jobs = await firebaseRequest(
            `sync/${this._channelId}/jobs`
        );
        return jobs || {};
    },

    /**
     * Full sync: merge local + remote, push result back
     * @param {Object} localJobs - Local jobs keyed by job_key
     * @returns {Promise<{merged: Object, changed: boolean}>}
     */
    async fullSync(localJobs) {
        if (!this._channelId) return { merged: localJobs, changed: false };

        // Pull remote
        const remoteJobs = await this.pullJobs();

        // Merge: last-write-wins based on updated_at
        const merged = { ...localJobs };
        let changed = false;

        if (remoteJobs) {
            for (const [key, remoteJob] of Object.entries(remoteJobs)) {
                const localJob = merged[key];
                
                // Keep local job private if sync_disabled is true
                if (localJob && localJob.sync_disabled) {
                    continue;
                }

                if (!localJob || new Date(remoteJob.updated_at) > new Date(localJob.updated_at)) {
                    merged[key] = remoteJob;
                    changed = true;
                }
            }
        }

        // Check for local jobs not in remote (need to push)
        const localKeys = Object.keys(localJobs).filter(k => !localJobs[k].sync_disabled);
        const remoteKeys = remoteJobs ? Object.keys(remoteJobs) : [];
        const newLocalKeys = localKeys.filter(k => !remoteKeys.includes(k));
        const needsPush = newLocalKeys.length > 0 || changed;

        // Push merged result back
        if (needsPush) {
            await this.pushAllJobs(merged);
        }

        return { merged, changed };
    },

    /**
     * Get last sync timestamp from meta
     * @returns {Promise<string|null>}
     */
    async getLastSync() {
        if (!this._channelId) return null;
        try {
            const meta = await firebaseRequest(
                `sync/${this._channelId}/meta`
            );
            return meta?.last_sync || null;
        } catch {
            return null;
        }
    },

    // --- Telemetry (anonymous) ---

    /**
     * Report an anonymous telemetry event
     * @param {string} eventType - Event type (e.g. 'install', 'job_saved')
     * @param {Object} metadata - Additional metadata
     */
    async reportEvent(eventType, metadata = {}) {
        try {
            const event = {
                type: eventType,
                timestamp: new Date().toISOString(),
                channel: this._channelId || 'anonymous',
                ...metadata
            };
            // POST = Firebase auto-generates a unique key
            await firebaseRequest('analytics/events', 'POST', event);
        } catch (e) {
            // Telemetry is best-effort
            console.warn('Job Tracker telemetry failed:', e);
        }
    },

    /**
     * Heartbeat: register this channel as active
     */
    async heartbeat() {
        if (!this._channelId) return;
        try {
            await firebaseRequest(
                `analytics/channels/${this._channelId}`,
                'PATCH',
                { last_active: new Date().toISOString() }
            );
        } catch (e) {
            console.warn('Job Tracker heartbeat failed:', e);
        }
    },

    // --- Admin ---
    // (Admin analytics removed from extension per user request. Use Firebase Console instead.)
};
