# 📂 Job Tracker

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Design: Swiss Minimalism](https://img.shields.io/badge/Design-Swiss_Minimalism-black.svg)]()
[![Privacy: Local First](https://img.shields.io/badge/Privacy-Local_First-green.svg)]()
[![Platform: Chrome](https://img.shields.io/badge/Platform-Chrome_Extension-orange.svg)]()

> A radically simple, privacy-first Chrome Extension that helps you track job applications with exactly one click. Never lose track of where you applied.

---

## ✨ Features
Job Tracker is built on **Swiss Minimalism**—zero clutter, sharp geometry, and a distraction-free interface. We believe tracking applications should take less than a second, and you shouldn't have to surrender your data to a third-party server to do it.

- **One-Click Tracking**: Hit the extension icon on any job posting and you're done. 
- **Smart URL Matching**: We automatically detect if you stumble across a job you've already locally saved.
- **Offline Page Backup**: Takes a full offline snapshot of the job description in case the company deletes the remote listing.
- **Insightful Analytics**: View application timelines, status funnels, and response rates natively in your dashboard.
- **Cross-Device Sync**: Optional sync via your Google account so your pipeline effortlessly follows you across desktop devices.
- **Follow-Up Reminders**: Optional badge alerts reminding you to follow up on applications that have gone stale.
- **Complete Data Portability**: Export or import your entire pipeline instantly to standard JSON or CSV files.

---

## 🛠️ Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (top right corner).
4. Click **Load unpacked** and select the `JobTracker` directory.

---

## 🚀 Quick Start
The extension stays completely out of your way until you need it.

- **Track a Job**: Click the extension icon while browsing a job posting. Select your status, add optional notes or tags, and hit track. 
- **View Dashboard**: Open the Extension Popup and click the grid icon to enter the Dashboard. Here, you can sort, filter by tags, and view your application funnel analytics.
- **Toggles & Themes**: Use the absolute top header in the Dashboard to instantly toggle Dark/Light Mode, enable Cross-Device Sync, or activate Follow-Up Reminders globally.

---

## 🔒 Privacy & Architecture
All information is saved strictly to your local machine using the native `chrome.storage.local` API.
No tracking routines, no analytics payloads, no external servers, no paywalls. Completely offline capable.

---

## 🤝 Contributing
Contributions, UI improvements, and feature updates are highly welcome! Please feel free to open a Pull Request.

---

## ☕ Support
If you find this utility useful and want to keep development caffeinated:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-yellow.svg)](https://buymeacoffee.com/paraskoundal)