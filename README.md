# Job Tracker - Chrome Extension

A Chrome Extension that helps you track job applications with one click. Never lose track of where you applied.

## Features

### Core Functionality
- **One-Click Tracking**: Mark job postings with a single click from the extension popup
- **Smart URL Matching**: Automatically detects when you revisit a job posting you've already tracked
- **Dynamic Status Icons**: Extension icon changes color based on the job status on the current page
- **Save Page Locally**: Capture and store a full copy of job posting pages for offline reference (on by default, toggleable per job)
- **View Saved Pages**: Open saved job postings from the popup or the dashboard at any time
- **Searchable Dashboard**: View all your tracked jobs in a clean, organized dashboard
- **Filters & Sorting**: Filter by status, search by company/title, and sort by various criteria
- **CSV Export**: Export your job tracking data to CSV for further analysis
- **JSON Import/Export**: Full data portability with JSON export (includes saved pages) and backward-compatible import

### Design & Customization
- **Swiss Minimalism**: Clean, flat design inspired by Swiss design principles
- **Light/Dark Theme**: Toggle between light and dark modes
- **Fixed Color Palette**: Carefully selected, accessible colors for job statuses
- **Zero Clutter**: Minimal, distraction-free interface with sharp geometry

### Privacy
- **Privacy-First**: All data stored locally on your device using Chrome Storage API
- **No Tracking**: No analytics, no external servers, works completely offline

## Installation

### From Source

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `JobTracker` directory
5. The extension icon should appear in your toolbar

## Usage

### Tracking a Job

1. Navigate to any job posting page
2. Click the Job Tracker extension icon in your toolbar
3. Fill in the job details (company, title, location, status, notes)
4. The "Save Page Locally" toggle is on by default -- turn it off if you don't want to save a copy of the page
5. Click "Track Job"

### Viewing a Saved Page

1. Navigate to a job posting page you've already tracked (with page saved)
2. Click the extension icon -- a "Saved Page" button appears in the status bar
3. Click "Saved Page" to open the saved copy in a new tab
4. You can also view saved pages from the dashboard by clicking the document icon in the Actions column

### Importing & Exporting Data

1. Open the dashboard
2. Click "Export CSV" for a spreadsheet-compatible export, or "Export JSON" for a full backup (includes saved pages)
3. To restore data, click "Import JSON" and select a previously exported JSON file
4. Import is backward-compatible -- it works with both old-format exports (jobs only) and new-format exports (jobs + saved pages)

### Viewing Your Jobs

1. Click the extension icon and then the dashboard icon (grid) in the top right
2. Or right-click the extension icon and select "Dashboard"
3. Search, filter, and manage all your tracked jobs


### Switching Themes

1. Click the extension icon
2. Click the theme toggle icon (sun/moon) in the top right
3. Theme switches instantly between light and dark
4. Your preference is saved automatically

### Status Colors

The extension uses a fixed, carefully selected color palette:
- **Interested**: Gray (#6b7280)
- **Applied**: Blue (#3b82f6)
- **Interviewing**: Orange (#f59e0b)
- **Offer**: Green (#10b981)
- **Rejected**: Red (#ef4444)

These colors are optimized for accessibility and clarity in both light and dark themes.


## Permissions

- **storage**: Store job data and settings locally
- **activeTab**: Access the current tab to detect tracked jobs
- **tabs**: Monitor tab changes for dynamic icon updates
- **scripting**: Capture page HTML for the "Save Page Locally" feature

## Future Enhancements

- Auto-detect job submission pages
- Email/calendar integration
- Resume version tracking
- Activity timeline
- Duplicate job detection
- Reminders for follow-ups

## License

MIT License - feel free to use and modify as needed

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Coming Soon

🚀 **JobTracker will hopefully be available on the Chrome Web Store soon!** Stay tuned for an easier installation process.

## Support

If you find this extension useful, consider buying me a coffee! [![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-yellow.svg)](https://buymeacoffee.com/paraskoundal)