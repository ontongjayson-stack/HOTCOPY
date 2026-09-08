// HOTCOPY - Service Worker (Manifest V3)

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[HOTCOPY] Extension installed/updated:', details.reason);
  const data = await chrome.storage.local.get(['active_profile', 'profile_history', 'settings']);
  
  if (!data.settings) {
    await chrome.storage.local.set({
      settings: {
        autoFillOnFocus: true,
        tabJumpNext: true,
        showFloatingWidget: true,
        highlightFilled: true
      }
    });
  }
  
  if (data.active_profile) {
    await updateBadge(data.active_profile);
  }
});

// Update extension icon badge
async function updateBadge(profile) {
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

// Handle runtime messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === 'PROFILE_CAPTURED') {
        const profile = message.profile;
        const { profile_history = [] } = await chrome.storage.local.get('profile_history');
        
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
        
        await updateBadge(profile);
        sendResponse({ success: true, profile });
      } else if (message.type === 'RESTORE_DOCK') {
        await chrome.storage.local.set({ dock_closed: false });
        sendResponse({ success: true });
      } else if (message.type === 'CLEAR_ACTIVE_PROFILE') {
        await chrome.storage.local.remove('active_profile');
        await chrome.storage.local.set({ dock_closed: true });
        await updateBadge(null);
        sendResponse({ success: true });
      } else if (message.type === 'GET_STATE') {
        const data = await chrome.storage.local.get(['active_profile', 'profile_history', 'settings', 'dock_closed']);
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
