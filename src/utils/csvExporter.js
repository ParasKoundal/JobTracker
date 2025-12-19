/**
 * CSV export utility
 */

/**
 * Convert jobs array to CSV format
 * @param {Array} jobs - Array of job objects
 * @returns {string} CSV content
 */
export function jobsToCSV(jobs) {
    if (!jobs || jobs.length === 0) {
        return '';
    }

    // Define CSV columns
    const columns = [
        'Company',
        'Title',
        'Location',
        'Status',
        'Applied Date',
        'Created Date',
        'Last Seen',
        'Source',
        'URL',
        'Notes',
        'Tags'
    ];

    // Create header row
    const header = columns.join(',');

    // Create data rows
    const rows = jobs.map(job => {
        return [
            escapeCsvValue(job.company || ''),
            escapeCsvValue(job.title || ''),
            escapeCsvValue(job.location || ''),
            escapeCsvValue(job.status || ''),
            formatDateForCSV(job.applied_at),
            formatDateForCSV(job.created_at),
            formatDateForCSV(job.last_seen_at),
            escapeCsvValue(job.source || ''),
            escapeCsvValue(job.original_url || job.canonical_url || ''),
            escapeCsvValue(job.notes || ''),
            escapeCsvValue((job.tags || []).join('; '))
        ].join(',');
    });

    return [header, ...rows].join('\n');
}

/**
 * Escape a value for CSV
 * @param {string} value - Value to escape
 * @returns {string} Escaped value
 */
function escapeCsvValue(value) {
    if (!value) return '';

    const stringValue = String(value);

    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
}

/**
 * Format date for CSV export
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
function formatDateForCSV(dateString) {
    if (!dateString) return '';

    const date = new Date(dateString);

    if (isNaN(date.getTime())) return '';

    return date.toLocaleDateString('en-US');
}

/**
 * Download CSV file
 * @param {string} csvContent - CSV content
 * @param {string} filename - Filename (default: job-tracker-export.csv)
 */
export function downloadCSV(csvContent, filename = 'job-tracker-export.csv') {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL
    setTimeout(() => URL.revokeObjectURL(url), 100);
}
