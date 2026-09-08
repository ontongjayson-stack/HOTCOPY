// HOTCOPY - Intelligent Autofill & Tab Navigation Engine

(function () {
  if (window.__edgeAssistantAutofillInitialized) return;
  window.__edgeAssistantAutofillInitialized = true;

  let activeProfile = null;
  let userSettings = {
    autoFillOnFocus: true,
    tabJumpNext: true,
    showFloatingWidget: true,
    highlightFilled: true
  };
  let customMappings = {};
  let currentActiveInput = null;
  let currentMatchedField = null;
  let suppressFocusHandling = false;

  // Strict semantic synonyms for field identification (avoiding greedy false-positives)
  const FIELD_SYNONYMS = {
    email: ['email address', 'e-mail address', 'email', 'e-mail', 'mail address'],
    idNumber: ['id number', 'identity number', 'id no', 'national id', 'rsa id', 'sa id', 'passport number', 'passport no', 'passport', 'id/passport', 'identification'],
    mobilePhone: ['cell phone', 'cell number', 'cellphone', 'mobile number', 'mobile phone', 'cellular', 'contact number', 'phone number', 'contact no', 'cell', 'mobile'],
    homePhone: ['home phone', 'tel home', 'telephone (h)', 'telephone home', 'landline'],
    workPhone: ['work phone', 'tel work', 'telephone (w)', 'telephone work', 'office phone'],
    dob: ['date of birth', 'dob', 'birth date', 'birthdate'],
    gender: ['gender', 'sex'],
    streetAddress: ['street address', 'residential address', 'physical address', 'street', 'address line 1', 'address 1', 'home address'],
    suburb: ['suburb', 'neighborhood', 'area', 'district'],
    city: ['city', 'town'],
    province: ['province', 'state', 'region'],
    postalCode: ['postal code', 'post code', 'zip code', 'zip', 'postal'],
    memberId: ['membership number', 'member number', 'membership no', 'member id', 'membership id', 'club id', 'contract number', 'client code'],
    membershipType: ['membership type', 'package', 'package name', 'contract type', 'plan', 'membership option', 'product option'],
    salesConsultant: ['sales consultant', 'consultant', 'sales rep', 'advisor', 'agent', 'sales person', 'consultant name'],
    emergencyName: ['emergency contact name', 'emergency name', 'next of kin name', 'next of kin', 'kin name'],
    emergencyPhone: ['emergency contact number', 'emergency phone', 'emergency cell', 'emergency contact no', 'kin phone', 'kin cell'],
    bankName: ['bank name', 'banking institution', 'name of bank'],
    accountNumber: ['bank account number', 'account number', 'acc no', 'account no', 'bank account no'],
    branchCode: ['branch code', 'bank code', 'sort code'],
    accountType: ['account type', 'type of account'],
    firstName: ['first name', 'firstname', 'given name', 'forename'],
    lastName: ['last name', 'lastname', 'surname', 'family name'],
    fullName: ['full name', 'client full name', 'member full name', 'customer name', 'applicant name', 'candidate name']
  };

  const FIELD_ICONS = {
    fullName: '👤',
    firstName: '👤',
    lastName: '👤',
    title: '🏷️',
    idNumber: '🪪',
    dob: '📅',
    gender: '⚧',
    mobilePhone: '📱',
    homePhone: '📞',
    workPhone: '☎️',
    email: '✉️',
    streetAddress: '🏠',
    suburb: '📍',
    city: '🏙️',
    province: '🗺️',
    postalCode: '📮',
    memberId: '💳',
    clubName: '🏋️',
    membershipType: '📋',
    salesConsultant: '💼',
    emergencyName: '🚨',
    emergencyPhone: '🚨',
    bankName: '🏦',
    accountNumber: '🔢',
    branchCode: '🏢',
    accountType: '💳'
  };

  let dockClosed = false;

  // Initialize from storage
  async function init() {
    try {
      const data = await chrome.storage.local.get(['active_profile', 'settings', 'custom_mappings', 'dock_closed']);
      if (data.active_profile) activeProfile = data.active_profile;
      if (data.settings) userSettings = Object.assign(userSettings, data.settings);
      if (data.custom_mappings) customMappings = data.custom_mappings;
      dockClosed = Boolean(data.dock_closed);

      updateDockUI();
    } catch (e) {
      console.warn('[HOTCOPY] Init error:', e);
    }
  }

  // Real-time storage sync
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes.active_profile) {
      activeProfile = changes.active_profile.newValue || null;
      // When a new profile is captured, re-open the dock
      if (activeProfile && changes.active_profile.oldValue !== activeProfile) {
        dockClosed = false;
      }
      updateDockUI();
    }
    if (changes.dock_closed !== undefined) {
      dockClosed = Boolean(changes.dock_closed.newValue);
      updateDockUI();
    }
    if (changes.settings) {
      userSettings = Object.assign(userSettings, changes.settings.newValue || {});
      updateDockUI();
    }
    if (changes.custom_mappings) {
      customMappings = changes.custom_mappings.newValue || {};
    }
  });

  // Precise contextual clue extraction (prevents container leakage)
  function getElementClues(el) {
    const clues = [];

    // 1. Direct label via for attribute
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label && label.innerText) clues.push(label.innerText);
    }

    // 2. Enclosing label
    const parentLabel = el.closest('label');
    if (parentLabel && parentLabel.innerText) clues.push(parentLabel.innerText);

    // 3. Placeholder
    const placeholder = el.getAttribute('placeholder');
    if (placeholder) clues.push(placeholder);

    // 4. ARIA label
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) clues.push(ariaLabel);

    const ariaLabelledBy = el.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const ref = document.getElementById(ariaLabelledBy);
      if (ref && ref.innerText) clues.push(ref.innerText);
    }

    // 5. Name and ID attributes
    const name = el.getAttribute('name');
    if (name) clues.push(name);
    if (el.id) clues.push(el.id);

    // 6. Title attribute
    const title = el.getAttribute('title');
    if (title) clues.push(title);

    // 7. Table column header (for spreadsheet style forms)
    const td = el.closest('td');
    if (td && td.parentElement) {
      const colIndex = Array.from(td.parentElement.children).indexOf(td);
      const table = td.closest('table');
      if (table) {
        const thList = table.querySelectorAll('thead th, tr:first-child th');
        if (thList && thList[colIndex]) {
          clues.push(thList[colIndex].innerText);
        }
      }
    }

    // 8. Immediate previous sibling
    let prev = el.previousElementSibling;
    if (prev && prev.matches('label, span, div, strong, b')) {
      const txt = (prev.innerText || prev.textContent || '').trim();
      if (txt && txt.length < 40) clues.push(txt);
    }

    // 9. Immediate parent ONLY if parent has no other input siblings
    if (el.parentElement && el.parentElement !== document.body && el.parentElement.tagName.toLowerCase() !== 'form') {
      const siblingInputs = el.parentElement.querySelectorAll('input, select, textarea');
      if (siblingInputs.length === 1) {
        const directLabel = el.parentElement.querySelector('label, [class*="label"]');
        if (directLabel && directLabel !== el && directLabel.innerText) {
          clues.push(directLabel.innerText);
        }
      }
    }

    return clues.join(' ').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Find best matching profile field with strict confidence check
  function findBestMatch(elementClues) {
    if (!activeProfile || !elementClues) return null;

    // Check custom mappings first
    for (const [customField, customKeywords] of Object.entries(customMappings)) {
      if (activeProfile[customField]) {
        for (const kw of customKeywords) {
          const normKw = kw.toLowerCase().trim();
          if (elementClues === normKw || elementClues.includes(normKw)) {
            return { field: customField, value: activeProfile[customField], score: 100 };
          }
        }
      }
    }

    let bestField = null;
    let highestScore = 0;

    // Check standard fields in priority order
    for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS)) {
      const val = activeProfile[field];
      if (!val) continue;

      for (const syn of synonyms) {
        // Exact match gets top score
        if (elementClues === syn) {
          return { field, value: val, score: 95 };
        }

        // Substring / word boundary check
        const regex = new RegExp(`\\b${syn}\\b`, 'i');
        if (regex.test(elementClues)) {
          // Special safeguard: prevent 'fullName' matching if clue also has words for other fields
          if (field === 'fullName') {
            if (/\b(first|last|surname|bank|emergency|kin|rep|consultant|package|plan|user|file)\b/i.test(elementClues)) {
              continue;
            }
          }

          const score = syn.length > 5 ? 85 : 75;
          if (score > highestScore) {
            highestScore = score;
            bestField = { field, value: val, score };
          }
        }
      }
    }

    // Also check generic 'name' keyword if no other field claimed it
    if (!bestField && /\bname\b/i.test(elementClues)) {
      if (!/\b(bank|emergency|kin|rep|consultant|package|file)\b/i.test(elementClues)) {
        if (activeProfile.fullName) {
          return { field: 'fullName', value: activeProfile.fullName, score: 75 };
        }
      }
    }

    return highestScore >= 70 ? bestField : null;
  }

  // Reliable field value setter for modern frameworks
  function setFieldValue(el, value) {
    if (!el || value === undefined || value === null) return;

    if (el.tagName.toLowerCase() === 'select') {
      let matched = false;
      const targetStr = String(value).toLowerCase().trim();

      for (let i = 0; i < el.options.length; i++) {
        const opt = el.options[i];
        if (opt.value.toLowerCase().trim() === targetStr || opt.text.toLowerCase().trim() === targetStr) {
          el.selectedIndex = i;
          matched = true;
          break;
        }
      }

      if (!matched) {
        for (let i = 0; i < el.options.length; i++) {
          const opt = el.options[i];
          if (opt.text.toLowerCase().includes(targetStr) || targetStr.includes(opt.text.toLowerCase())) {
            el.selectedIndex = i;
            break;
          }
        }
      }
    } else {
      // Input or Textarea
      const proto = el.tagName.toLowerCase() === 'textarea'
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;

      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) {
        desc.set.call(el, value);
      } else {
        el.value = value;
      }
    }

    // Dispatch DOM events
    el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));

    if (userSettings.highlightFilled) {
      el.classList.add('edge-field-autofilled');
    }
  }

  // Remove existing dropdown and tooltip
  function removeDropdown() {
    const dropdown = document.getElementById('edge-field-dropdown');
    if (dropdown) dropdown.remove();
  }

  function removeInlineBadge() {
    const badge = document.getElementById('edge-inline-assistant');
    if (badge) badge.remove();
  }

  // Show mini inline confirmation badge
  function showInlineMiniBadge(el, fieldName, fieldValue) {
    removeInlineBadge();

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const badge = document.createElement('div');
    badge.id = 'edge-inline-assistant';

    const readable = fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

    badge.innerHTML = `
      <span class="edge-pill-badge">✓</span>
      <span class="edge-pill-label">${readable}:</span>
      <span class="edge-pill-value" title="${fieldValue}">"${fieldValue}"</span>
      <span class="edge-pill-hint">
        <span class="edge-kbd">Tab</span> Next
      </span>
    `;

    document.body.appendChild(badge);
    const badgeRect = badge.getBoundingClientRect();

    let top = rect.top + window.scrollY - badgeRect.height - 6;
    let left = rect.left + window.scrollX;

    if (top < window.scrollY + 5) {
      top = rect.bottom + window.scrollY + 6;
    }

    badge.style.top = `${top}px`;
    badge.style.left = `${left}px`;

    setTimeout(() => {
      removeInlineBadge();
    }, 3500);
  }

  // Display the smart interactive dropdown menu under the active field
  function showFieldDropdown(el, matchedFieldKey = null) {
    if (!activeProfile) return;
    removeDropdown();

    const rect = el.getBoundingClientRect();
    const dropdown = document.createElement('div');
    dropdown.id = 'edge-field-dropdown';

    const clientName = activeProfile.fullName || activeProfile.firstName || 'Client Profile';

    let itemsHtml = '';
    for (const [key, val] of Object.entries(activeProfile)) {
      if (key.startsWith('_') || !val || typeof val !== 'string') continue;

      const isMatched = (key === matchedFieldKey);
      const readable = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      const icon = FIELD_ICONS[key] || '📋';

      itemsHtml += `
        <div class="edge-dropdown-item ${isMatched ? 'matched' : ''}" data-field="${key}" data-value="${encodeURIComponent(val)}">
          <div class="edge-dropdown-left">
            <span class="item-key">
              ${icon} ${readable}
              ${isMatched ? '<span class="item-tag">Auto-match</span>' : ''}
            </span>
          </div>
          <span class="item-val" title="${val}">${val}</span>
        </div>
      `;
    }

    if (!itemsHtml) return;

    dropdown.innerHTML = `
      <div class="edge-dropdown-header">
        <div class="edge-dropdown-header-brand">
          <span>HOTCOPY</span>
          <span class="edge-dropdown-header-tag">• Click detail to fill</span>
        </div>
        <span style="font-size: 10px; color: #94a3b8;">${clientName}</span>
      </div>
      <div class="edge-dropdown-list">
        ${itemsHtml}
      </div>
    `;

    document.body.appendChild(dropdown);
    const dropRect = dropdown.getBoundingClientRect();

    let top = rect.bottom + window.scrollY + 5;
    let left = rect.left + window.scrollX;

    // Flip to top if bottom runs out of screen space
    if (top + dropRect.height > window.innerHeight + window.scrollY - 10) {
      top = rect.top + window.scrollY - dropRect.height - 5;
    }

    // Clamp horizontal position
    if (left + dropRect.width > window.innerWidth - 15) {
      left = window.innerWidth - dropRect.width - 15;
    }
    if (left < 10) left = 10;

    dropdown.style.top = `${top}px`;
    dropdown.style.left = `${left}px`;

    // Click handler for dropdown items
    dropdown.querySelectorAll('.edge-dropdown-item').forEach(item => {
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const fieldKey = item.getAttribute('data-field');
        const fieldVal = decodeURIComponent(item.getAttribute('data-value'));

        // Prevent focus loop from overwriting this value
        suppressFocusHandling = true;
        el.__edgeUserFilled = true;
        currentMatchedField = fieldKey;

        setFieldValue(el, fieldVal);
        removeDropdown();

        el.focus();
        showInlineMiniBadge(el, fieldKey, fieldVal);
      });
    });
  }

  // Find next focusable input in form order
  function getNextFormInput(currentEl) {
    const selector = 'input:not([type="hidden"]):not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled])';
    const form = currentEl.closest('form') || document.body;
    const elements = Array.from(form.querySelectorAll(selector)).filter(el => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && el.type !== 'submit' && el.type !== 'button';
    });

    const currentIndex = elements.indexOf(currentEl);
    if (currentIndex !== -1 && currentIndex < elements.length - 1) {
      return elements[currentIndex + 1];
    }
    return null;
  }

  // Handle click / focus on form elements
  function handleElementInteraction(e) {
    const el = e.target;
    if (!el || !el.matches || !el.matches('input, select, textarea')) return;
    if (el.type === 'hidden' || el.type === 'submit' || el.type === 'button') return;

    currentActiveInput = el;

    // If suppressed (e.g. user just clicked a dropdown item), do not overwrite
    if (suppressFocusHandling) {
      suppressFocusHandling = false;
      return;
    }

    if (!activeProfile) return;

    const clues = getElementClues(el);
    const match = findBestMatch(clues);

    if (match) {
      currentMatchedField = match.field;
      // Only auto-fill if not already manually filled by the user
      if (userSettings.autoFillOnFocus && !el.__edgeUserFilled) {
        setFieldValue(el, match.value);
      }
      showFieldDropdown(el, match.field);
    } else {
      currentMatchedField = null;
      showFieldDropdown(el, null);
    }
  }

  // Handle keyboard events (Tab to advance, Esc to close)
  function handleKeyDown(e) {
    const el = e.target;
    if (!el || el !== currentActiveInput) return;

    if (e.key === 'Tab' && !e.shiftKey) {
      // User pressed TAB: finalize current field and advance to next field
      if (userSettings.tabJumpNext) {
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));

        const nextEl = getNextFormInput(el);
        if (nextEl) {
          e.preventDefault();
          removeDropdown();
          removeInlineBadge();

          nextEl.focus();
        }
      }
    } else if (e.key === 'Escape') {
      removeDropdown();
      removeInlineBadge();
    }
  }

  // Autofill all detected fields across the form
  function autofillAllFields() {
    if (!activeProfile) {
      alert('HOTCOPY: No client profile captured yet. Please capture a profile first.');
      return;
    }

    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled])');
    let filledCount = 0;

    inputs.forEach(el => {
      if (el.type === 'submit' || el.type === 'button') return;
      const clues = getElementClues(el);
      const match = findBestMatch(clues);
      if (match) {
        setFieldValue(el, match.value);
        filledCount++;
      }
    });

    const dock = document.getElementById('edge-assistant-dock');
    if (dock) {
      const meta = dock.querySelector('.dock-meta');
      if (meta) {
        const orig = meta.innerText;
        meta.innerText = `✓ Filled ${filledCount} fields!`;
        meta.style.color = '#10b981';
        setTimeout(() => {
          meta.innerText = orig;
          meta.style.color = '#38bdf8';
        }, 3000);
      }
    }
  }

  // Enable smooth dragging for the floating dock
  function makeDraggable(el) {
    const handle = el.querySelector('.dock-drag-handle');
    if (!handle) return;

    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    handle.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = el.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      el.style.bottom = 'auto';
      el.style.right = 'auto';
      el.style.left = `${initialLeft}px`;
      el.style.top = `${initialTop}px`;

      const onMouseMove = (ev) => {
        if (!isDragging) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        let newX = Math.max(10, Math.min(window.innerWidth - el.offsetWidth - 10, initialLeft + dx));
        let newY = Math.max(10, Math.min(window.innerHeight - el.offsetHeight - 10, initialTop + dy));

        el.style.left = `${newX}px`;
        el.style.top = `${newY}px`;
      };

      const onMouseUp = () => {
        isDragging = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  // Floating dock: Always visible and on top across all pages once activated
  function updateDockUI() {
    let dock = document.getElementById('edge-assistant-dock');

    // Only mount on top frame or large viewports to avoid tiny hidden iframes
    const isMainViewport = (window.self === window.top) || (window.innerWidth > 350 && window.innerHeight > 250);
    if (!isMainViewport) return;

    if (!userSettings.showFloatingWidget || !activeProfile || dockClosed) {
      if (dock) dock.remove();
      return;
    }

    const clientName = activeProfile.fullName || activeProfile.firstName || 'Client Profile';
    const fieldCount = Object.keys(activeProfile).filter(k => !k.startsWith('_')).length;
    const logoUrl = chrome.runtime.getURL('icons/icon-32.png');

    if (!dock) {
      dock = document.createElement('div');
      dock.id = 'edge-assistant-dock';
      document.body.appendChild(dock);
      makeDraggable(dock);
    }

    dock.innerHTML = `
      <div class="dock-drag-handle" title="Drag to move floating window">⠿</div>
      <img class="dock-logo" src="${logoUrl}" alt="Logo" />
      <div class="dock-info">
        <span class="dock-name" title="${clientName}">${clientName}</span>
        <span class="dock-meta">${fieldCount} details active</span>
      </div>
      <div class="dock-actions">
        <button class="dock-btn primary" id="edge-dock-fill-all" title="Autofill all mapped fields on this form">
          ⚡ Fill All
        </button>
        <button class="dock-btn" id="edge-dock-pick" title="Open values menu">
          📋 Values
        </button>
        <button class="dock-btn close-btn" id="edge-dock-close" title="Close floating window">
          ✕
        </button>
      </div>
    `;

    dock.querySelector('#edge-dock-fill-all').addEventListener('click', () => autofillAllFields());

    dock.querySelector('#edge-dock-pick').addEventListener('click', (e) => {
      e.stopPropagation();
      const target = currentActiveInput || document.querySelector('input:not([type="hidden"]), select, textarea');
      if (target) {
        target.focus();
        showFieldDropdown(target, currentMatchedField);
      } else {
        alert('Please click into a form field first.');
      }
    });

    dock.querySelector('#edge-dock-close').addEventListener('click', async (e) => {
      e.stopPropagation();
      dockClosed = true;
      await chrome.storage.local.set({ dock_closed: true });
      if (dock) dock.remove();
    });
  }

  // Listeners
  document.addEventListener('focusin', handleElementInteraction, true);
  document.addEventListener('click', (e) => {
    // If click on an input element, handleElementInteraction will run
    if (e.target.matches && e.target.matches('input, select, textarea')) {
      handleElementInteraction(e);
      return;
    }

    // Dismiss dropdown if clicking outside dropdown and outside dock
    if (!e.target.closest('#edge-field-dropdown') && !e.target.closest('#edge-assistant-dock')) {
      removeDropdown();
    }
  }, true);

  document.addEventListener('keydown', handleKeyDown, true);

  // Message listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'TRIGGER_AUTOFILL_ALL') {
      autofillAllFields();
      sendResponse({ status: 'autofill_completed' });
      return true;
    }
  });

  // Start
  init();
})();
