// HOTCOPY - Service Worker (Manifest V3)

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[HOTCOPY] Extension installed/updated:', details.reason);
  const data = await chrome.storage.local.get(['active_profile', 'profile_history', 'settings']);
  
  const currentSettings = data.settings || {};
  const updatedSettings = Object.assign({
    masterEnabled: true,
    autoFillOnFocus: true,
    tabJumpNext: true,
    showFloatingWidget: true,
    highlightFilled: true,
    waAutoSend: false,
    waDefaultTemplate: "Hi {FirstName}, this is {Consultant} from {Branch}. Your membership ({Package}) has been successfully processed. Please let us know if you need anything!"
  }, currentSettings);

  await chrome.storage.local.set({ settings: updatedSettings });
  await updateBadge(data.active_profile, updatedSettings);
});

// Update extension icon badge
async function updateBadge(profile, explicitSettings) {
  const settings = explicitSettings || (await chrome.storage.local.get('settings')).settings || {};

  if (settings.masterEnabled === false) {
    await chrome.action.setBadgeText({ text: 'OFF' });
    await chrome.action.setBadgeBackgroundColor({ color: '#64748b' }); // Slate gray
    await chrome.action.setTitle({ title: 'HOTCOPY: Disabled (Click icon to enable)' });
    return;
  }

  if (profile && (profile.fullName || profile.firstName || Object.keys(profile).length > 0)) {
    const name = profile.firstName || profile.fullName || 'OK';
    const initials = name.slice(0, 2).toUpperCase();
    await chrome.action.setBadgeText({ text: initials });
    await chrome.action.setBadgeBackgroundColor({ color: '#10b981' }); // Emerald green
    await chrome.action.setTitle({ 
      title: `HOTCOPY: Ready (${profile.fullName || profile.firstName || 'Client Profile'})` 
    });
  } else {
    await chrome.action.setBadgeText({ text: '' });
    await chrome.action.setTitle({ title: 'HOTCOPY: No Profile Loaded' });
  }
}

// React to settings changes for instant badge reflection
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== 'local') return;
  if (changes.settings || changes.active_profile) {
    const data = await chrome.storage.local.get(['active_profile', 'settings']);
    await updateBadge(data.active_profile, data.settings);
  }
});

// Handle runtime messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === 'PROFILE_CAPTURED') {
        const profile = message.profile;
        const { profile_history = [], settings = {} } = await chrome.storage.local.get(['profile_history', 'settings']);
        
        // Add timestamp and id if missing
        profile._capturedAt = new Date().toISOString();
        profile._sourceUrl = sender.tab ? sender.tab.url : '';
        
        // Remove existing duplicates with same ID/Name if present
        const filtered = profile_history.filter(p => 
          (profile.idNumber && p.idNumber !== profile.idNumber) ||
          (!profile.idNumber && p.fullName !== profile.fullName)
        );
        
        filtered.unshift(profile);
        const trimmedHistory = filtered.slice(0, 15);
        
        await chrome.storage.local.set({
          active_profile: profile,
          profile_history: trimmedHistory,
          dock_closed: false
        });
        
        await updateBadge(profile, settings);
        sendResponse({ success: true, profile });
      } else if (message.type === 'RESTORE_DOCK') {
        await chrome.storage.local.set({ dock_closed: false });
        sendResponse({ success: true });
      } else if (message.type === 'CLEAR_ACTIVE_PROFILE') {
        await chrome.storage.local.remove('active_profile');
        await chrome.storage.local.set({ dock_closed: true });
        const { settings = {} } = await chrome.storage.local.get('settings');
        await updateBadge(null, settings);
        sendResponse({ success: true });
      } else if (message.type === 'SET_MASTER_ENABLED') {
        const { settings = {} } = await chrome.storage.local.get('settings');
        settings.masterEnabled = Boolean(message.enabled);
        await chrome.storage.local.set({ settings });
        const { active_profile } = await chrome.storage.local.get('active_profile');
        await updateBadge(active_profile, settings);
        sendResponse({ success: true, masterEnabled: settings.masterEnabled });
      } else if (message.type === 'OPEN_WHATSAPP_CHAT') {
        const { phone, text, autoSend } = message;
        if (!phone) {
          sendResponse({ success: false, error: 'No phone number provided.' });
          return;
        }

        const waUrl = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text || '')}`;

        // Recycle existing WhatsApp Web tab or create a new one
        const waTabs = await chrome.tabs.query({ url: "*://web.whatsapp.com/*" });
        let targetTab;

        if (waTabs.length > 0) {
          targetTab = waTabs[0];
          await chrome.tabs.update(targetTab.id, { url: waUrl, active: true });
          if (targetTab.windowId) {
            try {
              await chrome.windows.update(targetTab.windowId, { focused: true });
            } catch (e) {
              // Ignore window focus errors
            }
          }
        } else {
          targetTab = await chrome.tabs.create({ url: waUrl, active: true });
        }

        if (autoSend) {
          await chrome.storage.local.set({
            pending_wa_dispatch: {
              tabId: targetTab.id,
              phone,
              text,
              requestedAt: Date.now()
            }
          });
        }

        sendResponse({ success: true, tabId: targetTab.id });
      } else if (message.type === 'GET_STATE') {
        const data = await chrome.storage.local.get(['active_profile', 'profile_history', 'settings', 'dock_closed', 'bubble_pos']);
        sendResponse({ success: true, ...data });
      } else {
        sendResponse({ error: 'Unknown message type' });
      }
    } catch (err) {
      console.error('[HOTCOPY] SW Error:', err);
      sendResponse({ error: err.message });
    }
  })();
  return true; // Keep message channel open for async response
});

// Handle keyboard command shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  const { settings = {} } = await chrome.storage.local.get('settings');
  if (settings.masterEnabled === false) {
    console.log('[HOTCOPY] Master toggle is OFF. Suppressing command shortcut:', command);
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  
  if (command === 'capture_profile') {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_CAPTURE' });
    } catch (err) {
      console.warn('[HOTCOPY] Could not trigger capture on tab:', err);
    }
  } else if (command === 'autofill_all') {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_AUTOFILL_ALL' });
    } catch (err) {
      console.warn('[HOTCOPY] Could not trigger autofill on tab:', err);
    }
  }
});
