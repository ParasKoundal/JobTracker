/**
 * Icon generator for status-based extension icons
 * Generates colored icons dynamically using canvas
 */

import { DEFAULT_STATUS_COLORS } from './helpers.js';

/**
 * Generate a colored icon for a specific status
 * @param {string} status - Job status
 * @param {number} size - Icon size (16, 48, or 128)
 * @param {Object} customColors - Optional custom color scheme
 * @returns {Promise<ImageData>} Icon image data
 */
export async function generateStatusIcon(status, size = 128, customColors = null) {
    const colors = customColors || DEFAULT_STATUS_COLORS;
    const color = colors[status] || DEFAULT_STATUS_COLORS.applied;

    // Create an offscreen canvas
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Draw background circle
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size * 0.4;

    // Create gradient
    const gradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, radius
    );
    gradient.addColorStop(0, lightenHex(color, 20));
    gradient.addColorStop(1, color);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();

    // Draw checkmark or status indicator
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = size * 0.08;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw checkmark
    ctx.beginPath();
    const checkScale = size / 128;
    ctx.moveTo(40 * checkScale, 64 * checkScale);
    ctx.lineTo(56 * checkScale, 80 * checkScale);
    ctx.lineTo(88 * checkScale, 48 * checkScale);
    ctx.stroke();

    // Add a subtle border
    ctx.strokeStyle = darkenHex(color, 10);
    ctx.lineWidth = size * 0.02;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    return ctx.getImageData(0, 0, size, size);
}

/**
 * Create icon URLs for all sizes from a status
 * @param {string} status - Job status
 * @param {Object} customColors - Optional custom color scheme
 * @returns {Promise<Object>} Object with icon URLs for sizes 16, 48, 128
 */
export async function createStatusIconSet(status, customColors = null) {
    const sizes = [16, 48, 128];
    const icons = {};

    for (const size of sizes) {
        const imageData = await generateStatusIcon(status, size, customColors);
        const canvas = new OffscreenCanvas(size, size);
        const ctx = canvas.getContext('2d');
        ctx.putImageData(imageData, 0, 0);

        const blob = await canvas.convertToBlob();
        icons[size] = URL.createObjectURL(blob);
    }

    return icons;
}

/**
 * Lighten a hex color
 * @param {string} hex - Hex color
 * @param {number} percent - Percentage to lighten
 * @returns {string} Lightened hex color
 */
function lightenHex(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, ((num >> 16) & 255) + (255 - ((num >> 16) & 255)) * percent / 100);
    const g = Math.min(255, ((num >> 8) & 255) + (255 - ((num >> 8) & 255)) * percent / 100);
    const b = Math.min(255, (num & 255) + (255 - (num & 255)) * percent / 100);

    return '#' + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b))
        .toString(16).slice(1);
}

/**
 * Darken a hex color
 * @param {string} hex - Hex color
 * @param {number} percent - Percentage to darken
 * @returns {string} Darkened hex color
 */
function darkenHex(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, ((num >> 16) & 255) * (1 - percent / 100));
    const g = Math.max(0, ((num >> 8) & 255) * (1 - percent / 100));
    const b = Math.max(0, (num & 255) * (1 - percent / 100));

    return '#' + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b))
        .toString(16).slice(1);
}
