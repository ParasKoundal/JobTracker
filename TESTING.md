# Testing Guide

## How to Test the Job Tracker Extension

### Setup

1. **Load the extension in Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `JobTracker` directory
   - The extension icon should appear in your toolbar

2. **Open the DevTools Console**:
   - Right-click the extension icon > "Inspect popup" (to see popup logs)
   - Go to `chrome://extensions/` and click "Inspect views service worker" (to see background logs)
   - Press F12 on any page (to see content script logs)

### Test Cases

#### Test 1: Icon Color Change on Tracked Jobs

**Steps**:
1. Navigate to any job posting page (e.g., LinkedIn, Indeed, etc.)
2. Click the extension icon
3. Fill in job details:
   - Company: "Test Company"
   - Title: "Software Engineer"
   - Status: Select "Applied" (blue)
4. Click "Track Job"
5. **Expected**:
   - Extension icon should turn BLUE
   - Badge should show "✓" with blue background
   - Console logs should show: "updateIconForStatus called with: applied"

6. Reload the page
7. **Expected**: Icon should remain blue and badge should appear

#### Test 2: Different Status Colors

**Steps**:
1. On the same tracked job page, click the extension icon again
2. Change status to "Interviewing" (orange)
3. Click "Update Job"
4. **Expected**:
   - Extension icon should change to ORANGE
   - Badge background should turn orange
   - Console logs should show: "Updating icon for status: interviewing"

5. Try other statuses:
   - "Interested" → Gray icon
   - "Offer" → Green icon
   - "Rejected" → Red icon

#### Test 3: Icon Resets on Non-Tracked Pages

**Steps**:
1. Navigate to a page that's NOT tracked (e.g., google.com)
2. **Expected**:
   - Extension icon should return to default (static PNG)
   - No badge should be visible
   - Console should show: "Reset to default icon if no job tracked"

#### Test 4: Theme Toggle

**Steps**:
1. Click the extension icon
2. Click the theme toggle icon (sun/moon) in the top right
3. **Expected**: Theme switches between light and dark mode
4. Close and reopen the popup
5. **Expected**: Theme preference persists

#### Test 5: Save Page Locally

**Steps**:
1. Navigate to any job posting page
2. Click the extension icon
3. Fill in job details (Company, Title)
4. Ensure the "Save Page Locally" toggle is ON (it is by default)
5. Click "Track Job"
6. After the success message, navigate back to the same page
7. Click the extension icon again
8. **Expected**:
   - The status bar should show a "Saved Page" button next to the "Update Status" button
   - Clicking "Saved Page" opens the saved HTML in a new tab

9. Open the dashboard
10. **Expected**: The tracked job row should have a document icon button in the Actions column
11. Click the document icon
12. **Expected**: The saved page opens in a new tab

#### Test 6: Save Page Toggle OFF

**Steps**:
1. Navigate to a new (untracked) job posting page
2. Click the extension icon
3. Fill in job details
4. Turn OFF the "Save Page Locally" toggle
5. Click "Track Job"
6. Navigate back to the same page and click the extension icon
7. **Expected**:
   - No "Saved Page" button should appear in the status bar
   - The toggle preference should persist (toggle remains off next time)

#### Test 7: JSON Export & Import

**Steps**:
1. Track a few jobs (some with saved pages, some without)
2. Open the dashboard
3. Click "Export JSON"
4. **Expected**: A `.json` file downloads containing `version`, `jobs`, and `pages` keys
5. Clear all extension data (run `chrome.storage.local.clear()` in service worker console)
6. Reload the extension and open the dashboard
7. Click "Import JSON" and select the exported file
8. **Expected**:
   - All jobs are restored
   - Saved pages are restored (document icon appears for jobs that had saved pages)
   - A success alert shows the number of imported jobs

#### Test 8: Backward-Compatible Import

**Steps**:
1. If you have an old export file (plain JSON object of jobs without `version` key), try importing it
2. **Expected**: Jobs import successfully, no errors
3. Saved pages won't be present (old format didn't include them) -- this is expected

#### Test 9: Dashboard Actions

**Steps**:
1. Click extension icon > Dashboard icon (grid)
2. You should see your tracked job(s)
3. Click the "Open" button (external link icon)
   - **Expected**: Opens the job posting in a new tab
4. Click the "Edit" button (pencil icon)
   - **Expected**: Opens edit modal
5. Change the status and save
   - **Expected**: Table updates with new status
6. Click the "Delete" button (trash icon)
   - **Expected**: Confirmation dialog appears
   - Click OK
   - **Expected**: Job is removed from table
   - **Expected**: Associated saved page HTML is also deleted

#### Test 10: Multiple Tabs

**Steps**:
1. Open a tracked job in Tab A
2. Open a different tracked job (different status) in Tab B
3. Switch between tabs
4. **Expected**: Icon color changes to match each tab's job status

### Debugging

If icons are NOT changing:

1. **Check Console Logs**:
   - Service Worker console should show:
     ```
     updateIconForStatus called with: [status] tabId: [number]
     Using color: [hex] for status: [status]
     Generating new icon for: [status]
     Icon updated successfully for status: [status]
     ```

2. **Common Issues**:
   - **No logs at all**: Service worker might have crashed. Go to chrome://extensions/ and click "Reload" on the extension
   - **"Error updating icon"**: Check the full error message in console
   - **Icon doesn't change**: Clear the cache by changing colors in settings

3. **Verify OffscreenCanvas Support**:
   - In the console, type: `typeof OffscreenCanvas`
   - Should return: `"function"`
   - If not, your browser version may not support OffscreenCanvas

4. **Check Storage**:
   - In service worker console, type: `chrome.storage.local.get(null, console.log)`
   - Should show stored jobs and settings

### Expected Console Output

#### Service Worker (Background)

```
updateIconForStatus called with: applied tabId: 123
Using color: #3b82f6 for status: applied
Generating new icon for: applied
Icon updated successfully for status: applied
```

#### Content Script

```
Job Tracker: Initializing...
Found tracked job: [job details]
Showing corner marker for: [company name]
```

#### Popup

```
Loading existing job...
Job found: [job key]
Showing existing job status
```

## Cleanup After Testing

1. To remove all test data:
   - Open DevTools Console on service worker
   - Run: `chrome.storage.local.clear(() => console.log('Cleared'))`

2. Reload the extension:
   - Go to chrome://extensions/
   - Click the reload icon on Job Tracker extension
