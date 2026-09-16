// HOTCOPY - WhatsApp Web Bridge (Content Script)
// Runs on https://web.whatsapp.com/*

(function() {
  'use strict';

  console.log('[HOTCOPY] WhatsApp Web Bridge initialized.');

  /**
   * Waits for WhatsApp Web chat canvas readiness or invalid phone number modal.
   * @param {number} timeoutMs
   * @returns {Promise<{status: 'READY'|'INVALID_NUMBER'|'NOT_LOGGED_IN'|'TIMEOUT', mainEl?: Element, error?: string}>}
   */
  function waitForChatReadyOrError(timeoutMs = 25000) {
    return new Promise((resolve) => {
      // 1. Check for unauthenticated QR Code
      if (document.querySelector('canvas[aria-label*="Scan" i], div[data-ref], [data-testid="qrcode"]')) {
        return resolve({ status: 'NOT_LOGGED_IN', error: 'WhatsApp Web is not authenticated. Please scan QR code.' });
      }

      const checkState = () => {
        // Check for Error / Invalid Phone Dialog
        const modal = document.querySelector('div[data-animate-modal-popup="true"], div[role="dialog"]');
        if (modal) {
          const text = modal.textContent || '';
          if (/invalid|not on WhatsApp/i.test(text)) {
            // Locate dismiss button
            const okBtn = modal.querySelector('button');
            if (okBtn) okBtn.click();
            return { status: 'INVALID_NUMBER', error: text.trim() };
          }
        }

        // Check for Active Chat Canvas & Send Button / Compose Box
        const mainEl = document.querySelector('#main');
        const sendBtn = document.querySelector('footer span[data-icon="send"], footer span[data-testid="send"], footer button[aria-label="Send"]');
        const composeBox = document.querySelector('div[data-testid="conversation-compose-box-input"], footer div[contenteditable="true"]');

        if (mainEl && (sendBtn || (composeBox && composeBox.textContent.trim().length > 0))) {
          return { status: 'READY', mainEl };
        }

        return null;
      };

      const initial = checkState();
      if (initial) return resolve(initial);

      // 2. Setup MutationObserver
      let timeoutId;
      const observer = new MutationObserver(() => {
        const res = checkState();
        if (res) {
          cleanup();
          resolve(res);
        }
      });

      const cleanup = () => {
        observer.disconnect();
        clearTimeout(timeoutId);
      };

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-icon', 'data-testid', 'aria-label']
      });

      timeoutId = setTimeout(() => {
        cleanup();
        const finalCheck = checkState();
        if (finalCheck) {
          resolve(finalCheck);
        } else {
          resolve({ status: 'TIMEOUT', error: 'Timed out waiting for chat canvas or error modal.' });
        }
      }, timeoutMs);
    });
  }

  /**
   * Deterministically clicks the WhatsApp send button
   * @returns {boolean}
   */
  function triggerSend() {
    const sendSpan = document.querySelector('footer span[data-icon="send"], footer span[data-testid="send"]');
    const sendBtn = sendSpan ? sendSpan.closest('button') : document.querySelector('footer button[aria-label="Send"]');
    if (sendBtn) {
      sendBtn.click();
      return true;
    }
    return false;
  }

  /**
   * Injects a modern floating toast notification into WhatsApp Web
   * @param {string} msg
   * @param {'info'|'success'|'error'} type
   * @param {number} [duration=4500]
   */
  function showToast(msg, type = 'info', duration = 4500) {
    const existing = document.getElementById('hotcopy-wa-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'hotcopy-wa-toast';
    const bgColors = {
      info: '#0f172a',
      success: '#065f46',
      error: '#991b1b'
    };

    toast.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 9999999;
      background: ${bgColors[type] || '#0f172a'};
      color: #f8fafc;
      padding: 12px 18px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 10px 25px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      gap: 10px;
      border: 1px solid rgba(255,255,255,0.15);
      animation: hotcopyFade 0.2s ease-out;
    `;

    toast.innerHTML = `<span>⚡ <b>HOTCOPY:</b> ${msg}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast && toast.parentElement) {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  }

  /**
   * Injects an interactive Countdown HUD for Assisted Auto-Dispatch
   * @param {Function} onConfirm
   * @param {Function} onCancel
   */
  function showCountdownHUD(onConfirm, onCancel) {
    const existing = document.getElementById('hotcopy-wa-hud');
    if (existing) existing.remove();

    const hud = document.createElement('div');
    hud.id = 'hotcopy-wa-hud';
    hud.style.cssText = `
      position: fixed;
      top: 60px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999999;
      background: #0f172a;
      color: #f8fafc;
      padding: 10px 20px;
      border-radius: 30px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      box-shadow: 0 12px 30px rgba(0,0,0,0.5), 0 0 0 1.5px #10b981;
      display: flex;
      align-items: center;
      gap: 14px;
    `;

    let secondsLeft = 3;
    hud.innerHTML = `
      <span>⚡ <b>HOTCOPY:</b> Auto-dispatching in <b id="hotcopy-wa-timer" style="color: #10b981; font-size: 15px;">${secondsLeft}s</b></span>
      <button id="hotcopy-hud-now" style="background: #10b981; color: #fff; border: none; border-radius: 14px; padding: 4px 10px; font-weight: 600; cursor: pointer; font-size: 11px;">Send Now</button>
      <button id="hotcopy-hud-cancel" style="background: #ef4444; color: #fff; border: none; border-radius: 14px; padding: 4px 10px; font-weight: 600; cursor: pointer; font-size: 11px;">Cancel</button>
    `;

    document.body.appendChild(hud);

    let intervalId;

    const cleanup = () => {
      clearInterval(intervalId);
      if (hud && hud.parentElement) hud.remove();
    };

    hud.querySelector('#hotcopy-hud-now').addEventListener('click', () => {
      cleanup();
      onConfirm();
    });

    hud.querySelector('#hotcopy-hud-cancel').addEventListener('click', () => {
      cleanup();
      onCancel();
    });

    intervalId = setInterval(() => {
      secondsLeft--;
      const timerEl = document.getElementById('hotcopy-wa-timer');
      if (timerEl) timerEl.innerText = `${secondsLeft}s`;

      if (secondsLeft <= 0) {
        cleanup();
        onConfirm();
      }
    }, 1000);
  }

  /**
   * Main inspection and execution loop for pending dispatch
   */
  async function checkPendingDispatch() {
    try {
      const data = await chrome.storage.local.get(['pending_wa_dispatch', 'settings']);
      const pending = data.pending_wa_dispatch;
      const settings = data.settings || {};

      if (settings.masterEnabled === false) return;
      if (!pending) return;

      // Ensure dispatch request is fresh (< 60s old)
      if (Date.now() - pending.requestedAt > 60000) {
        await chrome.storage.local.remove('pending_wa_dispatch');
        return;
      }

      console.log('[HOTCOPY] Pending WhatsApp dispatch detected for:', pending.phone);
      await chrome.storage.local.remove('pending_wa_dispatch');

      // Wait for chat readiness
      const result = await waitForChatReadyOrError(25000);

      if (result.status === 'READY') {
        const autoSend = settings.waAutoSend === true;
        if (autoSend) {
          showCountdownHUD(
            () => {
              const sent = triggerSend();
              if (sent) {
                showToast('Message successfully dispatched!', 'success', 3000);
              } else {
                showToast('Message pre-filled. Please click Send.', 'info', 4000);
              }
            },
            () => {
              showToast('Auto-send cancelled. Message remains pre-filled.', 'info', 3000);
            }
          );
        } else {
          // Assisted Pre-fill mode (Zero-Risk ToS compliant)
          showToast('Client chat opened & message pre-filled. Review and click Send!', 'success', 5000);
          const composeBox = document.querySelector('div[data-testid="conversation-compose-box-input"], footer div[contenteditable="true"]');
          if (composeBox) composeBox.focus();
        }
      } else if (result.status === 'INVALID_NUMBER') {
        showToast('Phone number is not registered on WhatsApp or format is invalid.', 'error', 6000);
      } else if (result.status === 'NOT_LOGGED_IN') {
        showToast('WhatsApp Web is unauthenticated. Please scan QR code to link device.', 'info', 6000);
      } else if (result.status === 'TIMEOUT') {
        showToast('Chat initialization timed out. Please check your connection.', 'error', 4000);
      }
    } catch (err) {
      console.warn('[HOTCOPY] WhatsApp bridge error:', err);
    }
  }

  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkPendingDispatch);
  } else {
    checkPendingDispatch();
  }

  // Also listen for runtime messages directly
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'TRIGGER_WA_SEND') {
      const ok = triggerSend();
      sendResponse({ success: ok });
      return true;
    }
  });

})();
