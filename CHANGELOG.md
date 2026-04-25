# Changelog

## [1.3.1] - 2026-04-25

### Fix: Page Saving Storage Overflow

Fixed a critical bug where local page saving would stop working after saving ~10-50 jobs.

#### Fixed
- **Storage Quota Overflow**: Page HTML was stored in a single `chrome.storage.local` key (`job_tracker_pages`). Once the 10 MB quota was exceeded, all page saves silently failed.
- **Migration Crash**: Migration logic could temporarily double storage usage, causing the extension to fail on load.

#### Changed
- **Per-Job Storage Keys**: Each saved page is now stored under its own key (`job_page_{jobKey}`) instead of one monolithic object. This distributes storage and avoids hitting the quota limit.
- **Automatic Migration**: Existing saved pages in the old format are automatically migrated to per-job keys on first load. Migration is idempotent and safe to run multiple times.
- **Error Feedback**: The popup now shows a visible warning if a page save fails, instead of silently swallowing the error.
- **Dashboard Import**: JSON import now writes pages using per-job keys instead of the old monolithic format.

#### Backward Compatibility
- Existing saved pages are automatically migrated (no data loss)
- JSON export/import format is unchanged — old exports still importable
- Copy-paste between browsers continues to work

#### Modified Files
- `src/utils/storage.js` — Per-job keys, migration logic, error handling
- `src/popup/popup.js` — Triggers migration on init, shows save warnings
- `src/dashboard/dashboard.js` — Triggers migration on init, per-job import

## [1.3.0] - 2025-02-18

### Save Page Locally & JSON Import/Export

Added the ability to save full job posting pages locally for offline reference, plus JSON-based data portability.

#### Added
- **Save Page Locally**: Capture a full HTML copy of job posting pages when tracking a job
- **Save Page Toggle**: On/off toggle in the popup (defaults to on), preference persists across sessions
- **View Saved Page (Popup)**: "Saved Page" button appears in the popup status bar when visiting a previously tracked job with a saved page
- **View Saved Page (Dashboard)**: Document icon button in the Actions column for jobs with saved pages
- **JSON Export**: Export all jobs and saved pages as a single JSON file for full backup
- **JSON Import**: Import JSON files with backward compatibility (supports old plain-jobs format and new versioned format with pages)
- **Page HTML Storage**: Saved pages stored in a separate storage key (`job_tracker_pages`) to keep the jobs list lightweight

#### Changed
- **Page Capture Method**: Uses `chrome.scripting.executeScript()` for reliable page capture instead of content script messaging
- **Manifest Permissions**: Added `scripting` permission to support reliable page capture
- **Delete Job**: Now also cleans up any associated saved page HTML

#### Technical Details

##### New Storage Key
- `job_tracker_pages` - Stores page HTML keyed by `job_key`, separate from jobs data

##### New StorageService Methods
- `savePageHTML(jobKey, html)` - Save page HTML
- `getPageHTML(jobKey)` - Retrieve saved page HTML
- `getAllPageHTML()` - Get all saved pages
- `deletePageHTML(jobKey)` - Delete saved page HTML
- `hasPageHTML(jobKey)` - Check if a job has a saved page

##### Modified Files
- `manifest.json` - Added `scripting` permission
- `src/utils/storage.js` - Added page HTML storage methods
- `src/popup/popup.html` - Added save page toggle and saved page button
- `src/popup/popup.js` - Added page capture, view saved page, toggle logic
- `src/popup/popup-minimal.css` - Added toggle switch and status actions styles
- `src/content/detector.js` - Added `capturePageHTML` message handler (fallback)
- `src/dashboard/dashboard.html` - Added Export JSON and Import JSON buttons
- `src/dashboard/dashboard.js` - Added JSON export/import, view saved page in table

##### JSON Export Format
```json
{
  "version": 1,
  "exported_at": "2025-02-18T...",
  "jobs": { ... },
  "pages": { ... }
}
```

##### Backward Compatibility
- Import accepts both old format (plain jobs object) and new format (`{ version, jobs, pages }`)
- Existing tracked jobs without saved pages continue to work normally
- The save page toggle defaults to on for new installations

## [1.2.0] - 2024-12-19

### Design Overhaul - Swiss Minimalism

Complete redesign following Swiss design principles with flat, minimalist aesthetics.

#### Added
- **Light/Dark Theme Toggle**: Switch between light and dark modes via popup icon
- **Theme Persistence**: Selected theme saves across sessions
- **Minimalist Icon Design**: Flat, rounded square icons without gradients
- **Swiss Typography**: Clean Helvetica Neue font with generous spacing
- **Zero Border Radius**: Sharp corners throughout for geometric precision
- **Fixed Color Palette**: Curated, accessible colors for all job statuses

#### Removed
- **Color Customization**: Removed user-customizable badge colors for design consistency
- **Settings Panel**: Removed color picker UI from popup

