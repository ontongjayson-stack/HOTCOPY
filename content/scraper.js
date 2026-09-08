// HOTCOPY - Profile Scraper & Element Picker

(function () {
  if (window.__edgeAssistantScraperInitialized) return;
  window.__edgeAssistantScraperInitialized = true;

  // Dictionary of known field aliases for intelligent extraction (specific fields ordered first)
  const FIELD_DEFINITIONS = {
    emergencyName: ['emergency contact name', 'emergency contact', 'next of kin name', 'next of kin', 'kin name'],
    emergencyPhone: ['emergency contact number', 'emergency phone', 'emergency cell', 'next of kin phone', 'kin cell'],
    bankName: ['bank name', 'banking institution', 'name of bank'],
    accountNumber: ['account number', 'bank account number', 'acc no', 'account no', 'bank account no'],
    branchCode: ['branch code', 'bank code', 'sort code'],
    accountType: ['account type', 'type of account'],
    salesConsultant: ['sales consultant', 'consultant', 'sales rep', 'advisor', 'agent', 'rep name'],
    membershipType: ['membership type', 'package', 'contract type', 'plan', 'membership option', 'product'],
    memberId: ['membership number', 'member number', 'membership no', 'member id', 'account number', 'client code'],
    clubName: ['home club', 'club', 'branch', 'facility', 'gym'],
    idNumber: ['id number', 'id no', 'identity number', 'id', 'passport number', 'passport no', 'national id', 'rsa id'],
    dob: ['date of birth', 'dob', 'birth date', 'birthdate'],
    age: ['age'],
    gender: ['gender', 'sex'],
    mobilePhone: ['cell phone', 'cell number', 'cellphone', 'mobile number', 'mobile', 'cell', 'contact number', 'phone number', 'phone'],
    homePhone: ['home phone', 'tel home', 'telephone (h)', 'telephone home', 'landline'],
    workPhone: ['work phone', 'tel work', 'telephone (w)', 'telephone work', 'office phone'],
    email: ['email address', 'e-mail address', 'email', 'e-mail'],
    streetAddress: ['street address', 'physical address', 'residential address', 'address line 1', 'address 1', 'street'],
    suburb: ['suburb', 'area', 'neighborhood'],
    city: ['city', 'town'],
    province: ['province', 'state', 'region'],
    postalCode: ['postal code', 'post code', 'zip code', 'zip'],
    firstName: ['first name', 'firstname', 'given name', 'forename'],
    lastName: ['last name', 'lastname', 'surname', 'family name'],
    title: ['title', 'salutation'],
    fullName: ['full name', 'client full name', 'member full name', 'customer name', 'client name', 'member name', 'name']
  };

  // Helper: Clean text
  function clean(text) {
    if (!text) return '';
    return text.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  }

  // Helper: Normalize label for matching
  function normalizeKey(str) {
    return (str || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Scrape structured label-value pairs from the page DOM
  function extractProfileFromDOM() {
    const profile = {};
    const processedElements = new Set();

    // Strategy 1: Find DL / DT / DD definitions
    const dtElements = document.querySelectorAll('dt');
    dtElements.forEach(dt => {
      const dd = dt.nextElementSibling;
      if (dd && dd.tagName.toLowerCase() === 'dd') {
        matchAndAssign(dt.innerText, dd.innerText || dd.textContent, profile);
        processedElements.add(dd);
      }
    });

    // Strategy 2: Find table rows with th/td or td/td
    const rows = document.querySelectorAll('tr');
    rows.forEach(tr => {
      const cells = tr.querySelectorAll('th, td');
      if (cells.length === 2) {
        matchAndAssign(cells[0].innerText, cells[1].innerText, profile);
      } else if (cells.length > 2) {
        for (let i = 0; i < cells.length - 1; i += 2) {
          matchAndAssign(cells[i].innerText, cells[i + 1].innerText, profile);
        }
      }
    });

    // Strategy 3: Standard form labels with inputs or sibling values
    const labels = document.querySelectorAll('label, .label, .field-label, .form-label, [class*="label"], [class*="Label"]');
    labels.forEach(lbl => {
      const labelText = lbl.innerText || lbl.textContent;
      if (!labelText || labelText.length > 60) return;

      let value = '';
      // A: If label has `for` attribute
      const forId = lbl.getAttribute('for');
      if (forId) {
        const target = document.getElementById(forId);
        if (target) {
          value = target.value || target.innerText || target.textContent;
        }
      }

      // B: Check next sibling
      if (!value) {
        let sib = lbl.nextElementSibling;
        while (sib && !value) {
          if (sib.matches('input, select, textarea')) {
            value = sib.value;
          } else if (sib.matches('.value, .form-control-static, [class*="value"], span, div, p')) {
            value = sib.innerText || sib.textContent;
          }
          sib = sib.nextElementSibling;
        }
      }

      // C: Check parent container
      if (!value && lbl.parentElement) {
        const valElem = lbl.parentElement.querySelector('input, select, textarea, .value, .form-control-static, span:not([class*="label"])');
        if (valElem && valElem !== lbl) {
          value = valElem.value !== undefined ? valElem.value : valElem.innerText;
        }
      }

      if (value) {
        matchAndAssign(labelText, value, profile);
      }
    });

    // Strategy 4: Direct inputs with meaningful names/IDs/placeholders
    const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
    inputs.forEach(inp => {
      const val = inp.value;
      if (!val || val.length > 150) return;
      const descriptor = `${inp.getAttribute('name') || ''} ${inp.getAttribute('id') || ''} ${inp.getAttribute('placeholder') || ''} ${inp.getAttribute('data-field') || ''}`;
      matchAndAssign(descriptor, val, profile);
    });

    // Strategy 5: Intelligent Fallback / Regex Discovery on entire body text for critical fields
    const pageText = document.body ? document.body.innerText : '';

    // Email fallback
    if (!profile.email) {
      const emailMatch = pageText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
      if (emailMatch) profile.email = emailMatch[0];
    }

    // South African 13-digit ID or National ID fallback
    if (!profile.idNumber) {
      const idMatch = pageText.match(/\b(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{4}[01]\d{2})\b/);
      if (idMatch) {
        profile.idNumber = idMatch[1];
        // Deduce DOB and Gender from RSA ID if not already captured
        if (!profile.dob && profile.idNumber.length === 13) {
          const yy = profile.idNumber.slice(0, 2);
          const mm = profile.idNumber.slice(2, 4);
          const dd = profile.idNumber.slice(4, 6);
          const currentYearTwoDigits = new Date().getFullYear() % 100;
          const century = parseInt(yy, 10) > currentYearTwoDigits ? '19' : '20';
          profile.dob = `${century}${yy}-${mm}-${dd}`;
        }
        if (!profile.gender && profile.idNumber.length === 13) {
          const genderDigits = parseInt(profile.idNumber.slice(6, 10), 10);
          profile.gender = genderDigits < 5000 ? 'Female' : 'Male';
        }
      }
    }

    // Mobile Phone fallback
    if (!profile.mobilePhone) {
      const phoneMatch = pageText.match(/(?:(?:\+27|0)\s*(?:[1-9]\d{1}|[6-8]\d{1})\s*\d{3}\s*\d{4})/);
      if (phoneMatch) profile.mobilePhone = phoneMatch[0].replace(/\s+/g, '');
    }

    // Split Full Name into First & Last if only Full Name exists, or compose Full Name
    if (!profile.fullName && profile.firstName && profile.lastName) {
      profile.fullName = `${profile.firstName} ${profile.lastName}`.trim();
    } else if (profile.fullName && (!profile.firstName || !profile.lastName)) {
      const parts = profile.fullName.trim().split(/\s+/);
      if (parts.length >= 2) {
        if (!profile.firstName) profile.firstName = parts[0];
        if (!profile.lastName) profile.lastName = parts.slice(1).join(' ');
      }
    }

    return profile;
  }

  // Matches text label to our canonical field keys
  function matchAndAssign(rawLabel, rawValue, profile) {
    const label = normalizeKey(rawLabel);
    const value = clean(rawValue);

    if (!label || !value || value.length > 250) return;

    for (const [key, aliases] of Object.entries(FIELD_DEFINITIONS)) {
      if (profile[key]) continue; // Already set

      for (const alias of aliases) {
        // Exact or strong inclusion match
        if (label === alias || label.startsWith(alias + ' ') || label.endsWith(' ' + alias) || label.includes(' ' + alias + ' ')) {
          profile[key] = value;
          return;
        }
      }
    }
  }

  // Visual toast notification on page
  function showToast(message, type = 'success') {
    let toast = document.getElementById('edge-assistant-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'edge-assistant-toast';
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 2147483647;
        padding: 12px 18px;
        background: ${type === 'error' ? '#ef4444' : '#10b981'};
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 14px;
        font-weight: 600;
        border-radius: 8px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
        display: flex;
        align-items: center;
        gap: 10px;
        transition: all 0.3s ease;
        pointer-events: auto;
      `;
      document.body.appendChild(toast);
    }
    toast.innerHTML = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    clearTimeout(window.__edgeToastTimer);
    window.__edgeToastTimer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        if (toast.parentElement) toast.parentElement.removeChild(toast);
      }, 350);
    }, 4000);
  }

  // Interactive Visual Element Picker
  function startElementPicker() {
    let activeHighlight = null;

    const overlayMsg = document.createElement('div');
    overlayMsg.id = 'edge-picker-indicator';
    overlayMsg.style.cssText = `
      position: fixed;
      top: 15px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483646;
      background: #1e293b;
      color: #f8fafc;
      padding: 10px 20px;
      border-radius: 30px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      font-family: sans-serif;
      font-size: 13px;
      font-weight: 600;
      border: 1px solid #38bdf8;
      pointer-events: none;
    `;
    overlayMsg.innerText = '🔍 HOTCOPY: Click on any detail on the page to capture it (Press Esc to cancel)';
    document.body.appendChild(overlayMsg);

    function onMouseOver(e) {
      if (e.target.closest('#edge-picker-indicator') || e.target.closest('#edge-picker-modal')) return;
      if (activeHighlight) activeHighlight.style.outline = '';
      activeHighlight = e.target;
      activeHighlight.style.outline = '3px solid #38bdf8';
      activeHighlight.style.cursor = 'crosshair';
    }

    function onMouseOut(e) {
      if (e.target && e.target === activeHighlight) {
        e.target.style.outline = '';
      }
    }

    function cleanup() {
      if (activeHighlight) activeHighlight.style.outline = '';
      if (overlayMsg.parentElement) overlayMsg.parentElement.removeChild(overlayMsg);
      document.removeEventListener('mouseover', onMouseOver, true);
      document.removeEventListener('mouseout', onMouseOut, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') cleanup();
    }

    function onClick(e) {
      if (e.target.closest('#edge-picker-indicator') || e.target.closest('#edge-picker-modal')) return;
      e.preventDefault();
      e.stopPropagation();

      const text = clean(e.target.innerText || e.target.value || e.target.textContent);
      cleanup();

      if (!text) {
        showToast('No text found in selected element.', 'error');
        return;
      }

      showPickerAssignmentModal(text);
    }

    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('mouseout', onMouseOut, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
  }

  // Modal to assign picked text to a field
  function showPickerAssignmentModal(pickedText) {
    const existing = document.getElementById('edge-picker-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'edge-picker-modal';
    modal.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 2147483647;
      background: #ffffff;
      color: #0f172a;
      padding: 24px;
      border-radius: 12px;
      box-shadow: 0 20px 30px rgba(0,0,0,0.3);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      width: 380px;
      max-width: 90vw;
      border: 1px solid #e2e8f0;
    `;

    const optionsHtml = Object.keys(FIELD_DEFINITIONS).map(key => {
      const readable = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      return `<option value="${key}">${readable}</option>`;
    }).join('');

    modal.innerHTML = `
      <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 700; color: #1e293b;">Assign Selected Text</h3>
      <p style="margin: 0 0 12px 0; font-size: 13px; color: #64748b;">Selected value:</p>
      <div style="background: #f1f5f9; padding: 10px; border-radius: 6px; font-size: 13px; font-weight: 600; color: #0f172a; margin-bottom: 16px; word-break: break-all;">
        "${pickedText}"
      </div>
      <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 6px;">Assign to Field:</label>
      <select id="edge-field-select" style="width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; margin-bottom: 18px; outline: none;">
        ${optionsHtml}
        <option value="custom">Other / Custom Field...</option>
      </select>
      <div id="edge-custom-field-row" style="display: none; margin-bottom: 16px;">
        <input type="text" id="edge-custom-field-name" placeholder="Enter custom field name..." style="width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; box-sizing: border-box;" />
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 10px;">
        <button id="edge-modal-cancel" style="padding: 8px 16px; background: #f1f5f9; border: none; border-radius: 6px; color: #475569; font-weight: 600; cursor: pointer; font-size: 13px;">Cancel</button>
        <button id="edge-modal-save" style="padding: 8px 16px; background: #0ea5e9; border: none; border-radius: 6px; color: #ffffff; font-weight: 600; cursor: pointer; font-size: 13px;">Save Field</button>
      </div>
    `;

    document.body.appendChild(modal);

    const select = modal.querySelector('#edge-field-select');
    const customRow = modal.querySelector('#edge-custom-field-row');
    const customInput = modal.querySelector('#edge-custom-field-name');

    select.addEventListener('change', () => {
      customRow.style.display = select.value === 'custom' ? 'block' : 'none';
    });

    modal.querySelector('#edge-modal-cancel').addEventListener('click', () => modal.remove());

    modal.querySelector('#edge-modal-save').addEventListener('click', async () => {
      let fieldKey = select.value;
      if (fieldKey === 'custom') {
        fieldKey = customInput.value.trim() || 'customField';
      }

      const { active_profile = {} } = await chrome.storage.local.get('active_profile');
      active_profile[fieldKey] = pickedText;

      await chrome.runtime.sendMessage({
        type: 'PROFILE_CAPTURED',
        profile: active_profile
      });

      modal.remove();
      showToast(`Saved <b>${fieldKey}</b>: "${pickedText}"`);
    });
  }

  // Trigger capture workflow
  async function runScrapeAndSave() {
    const profile = extractProfileFromDOM();
    const count = Object.keys(profile).length;

    if (count === 0) {
      showToast('No profile details found on this page. Try the Element Picker to select manually.', 'error');
      return { success: false, count: 0 };
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'PROFILE_CAPTURED',
        profile: profile
      });

      const clientName = profile.fullName || profile.firstName || 'Client';
      showToast(`✓ <b>HOTCOPY:</b> Captured ${count} details for <b>${clientName}</b>! Ready to paste.`);
      return { success: true, count, profile };
    } catch (err) {
      console.error('[HOTCOPY] Error saving profile:', err);
      showToast('Error saving profile: ' + err.message, 'error');
      return { success: false, error: err.message };
    }
  }

  // Listen for messages from background/popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'TRIGGER_CAPTURE') {
      (async () => {
        const result = await runScrapeAndSave();
        sendResponse(result);
      })();
      return true;
    } else if (message.action === 'START_ELEMENT_PICKER') {
      startElementPicker();
      sendResponse({ status: 'picker_started' });
      return true;
    } else if (message.action === 'EXTRACT_PREVIEW') {
      const profile = extractProfileFromDOM();
      sendResponse({ profile, count: Object.keys(profile).length });
      return true;
    }
  });

  // Expose on window for debugging if needed
  window.__edgeAssistantScraper = {
    extractProfileFromDOM,
    runScrapeAndSave,
    startElementPicker
  };
})();
