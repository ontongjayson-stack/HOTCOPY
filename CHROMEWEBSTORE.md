# Chrome Web Store Listing: HOTCOPY

**Extension Name**: HOTCOPY - Smart Profile Capture & Form Autofill  
**Version**: 1.0.0  
**Last Updated**: 2026-09-08  

---

## 1. Store Metadata

### Short Description (max 132 chars)
Capture client and customer profiles from any portal and auto-fill web forms, sheets, and lists with rapid Tab navigation.

### Detailed Description
HOTCOPY is an intelligent workflow accelerator designed for professionals who frequently capture customer data from web portals, CRMs, and profiles and enter it into web forms, spreadsheets, and web apps.

Instead of manually switching back and forth between tabs and copying every single detail one by one (Name, ID number, Mobile number, Email, Address, Account info, etc.), HOTCOPY handles the entire transfer in seconds:

1. **One-Click Profile Capture**: Open any customer or member profile, click HOTCOPY, and all relevant data is instantly captured and safely buffered.
2. **Smart Click-to-Fill**: Click into any field in your destination web form or sheet — HOTCOPY automatically detects the field and populates the matching client data.
3. **Tab-to-Advance Navigation**: Press `Tab` to confirm the value and immediately jump to the next field. The next field automatically fills, letting you complete entire forms effortlessly.
4. **Interactive Element Picker**: If a profile has an unusual or custom field, click "Pick Element" to click on any text on screen and save it instantly.
5. **Always-On-Top Floating Window**: Quick access to "Fill All Fields", review captured details, or drag the window anywhere on your screen.
6. **100% Private & Local**: Your data never leaves your browser. All data is stored strictly in your browser's private local storage.

---

## 2. Permissions Justifications

| Permission | Technical Need | User Benefit / Justification |
|---|---|---|
| `storage` | Stores active client profile and recent profile history | Persists captured client details locally so they can be pasted into the destination form. |
| `activeTab` | Accesses the currently active tab when user clicks the extension action or keyboard shortcut | Allows capturing client profiles on demand from the current tab. |
| `scripting` | Executes profile extraction and field auto-fill logic | Enables reading the profile layout and dispatching input events into form elements. |
| `tabs` | Reads active tab URL and switches between capture/form tabs | Needed to coordinate data transfer between source profile tabs and destination form tabs. |
| `<all_urls>` | Operates across CRM portals, intranet domains, and sandboxed web app endpoints | Enables seamless cross-tab capture and autofill across any web portal or iframe web app. |

---

## 3. Privacy & Data Use Disclosure

- **Single Purpose**: Automates transfer of profile data between source web portals and destination forms/lists.
- **Data Collection**: No personal data is collected, logged to external servers, sold, or shared with third parties.
- **Local Storage**: All profile data is kept purely in the user's browser storage (`chrome.storage.local`) and can be cleared at any time with one click.
- **Remote Code**: Does not use remote code or external CDNs. All logic and icons are bundled locally within the extension.

---

## 4. Version History

- **v1.0.0 (2026-09-08)**:
  - Initial open source release.
  - Manifest V3 compliant.
  - Automated heuristic DOM profile scraper.
  - Interactive on-screen visual element picker.
  - Intelligent field matcher with fuzzy semantic scoring.
  - Sequential Tab-key auto-advance navigation.
  - Always-on-top draggable floating window with "Fill All" and quick values selector.
  - Custom field mapping dashboard in Preferences.
  - Complete high-resolution icon suite.