#### Changed
- **Icon Generation**: Replaced gradient circles with flat rounded squares
- **Color Badges**: Removed gradients, now solid colors with optional borders
- **Animation**: Simplified from slide-in to fade-in
- **Shadows**: Removed all drop shadows for flat design
- **Hover Effects**: Minimalist border changes instead of elevation
- **Button Styles**: Flat buttons with sharp corners and color inversions on hover
- **Typography**: Increased letter-spacing, reduced font weights
- **Spacing**: More generous padding and margins

#### Design Principles Applied
- **Minimalism**: Only essential visual elements
- **Flat Design**: No gradients, shadows, or depth effects
- **Grid-Based Layout**: Aligned to implicit grid
- **Negative Space**: Generous whitespace for clarity
- **Typography**: Helvetica Neue with uppercase labels
- **Limited Color Palette**: Primary colors plus black/white
- **Sharp Geometry**: 0px border-radius for all elements

### Technical Changes

#### New Files
- `src/popup/popup-minimal.css` - Swiss-style minimalist CSS with theme support
- `src/dashboard/dashboard-minimal.css` - Flat dashboard design

#### Modified Files
- `src/background/service-worker.js` - Flat icon generation with rounded squares
- `src/content/content.css` - Minimalist badge styles, no shadows or gradients
- `src/content/detector.js` - Theme support for badges, removed color customization
- `src/popup/popup.html` - Added theme toggle, removed settings button
- `src/popup/popup.js` - Theme toggle functions, removed color customization
- `src/dashboard/dashboard.html` - Updated to use minimal CSS
- `README.md` - Updated features and design philosophy
- `TESTING.md` - Updated with theme testing instructions

#### Design Consistency
- All gradients removed across popup, dashboard, and content scripts
- Consistent 0px border-radius except for subtle icon rounding
- Fixed color palette (#6b7280, #3b82f6, #f59e0b, #10b981, #ef4444)
- No shadows, no depth effects
- Flat buttons with color inversion on hover
- Helvetica Neue typography throughout
- Theme syncs automatically between popup and dashboard
- Dashboard includes theme toggle button next to logo

## [1.1.0] - 2024-12-19

### Added
- **Dynamic Icon Colors**: Extension icon now changes color based on the job status of the current page
- **Status-Based Badge Colors**: Badge background color matches the job status color scheme
- **Shared Helper Utilities**: Created `src/utils/helpers.js` with common functions used across multiple files
- **Icon Generation**: Dynamic icon generation using canvas API with status-specific colors
- **Icon Caching**: Performance optimization with icon cache to avoid regenerating icons

### Changed
- **Code Cleanup**: Refactored duplicate code and consolidated common utilities
  - Moved `capitalizeStatus()` to shared helpers
  - Moved `escapeHtml()` to shared helpers
  - Moved color helper functions (`isLightColor`, `lightenColor`) to shared helpers
  - Consolidated `DEFAULT_STATUS_COLORS` constant to single location
- **Service Worker**: Enhanced to generate colored icons dynamically based on job status
- **Manifest**: Added ES module support for service worker
- **Badge Colors**: Updated to use status-specific colors instead of hardcoded black
- **User Feedback**: Improved color settings save message to indicate automatic updates

### Improved
- **Visual Feedback**: Users can now instantly identify job status from the extension icon color
- **Consistency**: All status colors are now sourced from a single configuration
- **Maintainability**: Reduced code duplication by consolidating common functions
- **Performance**: Icon caching prevents unnecessary regeneration of identical icons

### Technical Details

#### New Files
- `src/utils/helpers.js` - Shared utility functions and constants
- `src/utils/iconGenerator.js` - Icon generation utilities (created but not used in final implementation)
- `CHANGELOG.md` - This file

#### Modified Files
- `src/background/service-worker.js` - Added dynamic icon generation and status-based coloring
- `src/popup/popup.js` - Uses shared helpers, notifies background script of color/status changes
- `src/dashboard/dashboard.js` - Uses shared helpers for status formatting
- `src/content/detector.js` - Uses shared helpers for color calculations
- `manifest.json` - Added ES module support
- `README.md` - Updated features and usage documentation

#### Status Colors (Default)
- **Interested**: Gray (#6b7280)
- **Applied**: Blue (#3b82f6)
- **Interviewing**: Orange (#f59e0b)
- **Offer**: Green (#10b981)
- **Rejected**: Red (#ef4444)

All colors are customizable through the extension settings.

### How It Works

1. When a user visits a tracked job page, the service worker detects it
2. The service worker retrieves the job status and corresponding color
3. A colored icon is generated dynamically using canvas API
4. The icon is cached for performance
5. The extension icon is updated to show the status color
6. The badge color also updates to match the status

This provides instant visual feedback about the job application status without opening the extension.
