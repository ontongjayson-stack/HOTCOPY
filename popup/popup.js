// HOTCOPY - Popup Controller

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const statusPill = document.getElementById('status-pill');
  const statusText = document.getElementById('status-text');
  const chkMasterToggle = document.getElementById('chk-master-toggle');
  const masterToggleLabel = document.getElementById('master-toggle-label');

  const emptyState = document.getElementById('empty-state');
  const clientCard = document.getElementById('client-card');
  const clientName = document.getElementById('client-name');
  const clientId = document.getElementById('client-id');
  const clientWaBar = document.getElementById('client-wa-bar');
  const waPhonePreview = document.getElementById('wa-phone-preview');
  const btnPopupWhatsapp = document.getElementById('btn-popup-whatsapp');

  const fieldList = document.getElementById('field-list');
  const historyList = document.getElementById('history-list');
  const historyEmpty = document.getElementById('history-empty');

  const btnCapture = document.getElementById('btn-capture');
  const btnPicker = document.getElementById('btn-picker');
  const btnAutofill = document.getElementById('btn-autofill');
  const btnClear = document.getElementById('btn-clear-profile');
  const btnOptions = document.getElementById('btn-open-options');

  const chkAutoFill = document.getElementById('chk-auto-fill');
  const chkTabJump = document.getElementById('chk-tab-jump');
  const chkFloatingDock = document.getElementById('chk-floating-dock');
  const chkHighlight = document.getElementById('chk-highlight');
  const chkWaAutoSend = document.getElementById('chk-wa-auto-send');
  const btnResetBubble = document.getElementById('btn-reset-bubble');

  // Phone normalizer (E.164 digits)
  function normalizePhone(rawPhone) {
    if (!rawPhone || typeof rawPhone !== 'string') return null;
    let cleaned = rawPhone.replace(/\(\s*0\s*\)/g, '').trim().replace(/[^\d+]/g, '');
    if (cleaned.startsWith('00')) cleaned = '+' + cleaned.slice(2);
    if (cleaned.startsWith('+')) {
      const digits = cleaned.slice(1);
      if (digits.startsWith('270') && digits.length === 12) return '27' + digits.slice(3);
      return digits.length >= 8 && digits.length <= 15 ? digits : null;
    }
    if (cleaned.startsWith('0') && cleaned.length === 10) return '27' + cleaned.slice(1);
    if (cleaned.startsWith('27') && cleaned.length === 11) return cleaned;
    if (/^\d{7,15}$/.test(cleaned)) return cleaned;
    return null;
  }

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.getAttribute('data-tab');
      const pane = document.getElementById(target);
      if (pane) pane.classList.add('active');
    });
  });

  // Load state
  async function refreshUI() {
    const data = await chrome.storage.local.get(['active_profile', 'profile_history', 'settings']);
    const profile = data.active_profile;
    const history = data.profile_history || [];
    const settings = data.settings || {};

    const isMasterEnabled = settings.masterEnabled !== false;
    chkMasterToggle.checked = isMasterEnabled;
    masterToggleLabel.innerText = isMasterEnabled ? 'ON' : 'OFF';
    masterToggleLabel.className = `master-toggle-label ${isMasterEnabled ? '' : 'off'}`;

    btnCapture.disabled = !isMasterEnabled;
    btnPicker.disabled = !isMasterEnabled;
    btnAutofill.disabled = !isMasterEnabled;

    // Settings
    chkAutoFill.checked = settings.autoFillOnFocus !== false;
    chkTabJump.checked = settings.tabJumpNext !== false;
    chkFloatingDock.checked = settings.showFloatingWidget !== false;
    chkHighlight.checked = settings.highlightFilled !== false;
    if (chkWaAutoSend) chkWaAutoSend.checked = Boolean(settings.waAutoSend);

    // Active Profile UI
    if (!isMasterEnabled) {
      statusPill.className = 'status-pill disabled';
      statusText.innerText = 'Disabled';
    } else if (profile && (profile.fullName || profile.firstName || Object.keys(profile).length > 0)) {
      if (data.dock_closed) {
        await chrome.storage.local.set({ dock_closed: false });
      }
      statusPill.className = 'status-pill ready';
      statusText.innerText = 'Ready to Paste';
      emptyState.style.display = 'none';
      clientCard.style.display = 'block';

      const name = profile.fullName || [profile.memberName, profile.memberSurname].filter(Boolean).join(' ') || 'Unnamed Client';
      clientName.innerText = name;
      const cmText = profile.cmNumber || profile.memberId;
      clientId.innerText = cmText ? `CM#: ${cmText}` : (profile.idNumber ? `ID: ${profile.idNumber}` : 'Profile Active');

      // WhatsApp quick bar
      const rawPhone = profile.contactNumber || profile.mobilePhone || profile.emergencyPhone;
      const normalizedPhone = normalizePhone(rawPhone);
      if (normalizedPhone) {
        clientWaBar.style.display = 'flex';
        waPhonePreview.innerText = `+${normalizedPhone}`;
        btnPopupWhatsapp.onclick = async () => {
          const firstName = profile.firstName || profile.memberName || (profile.fullName ? profile.fullName.split(' ')[0] : 'there');
          const consultant = profile.consultant || profile.salesConsultant || 'Our Team';
          const branch = profile.branch || 'our club';
          const pkg = profile.memberType || profile.membershipType || 'membership';
          const defaultMsg = `Hi ${firstName}, thank you for joining! This is ${consultant} from ${branch}. Your ${pkg} membership${cmText ? ` (CM#: ${cmText})` : ''} has been successfully processed. Please let us know if you have any questions!`;

          await chrome.runtime.sendMessage({
            type: 'OPEN_WHATSAPP_CHAT',
            phone: normalizedPhone,
            text: defaultMsg,
            autoSend: settings.waAutoSend === true
          });
        };
      } else {
        clientWaBar.style.display = 'none';
      }

      // Canonical display order matching the Sales App
      const DISPLAY_ORDER = [
        'dateLoaded',
        'branch',
        'consultant',
        'cmNumber',
        'memberName',
        'memberSurname',
        'contactNumber',
        'emailAddress',
        'source',
        'outcome',
        'memberType',
        'period',
        'value',
        'firstDoDate',
        'notes',
        'idNumber'
      ];

      const FIELD_LABELS = {
        dateLoaded: 'Date Loaded',
        branch: 'Branch',
        consultant: 'Consultant',
        cmNumber: 'CM#',
        memberName: 'Member Name',
        memberSurname: 'Member Surname',
        contactNumber: 'Contact#',
        emailAddress: 'Email Address',
        source: 'Source',
        outcome: 'Outcome',
        memberType: 'Member Type',
        period: 'Period',
        value: 'Value',
        firstDoDate: '1st D/O Date',
        notes: 'Notes',
        idNumber: 'ID Number'
      };

      const ALIASES = new Set(['_capturedAt', 'cm', 'contact', 'mobilePhone', 'email', 'membershipType', 'salesConsultant', 'memberId', 'fullName']);

      // Populate fields in structured order
      fieldList.innerHTML = '';
      const renderedKeys = new Set();

      DISPLAY_ORDER.forEach(key => {
        const value = profile[key];
        if (value && typeof value === 'string') {
          renderedKeys.add(key);
          const row = document.createElement('div');
          row.className = 'field-row';
          const label = FIELD_LABELS[key] || key;

          row.innerHTML = `
            <div class="field-info">
              <span class="field-key">${label}</span>
              <span class="field-val" title="${value}">${value}</span>
            </div>
            <button class="btn-copy" data-val="${encodeURIComponent(value)}" title="Copy to clipboard">Copy</button>
          `;
          fieldList.appendChild(row);
        }
      });

      // Append any remaining custom or unmapped fields
      for (const [key, value] of Object.entries(profile)) {
        if (renderedKeys.has(key) || ALIASES.has(key) || key.startsWith('_') || !value || typeof value !== 'string') continue;

        const row = document.createElement('div');
        row.className = 'field-row';
        const readableKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

        row.innerHTML = `
          <div class="field-info">
            <span class="field-key">${readableKey}</span>
            <span class="field-val" title="${value}">${value}</span>
          </div>
          <button class="btn-copy" data-val="${encodeURIComponent(value)}" title="Copy to clipboard">Copy</button>
        `;
        fieldList.appendChild(row);
      }

      // Add copy listeners
      fieldList.querySelectorAll('.btn-copy').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const val = decodeURIComponent(btn.getAttribute('data-val'));
          await navigator.clipboard.writeText(val);
          const orig = btn.innerText;
          btn.innerText = '✓';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.innerText = orig;
            btn.classList.remove('copied');
          }, 1500);
        });
      });
    } else {
      statusPill.className = 'status-pill idle';
      statusText.innerText = 'No Client Loaded';
      emptyState.style.display = 'block';
      clientCard.style.display = 'none';
    }

    // History UI
    if (history.length > 0) {
      historyEmpty.style.display = 'none';
      historyList.innerHTML = '';
      history.forEach((histProfile, idx) => {
        const item = document.createElement('li');
        item.className = 'history-item';
        const hName = histProfile.fullName || histProfile.firstName || 'Client Profile';
        const hDate = histProfile._capturedAt ? new Date(histProfile._capturedAt).toLocaleDateString() : '';
        const hId = histProfile.idNumber ? ` (${histProfile.idNumber})` : '';

        item.innerHTML = `
          <div>
            <div class="history-name">${hName}${hId}</div>
            <div class="history-date">${hDate} • ${Object.keys(histProfile).filter(k => !k.startsWith('_')).length} fields</div>
          </div>
          <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;">Load</button>
        `;

        item.addEventListener('click', async () => {
          await chrome.runtime.sendMessage({
            type: 'PROFILE_CAPTURED',
            profile: histProfile
          });
          // Switch to active tab
          document.querySelector('[data-tab="tab-active"]').click();
          await refreshUI();
        });

        historyList.appendChild(item);
      });
    } else {
      historyEmpty.style.display = 'block';
      historyList.innerHTML = '';
    }
  }

  // Get active tab helper
  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  // Button: Capture Profile
  btnCapture.addEventListener('click', async () => {
    btnCapture.disabled = true;
    btnCapture.style.opacity = '0.7';

    try {
      const tab = await getActiveTab();
      if (!tab || !tab.id) throw new Error('No active browser tab found.');

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_CAPTURE' });
      if (response && response.success) {
        await refreshUI();
      } else {
        alert(response && response.error ? response.error : 'No client profile details could be found on this page.');
      }
    } catch (err) {
      console.error(err);
      alert('Could not capture on this page. Make sure you are on a web page and reload the tab if the extension was just updated.');
    } finally {
      btnCapture.disabled = false;
      btnCapture.style.opacity = '1';
    }
  });

  // Button: Visual Picker
  btnPicker.addEventListener('click', async () => {
    try {
      const tab = await getActiveTab();
      if (tab && tab.id) {
        await chrome.tabs.sendMessage(tab.id, { action: 'START_ELEMENT_PICKER' });
        window.close(); // Close popup so user can click on the page
      }
    } catch (err) {
      alert('Could not start element picker on this page. Reload the tab and try again.');
    }
  });

  // Button: Autofill Page
  btnAutofill.addEventListener('click', async () => {
    try {
      const tab = await getActiveTab();
      if (tab && tab.id) {
        await chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_AUTOFILL_ALL' });
      }
    } catch (err) {
      alert('Could not autofill this page. Reload the tab and try again.');
    }
  });

  // Button: Clear Profile
  btnClear.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'CLEAR_ACTIVE_PROFILE' });
    await refreshUI();
  });

  // Settings Toggles
  async function saveSetting(key, val) {
    const { settings = {} } = await chrome.storage.local.get('settings');
    settings[key] = val;
    await chrome.storage.local.set({ settings });
  }

  chkAutoFill.addEventListener('change', () => saveSetting('autoFillOnFocus', chkAutoFill.checked));
  chkTabJump.addEventListener('change', () => saveSetting('tabJumpNext', chkTabJump.checked));
  chkFloatingDock.addEventListener('change', () => saveSetting('showFloatingWidget', chkFloatingDock.checked));
  chkHighlight.addEventListener('change', () => saveSetting('highlightFilled', chkHighlight.checked));
  if (chkWaAutoSend) chkWaAutoSend.addEventListener('change', () => saveSetting('waAutoSend', chkWaAutoSend.checked));

  // Master Toggle listener
  chkMasterToggle.addEventListener('change', async () => {
    await chrome.runtime.sendMessage({
      type: 'SET_MASTER_ENABLED',
      enabled: chkMasterToggle.checked
    });
    await refreshUI();
  });

  // Reset Bubble Position button
  if (btnResetBubble) {
    btnResetBubble.addEventListener('click', async () => {
      await chrome.storage.local.remove('bubble_pos');
      alert('Floating bubble position reset to default.');
    });
  }

  // Button: Open Options
  btnOptions.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Initial render
  await refreshUI();
});
