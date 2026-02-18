/**
 * Date formatting utilities
 */

/**
 * Format a date as "Dec 3, 2025"
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date
 */
export function formatDate(date) {
    if (!date) return 'N/A';

    const d = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(d.getTime())) return 'Invalid Date';

    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

/**
 * Format a date as relative time ("2 days ago", "just now")
 * @param {string|Date} date - Date to format
 * @returns {string} Relative time string
 */
export function formatRelativeTime(date) {
    if (!date) return 'N/A';

    const d = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(d.getTime())) return 'Invalid Date';

    const now = new Date();
    const diffMs = now - d;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    }
    if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${months} month${months > 1 ? 's' : ''} ago`;
    }

    const years = Math.floor(diffDays / 365);
    return `${years} year${years > 1 ? 's' : ''} ago`;
}

/**
 * Format timestamp for display
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted timestamp
 */
export function formatTimestamp(date) {
    if (!date) return 'N/A';

    const d = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(d.getTime())) return 'Invalid Date';

    return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}
