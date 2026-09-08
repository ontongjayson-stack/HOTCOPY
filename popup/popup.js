// HOTCOPY - Popup Controller

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const statusPill = document.getElementById('status-pill');
  const statusText = document.getElementById('status-text');
  const emptyState = document.getElementById('empty-state');
  const clientCard = document.getElementById('client-card');
  const clientName = document.getElementById('client-name');
  const clientId = document.getElementById('client-id');
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

    // Settings
    chkAutoFill.checked = settings.autoFillOnFocus !== false;
    chkTabJump.checked = settings.tabJumpNext !== false;
    chkFloatingDock.checked = settings.showFloatingWidget !== false;
    chkHighlight.checked = settings.highlightFilled !== false;

    // Active Profile UI
    if (profile && (profile.fullName || profile.firstName || Object.keys(profile).length > 0)) {
      if (data.dock_closed) {
        await chrome.storage.local.set({ dock_closed: false });
      }
      statusPill.className = 'status-pill ready';
      statusText.innerText = 'Ready to Paste';
      emptyState.style.display = 'none';
      clientCard.style.display = 'block';

      const name = profile.fullName || [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Unnamed Client';
      clientName.innerText = name;
      clientId.innerText = profile.idNumber ? `ID: ${profile.idNumber}` : (profile.memberId ? `Member: ${profile.memberId}` : 'Profile Active');

      // Populate fields
      fieldList.innerHTML = '';
      for (const [key, value] of Object.entries(profile)) {
        if (key.startsWith('_') || !value || typeof value !== 'string') continue;

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

  // Button: Open Options
  btnOptions.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Initial render
  await refreshUI();
});
