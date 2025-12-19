/**
 * Common helper utilities
 */

/**
 * Capitalize status string
 * @param {string} status - Status string
 * @returns {string} Capitalized status
 */
export function capitalizeStatus(status) {
    if (!status) return '';
    return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Default status colors
 */
export const DEFAULT_STATUS_COLORS = {
    interested: '#6b7280',
    applied: '#3b82f6',
    interviewing: '#f59e0b',
    offer: '#10b981',
    rejected: '#ef4444'
};

/**
 * Determine if a color is light or dark
 * @param {string} color - Hex color string
 * @returns {boolean} True if color is light
 */
export function isLightColor(color) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
}

/**
 * Lighten a color by a percentage
 * @param {string} color - Hex color string
 * @param {number} percent - Percentage to lighten
 * @returns {string} Lightened hex color
 */
export function lightenColor(color, percent) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    const adjust = (value) => {
        const adjusted = value + (255 - value) * (percent / 100);
        return Math.min(255, Math.max(0, Math.round(adjusted)));
    };

    const newR = adjust(r).toString(16).padStart(2, '0');
    const newG = adjust(g).toString(16).padStart(2, '0');
    const newB = adjust(b).toString(16).padStart(2, '0');

    return `#${newR}${newG}${newB}`;
}
