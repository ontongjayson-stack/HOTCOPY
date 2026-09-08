# HOTCOPY ⚡

> **Instant Web Profile Scraper & Smart Form Autofill**  
> *Turn a tedious 5-minute copy-paste grind into a seamless 5-second flow.*

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Privacy: 100% Local](https://img.shields.io/badge/Privacy-100%25%20Local-green.svg)](#privacy--security)

---

## 💡 What is HOTCOPY?

If your daily workflow involves repeatedly copying customer or client details (Name, ID Number, Phone, Email, Address, Banking details, Package info) from one web portal or CRM and pasting each field one-by-one into a form, spreadsheet, or web app — **HOTCOPY was built for you.**

Instead of switching tabs 15 times per sale or transaction, HOTCOPY does the entire transfer in two effortless steps:
1. **Capture**: Click **HOTCOPY** on any client profile page. All relevant details are immediately captured and buffered in your browser's private local memory.
2. **Autofill**: In your destination form or sheet, click any field. HOTCOPY automatically matches and pre-fills the data. Press <kbd>Tab</kbd> to confirm and jump straight to the next field, which immediately autofills too.

---

## ⚡ How It Saves You Hours Every Week

| The Old Manual Way 🐢 | The HOTCOPY Way 🚀 |
|---|---|
| Copy first name ➔ Switch tab ➔ Paste ➔ Switch tab | Click **Capture Profile** (or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd>) |
| Copy surname ➔ Switch tab ➔ Paste ➔ Switch tab | Click first form field ➔ Press <kbd>Tab</kbd> |
| Copy ID number ➔ Switch tab ➔ Paste ➔ Switch tab | Press <kbd>Tab</kbd> |
| Copy phone number ➔ Switch tab ➔ Paste ➔ Switch tab | Press <kbd>Tab</kbd> |
| Copy email ➔ Switch tab ➔ Paste ➔ Switch tab | Press <kbd>Tab</kbd> |
| Copy address, package, bank info... 😴 | Done in under 5 seconds! ⚡ |
| **Average time: 3–5 minutes per entry** | **Average time: Under 5 seconds per entry** |
| Frequent typos, transposed digits, and missed fields | **Zero transcription errors** — exact 1:1 fidelity |

---

## ✨ Key Features

* **⚡ 1-Click Smart Profile Scraper**: Automatically identifies names, national ID/passport numbers, birth dates, phone numbers, email addresses, street addresses, postal codes, membership codes, banking info, and emergency contacts.
* **📋 Interactive Click-to-Fill Dropdown**: When clicking into any input, textarea, or dropdown, a clean menu pops up showing all captured details. Click any value to instantly fill it without leaving the field.
* **⏩ Rapid Tab-to-Advance Navigation**: Pressing <kbd>Tab</kbd> locks in the current field value and moves directly to the next eligible form input, automatically preparing the next detail.
* **🛳️ Always-On-Top Draggable Window**: Once activated, a lightweight floating window stays visible and on top across all your browser tabs (`z-index: 2147483647`). Includes a drag handle (`⠿`) so you can move it anywhere on your screen.
* **🔍 Interactive Visual Element Picker**: Found a unique or non-standard field on a page? Click **"Pick Element"** and click directly on the text on screen to save it instantly.
* **⚡ One-Click "Fill All"**: Have a standard form with recognizable labels? Click **"⚡ Fill All"** or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> to populate the entire form at once.
* **⚙️ Customizable Field Aliases**: Add your own custom column names or field aliases in the Preferences dashboard.
* **🔒 100% Private & Local**: Zero external server calls, zero tracking, zero analytics. Your customer data never leaves your computer.

---

## 🚀 Installation

HOTCOPY is free and open-source. You can load it directly into Google Chrome, Microsoft Edge, Brave, or any Chromium browser:

1. **Download or Clone** this repository to your computer:
   ```bash
   git clone https://github.com/ontongjayson-stack/HOTCOPY.git
   ```
   *(Or download as a ZIP and extract it to a folder).*

2. Open your Chromium browser and go to:
   ```text
   chrome://extensions/
   ```
3. Toggle on **Developer mode** in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the folder containing `manifest.json`.
6. Pin **HOTCOPY** to your browser toolbar for easy 1-click access!

---

## ⌨️ Keyboard Shortcuts Reference

| Shortcut | Action |
|---|---|
| <kbd>Tab</kbd> | Commit current field & jump to next field (with automatic fill) |
| <kbd>Esc</kbd> | Close dropdown / dismiss floating prompt |
| <kbd>Alt</kbd> + <kbd>↓</kbd> | Open quick dropdown of all captured details |
| <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>C</kbd> | Capture profile from the active webpage |
| <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>V</kbd> | Autofill all matching fields across the active form |

---

## 🔒 Privacy & Security

* **No External APIs**: HOTCOPY does not communicate with any external servers.
* **Local Storage Only**: Captured data is stored solely in your browser's private `chrome.storage.local`.
* **Instant Clearance**: Click the `✕` on the floating dock or click **Clear** in the popup to erase all buffered client data at any moment.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) — free to use, modify, and distribute.
