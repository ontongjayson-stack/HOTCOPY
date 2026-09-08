// HOTCOPY - Options Controller

document.addEventListener('DOMContentLoaded', async () => {
  const optAutoFill = document.getElementById('opt-auto-fill');
  const optTabJump = document.getElementById('opt-tab-jump');
  const optFloatingDock = document.getElementById('opt-floating-dock');
  const optHighlight = document.getElementById('opt-highlight');

  const mappingTbody = document.getElementById('mapping-tbody');
  const btnAddMapping = document.getElementById('btn-add-mapping');
  const btnSave = document.getElementById('btn-save');
  const btnExport = document.getElementById('btn-export');
  const btnClearHistory = document.getElementById('btn-clear-history');
  const saveToast = document.getElementById('save-toast');

  const AVAILABLE_FIELDS = [
    { key: 'fullName', label: 'Full Name' },
    { key: 'firstName', label: 'First Name' },
    { key: 'lastName', label: 'Last Name' },
    { key: 'title', label: 'Title / Salutation' },
    { key: 'idNumber', label: 'ID / Passport Number' },
    { key: 'dob', label: 'Date of Birth' },
    { key: 'gender', label: 'Gender' },
    { key: 'mobilePhone', label: 'Cell / Mobile Phone' },
    { key: 'homePhone', label: 'Home Phone' },
    { key: 'workPhone', label: 'Work Phone' },
    { key: 'email', label: 'Email Address' },
    { key: 'streetAddress', label: 'Street Address' },
    { key: 'suburb', label: 'Suburb / Area' },
    { key: 'city', label: 'City / Town' },
    { key: 'postalCode', label: 'Postal Code' },
    { key: 'memberId', label: 'Member / Client ID' },
    { key: 'clubName', label: 'Home Club / Facility' },
    { key: 'membershipType', label: 'Membership / Package' },
    { key: 'salesConsultant', label: 'Sales Consultant' },
    { key: 'emergencyName', label: 'Emergency Contact Name' },
    { key: 'emergencyPhone', label: 'Emergency Contact Phone' },
    { key: 'bankName', label: 'Bank Name' },
    { key: 'accountNumber', label: 'Account Number' },
    { key: 'branchCode', label: 'Branch Code' }
  ];

  // Load existing settings
  const { settings = {}, custom_mappings = {} } = await chrome.storage.local.get(['settings', 'custom_mappings']);

  optAutoFill.checked = settings.autoFillOnFocus !== false;
  optTabJump.checked = settings.tabJumpNext !== false;
  optFloatingDock.checked = settings.showFloatingWidget !== false;
  optHighlight.checked = settings.highlightFilled !== false;

  // Render initial mappings
  function renderRow(fieldKey, keywords = []) {
    const tr = document.createElement('tr');

    const optionsHtml = AVAILABLE_FIELDS.map(f => `
      <option value="${f.key}" ${f.key === fieldKey ? 'selected' : ''}>${f.label} (${f.key})</option>
    `).join('');

    tr.innerHTML = `
      <td>
        <select class="table-select field-selector">
          ${optionsHtml}
        </select>
      </td>
      <td>
        <input type="text" class="table-input field-keywords" placeholder="e.g. client_cell, mobile_no, contact" value="${keywords.join(', ')}">
      </td>
      <td style="text-align: center;">
        <button class="btn-delete-row" title="Remove this mapping">✕</button>
      </td>
    `;

    tr.querySelector('.btn-delete-row').addEventListener('click', () => tr.remove());
    mappingTbody.appendChild(tr);
  }

  // Populate default or existing mappings
  if (Object.keys(custom_mappings).length > 0) {
    for (const [key, list] of Object.entries(custom_mappings)) {
      renderRow(key, list);
    }
  } else {
    // Helpful starter presets
    renderRow('fullName', ['client_name', 'member_name', 'full_name']);
    renderRow('idNumber', ['sa_id', 'id_number', 'passport_no']);
    renderRow('mobilePhone', ['contact_number', 'cellular', 'mobile_phone']);
    renderRow('email', ['email_address', 'e_mail']);
    renderRow('memberId', ['club_id', 'membership_no']);
  }

  // Add row
  btnAddMapping.addEventListener('click', () => {
    renderRow('fullName', []);
  });

  // Save changes
  btnSave.addEventListener('click', async () => {
    const updatedSettings = {
      autoFillOnFocus: optAutoFill.checked,
      tabJumpNext: optTabJump.checked,
      showFloatingWidget: optFloatingDock.checked,
      highlightFilled: optHighlight.checked
    };

    const updatedMappings = {};
    const rows = mappingTbody.querySelectorAll('tr');
    rows.forEach(r => {
      const select = r.querySelector('.field-selector');
      const input = r.querySelector('.field-keywords');
      if (select && input) {
        const key = select.value;
        const keywords = input.value.split(',').map(s => s.trim()).filter(Boolean);
        if (keywords.length > 0) {
          updatedMappings[key] = keywords;
        }
      }
    });

    await chrome.storage.local.set({
      settings: updatedSettings,
      custom_mappings: updatedMappings
    });

    // Toast
    saveToast.classList.add('show');
    setTimeout(() => saveToast.classList.remove('show'), 2500);
  });

  // Export
  btnExport.addEventListener('click', async () => {
    const data = await chrome.storage.local.get(['settings', 'custom_mappings']);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hotcopy-config.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  // Clear History
  btnClearHistory.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all stored profile history and the active profile?')) {
      await chrome.storage.local.remove(['active_profile', 'profile_history']);
      await chrome.action.setBadgeText({ text: '' });
      alert('All profile history cleared.');
    }
  });
});
