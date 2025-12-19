/**
 * URL canonicalization and job key generation
 * Handles tracking parameter removal and stable ID extraction
 */

// Tracking parameters to remove
const TRACKING_PARAMS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'ref', 'src', 'refId', 'trk', 'trackingId', 'campaignId',
    'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid',
    '_hsenc', '_hsmi', 'mkt_tok'
];

/**
 * Canonicalize a URL by removing tracking params and normalizing
 * @param {string} url - URL to canonicalize
 * @returns {string} Canonical URL
 */
export function canonicalizeURL(url) {
    try {
        const urlObj = new URL(url);

        // Remove tracking parameters
        TRACKING_PARAMS.forEach(param => {
            urlObj.searchParams.delete(param);
        });

        // Normalize hostname to lowercase
        urlObj.hostname = urlObj.hostname.toLowerCase();

        // Remove trailing slash from pathname (except for root)
        if (urlObj.pathname !== '/' && urlObj.pathname.endsWith('/')) {
            urlObj.pathname = urlObj.pathname.slice(0, -1);
        }

        // Sort remaining query parameters for consistency
        const sortedParams = new URLSearchParams(
            [...urlObj.searchParams.entries()].sort((a, b) => a[0].localeCompare(b[0]))
        );
        urlObj.search = sortedParams.toString();

        return urlObj.toString();
    } catch (e) {
        console.error('Error canonicalizing URL:', e);
        return url;
    }
}

/**
 * Extract stable job identifier from URL
 * @param {string} url - Job posting URL
 * @returns {string|null} Stable job ID or null
 */
export function extractJobId(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        const pathname = urlObj.pathname;
        const params = urlObj.searchParams;

        // Greenhouse
        if (hostname.includes('greenhouse') || hostname.includes('grnh.se')) {
            const ghJid = params.get('gh_jid');
            if (ghJid) return `greenhouse_${ghJid}`;

            // Some Greenhouse URLs have /jobs/<id> pattern
            const match = pathname.match(/\/jobs\/(\d+)/);
            if (match) return `greenhouse_${match[1]}`;
        }

        // Lever
        if (hostname.includes('lever.co')) {
            const match = pathname.match(/\/jobs\/([a-f0-9-]+)/);
            if (match) return `lever_${match[1]}`;
        }

        // Workday
        if (hostname.includes('myworkday') || hostname.includes('workday')) {
            const jobId = params.get('jobId');
            if (jobId) return `workday_${jobId}`;

            const match = pathname.match(/Job\/([^\/]+)/);
            if (match) return `workday_${match[1]}`;
        }

        // LinkedIn
        if (hostname.includes('linkedin.com')) {
            const match = pathname.match(/\/jobs\/view\/(\d+)/);
            if (match) return `linkedin_${match[1]}`;

            const currentJobId = params.get('currentJobId');
            if (currentJobId) return `linkedin_${currentJobId}`;
        }

        // Indeed
        if (hostname.includes('indeed.com')) {
            const jk = params.get('jk');
            if (jk) return `indeed_${jk}`;
        }

        // SmartRecruiters
        if (hostname.includes('smartrecruiters.com')) {
            const match = pathname.match(/\/jobs\/(\d+)/);
            if (match) return `smartrecruiters_${match[1]}`;
        }

        // Ashby
        if (hostname.includes('ashbyhq.com')) {
            const match = pathname.match(/\/jobs\/([a-f0-9-]+)/);
            if (match) return `ashby_${match[1]}`;
        }

        return null;
    } catch (e) {
        console.error('Error extracting job ID:', e);
        return null;
    }
}

/**
 * Generate a hash from a string
 * @param {string} str - String to hash
 * @returns {Promise<string>} Hex hash
 */
async function hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a stable job key
 * @param {string} url - Job URL
 * @param {Object} metadata - Job metadata (title, company)
 * @returns {Promise<string>} Job key
 */
export async function generateJobKey(url, metadata = {}) {
    // Try to extract a stable ID from the URL
    const jobId = extractJobId(url);
    if (jobId) {
        return jobId;
    }

    // Fallback: generate hash from canonical URL + metadata
    const canonicalUrl = canonicalizeURL(url);
    const urlObj = new URL(canonicalUrl);

    const hashInput = [
        urlObj.hostname,
        urlObj.pathname,
        metadata.title || '',
        metadata.company || ''
    ].join('|').toLowerCase();

    const hash = await hashString(hashInput);
    return `hash_${hash.substring(0, 16)}`;
}

/**
 * Detect the source/platform from URL
 * @param {string} url - Job URL
 * @returns {string} Source identifier
 */
export function detectSource(url) {
    try {
        const hostname = new URL(url).hostname.toLowerCase();

        if (hostname.includes('linkedin.com')) return 'linkedin';
        if (hostname.includes('greenhouse') || hostname.includes('grnh.se')) return 'greenhouse';
        if (hostname.includes('lever.co')) return 'lever';
        if (hostname.includes('workday')) return 'workday';
        if (hostname.includes('indeed.com')) return 'indeed';
        if (hostname.includes('smartrecruiters.com')) return 'smartrecruiters';
        if (hostname.includes('ashbyhq.com')) return 'ashby';
        if (hostname.includes('bamboohr.com')) return 'bamboohr';
        if (hostname.includes('paycomonline.net')) return 'paycom';
        if (hostname.includes('icims.com')) return 'icims';

        return 'manual';
    } catch (e) {
        return 'manual';
    }
}
