// HOTCOPY - Profile Scraper & Element Picker

(function () {
  if (window.__edgeAssistantScraperInitialized) return;
  window.__edgeAssistantScraperInitialized = true;

  // Dictionary of known field aliases for intelligent extraction (specific fields ordered first)
  // Dictionary of known field aliases for intelligent extraction (specific fields ordered first)
  const FIELD_DEFINITIONS = {
    dateLoaded: ['date loaded', 'date_loaded', 'dateloaded', 'loaded date'],
    branch: ['branch', 'home club', 'club', 'facility', 'gym'],
    consultant: ['consultant', 'sales consultant', 'advisor', 'agent', 'sales rep', 'rep'],
    cmNumber: ['cm#', 'cm no', 'cm number', 'cm', 'customer id', 'member id', 'membership number', 'membership no', 'client code', 'client id'],
    memberName: ['member name', 'first name', 'firstname', 'given name', 'forename'],
    memberSurname: ['member surname', 'surname', 'last name', 'lastname', 'family name'],
    contactNumber: ['contact#', 'contact number', 'contact no', 'mobile number', 'mobile phone', 'mobile', 'cell phone', 'cell number', 'cellphone', 'cell'],
    emailAddress: ['email address', 'e-mail address', 'email', 'e-mail', 'mail address'],
    source: ['source', 'lead source', 'referral source'],
    outcome: ['outcome', 'result', 'sales outcome'],
    memberType: ['member type', 'membership type', 'package', 'contract type', 'plan', 'membership option', 'product'],
    period: ['period', 'duration', 'term', 'months'],
    value: ['value', 'amount', 'price', 'fee', 'cost', 'paid'],
    firstDoDate: ['1st d/o date', '1st do date', 'first do date', 'd/o date', 'debit order date', 'first debit order date', 'start date'],
    notes: ['notes', 'note', 'comments', 'comment', 'remarks', 'access number'],
    idNumber: ['id number', 'id no', 'identity number', 'id', 'passport number', 'passport no', 'national id', 'rsa id'],
    dob: ['date of birth', 'dob', 'birth date', 'birthdate'],
    age: ['age'],
    gender: ['gender', 'sex'],
    homePhone: ['home phone', 'tel home', 'telephone (h)', 'telephone home', 'landline'],
    workPhone: ['work phone', 'tel work', 'telephone (w)', 'telephone work', 'office phone'],
    streetAddress: ['street address', 'physical address', 'residential address', 'address line 1', 'address 1', 'street'],
    suburb: ['suburb', 'area', 'neighborhood'],
    city: ['city', 'town'],
    province: ['province', 'state', 'region'],
    postalCode: ['postal code', 'post code', 'zip code', 'zip'],
    emergencyName: ['emergency contact name', 'emergency contact', 'next of kin name', 'next of kin', 'kin name'],
    emergencyPhone: ['emergency contact number', 'emergency phone', 'emergency cell', 'next of kin phone', 'kin cell'],
    bankName: ['bank name', 'banking institution', 'name of bank'],
    accountNumber: ['account number', 'bank account number', 'acc no', 'account no', 'bank account no'],
    branchCode: ['branch code', 'bank code', 'sort code'],
    accountType: ['account type', 'type of account'],
    fullName: ['full name', 'client full name', 'member full name', 'customer name', 'client name', 'name']
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

  // Format Date as YYYY-MM-DD
  function formatDateYYYYMMDD(d) {
    if (!d || isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Parse various date strings (e.g. "Monday, 14 September 2026" or "1984/07/26")
  function parseToYYYYMMDD(dateStr) {
    if (!dateStr) return '';
    const cleanStr = dateStr.replace(/^[A-Za-z]+,\s*/, '').trim();
    const parsed = new Date(cleanStr);
    if (!isNaN(parsed.getTime())) {
      return formatDateYYYYMMDD(parsed);
    }
    const slashParts = cleanStr.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (slashParts) {
      return `${slashParts[1]}-${slashParts[2].padStart(2, '0')}-${slashParts[3].padStart(2, '0')}`;
    }
    return '';
  }

  // Intelligent split of name into Member Name (forenames) and Member Surname
  function splitFullName(rawName) {
    if (!rawName) return { memberName: '', memberSurname: '' };

    let cleanName = rawName.replace(/^(?:MR|MRS|MS|MISS|DR|PROF|REV|PASTOR)\.?\s+/i, '').trim();
    cleanName = cleanName.replace(/\s*\(\d+\)\s*$/, '').trim();

    const parts = cleanName.split(/\s+/);
    if (parts.length <= 1) {
      return { memberName: cleanName, memberSurname: '' };
    }

    const surnamePrefixes = [
      'van der merwe', 'van der walt', 'van der westhuizen', 'van der linde', 'van der berg',
      'van der', 'van den', 'van de', 'van eerden', 'van eeden', 'van dyk', 'van wyk',
      'van zyl', 'van niekerk', 'van staden', 'van rooyen', 'van heerden', 'van vuuren',
      'van rensburg', 'janse van rensburg', 'du plessis', 'du toit', 'du preez', 'du randt',
      'de villiers', 'de beer', 'de klerk', 'de wet', 'de jager', 'de bruyn', 'de kock',
      'de', 'du', 'le roux', 'le', 'la', 'von', 'del'
    ];

    const lowerName = cleanName.toLowerCase();
    for (const prefix of surnamePrefixes) {
      const target = ' ' + prefix;
      const idx = lowerName.lastIndexOf(target);
      if (idx !== -1) {
        const forename = cleanName.slice(0, idx).trim();
        const surname = cleanName.slice(idx + 1).trim();
        if (forename && surname) {
          return { memberName: forename, memberSurname: surname };
        }
      }
    }

    const surname = parts[parts.length - 1];
    const forename = parts.slice(0, parts.length - 1).join(' ');
    return { memberName: forename, memberSurname: surname };
  }

  // Dedicated extractor for the Member Details page structure
  function extractFromMemberDetailsPage() {
    const profile = {};

    // 1. CM# (Customer ID): Located directly in #leftColumn h2 small
    // Strictly preserve prefix word (like "JEF" or "EDGE") and digits intact e.g. "JEF33350"
    const cmSmall = document.querySelector('#leftColumn h2 small, h2 small');
    if (cmSmall) {
      const cmText = clean(cmSmall.innerText || cmSmall.textContent);
      if (cmText) {
        profile.cmNumber = cmText;
      }
    }
    if (!profile.cmNumber) {
      const leftCol = document.getElementById('leftColumn');
      if (leftCol) {
        const match = leftCol.innerText.match(/\b((?:JEF|EDGE|[A-Z]{3,4})\d{4,8}|\d{5,10})\b/i);
        if (match) profile.cmNumber = match[1];
      }
    }

    // 2. Member Name & Member Surname: From #leftColumn h2 or .title h1
    let rawNameText = '';
    const h2Elem = document.querySelector('#leftColumn h2');
    if (h2Elem) {
      const clone = h2Elem.cloneNode(true);
      const smallTags = clone.querySelectorAll('small');
      smallTags.forEach(s => s.remove());
      rawNameText = clean(clone.innerText || clone.textContent);
    }
    if (!rawNameText) {
      const titleH1 = document.querySelector('.title h1');
      if (titleH1) rawNameText = clean(titleH1.innerText || titleH1.textContent);
    }

    if (rawNameText) {
      const { memberName, memberSurname } = splitFullName(rawNameText);
      profile.memberName = memberName;
      profile.memberSurname = memberSurname;
      profile.fullName = [memberName, memberSurname].filter(Boolean).join(' ');
    }

    // 3. Contact# (Mobile / Telephone): From #member-contact
    const contactBlock = document.getElementById('member-contact');
    if (contactBlock) {
      const pElements = contactBlock.querySelectorAll('p');
      pElements.forEach(p => {
        const txt = p.innerText || p.textContent || '';
        if (/Mobile:/i.test(txt) && !profile.contactNumber) {
          const numMatch = txt.replace(/Mobile:/i, '').match(/(?:\+27|0)\d{9}/);
          if (numMatch) {
            profile.contactNumber = numMatch[0];
          } else {
            const rawVal = clean(txt.replace(/Mobile:/i, ''));
            if (rawVal) profile.contactNumber = rawVal.replace(/[^\d+]/g, '');
          }
        } else if (/Telephone:/i.test(txt) && !profile.contactNumber) {
          const numMatch = txt.replace(/Telephone:/i, '').match(/(?:\+27|0)\d{9}/);
          if (numMatch) {
            profile.contactNumber = numMatch[0];
          } else {
            const rawVal = clean(txt.replace(/Telephone:/i, ''));
            if (rawVal) profile.contactNumber = rawVal.replace(/[^\d+]/g, '');
          }
        } else if (/Email:/i.test(txt) && !profile.emailAddress) {
          // 4. Email Address: First email if semicolon or comma separated
          const rawEmail = clean(txt.replace(/Email:/i, ''));
          const firstEmail = rawEmail.split(/[;,]/)[0].trim();
          if (firstEmail) profile.emailAddress = firstEmail;
        } else if (/DOB:/i.test(txt) && !profile.dob) {
          const match = txt.match(/\b\d{4}[/-]\d{2}[/-]\d{2}\b/);
          if (match) profile.dob = match[0].replace(/\//g, '-');
        } else if (/Address:/i.test(txt)) {
          const addrLines = p.innerText.replace(/Address:\s*/i, '').split('\n').map(s => s.trim()).filter(Boolean);
          if (addrLines.length > 0) {
            profile.streetAddress = addrLines.slice(0, Math.max(1, addrLines.length - 3)).join(', ');
            if (addrLines.length >= 2) {
              const lastLine = addrLines[addrLines.length - 1];
              if (/^\d{4}$/.test(lastLine)) {
                profile.postalCode = lastLine;
                if (addrLines.length >= 3) profile.province = addrLines[addrLines.length - 2];
                if (addrLines.length >= 4) profile.city = addrLines[addrLines.length - 3];
              }
            }
          }
        }
      });
    }

    // 5. Date Loaded: Auto-generated current date in YYYY-MM-DD
    profile.dateLoaded = formatDateYYYYMMDD(new Date());

    // 6. Branch: From Google Analytics or selectors
    const pageScripts = Array.from(document.querySelectorAll('script')).map(s => s.textContent || '').join('\n');
    const branchGaMatch = pageScripts.match(/ga\s*\(\s*['"]set['"]\s*,\s*['"]Branch['"]\s*,\s*['"]([^'"]+)['"]\s*\)/i);
    if (branchGaMatch) {
      profile.branch = branchGaMatch[1].trim();
    } else {
      const branchOption = document.querySelector('select#Branch option[selected], option[value*="CLUB -"]');
      if (branchOption) {
        profile.branch = clean(branchOption.innerText || branchOption.textContent).replace(/^CLUB\s*-\s*/i, '');
      }
    }

    // 7. Consultant: From GA User or headerLinks logged-in user
    const consultantGaMatch = pageScripts.match(/ga\s*\(\s*['"]set['"]\s*,\s*['"]User['"]\s*,\s*['"]([^'"]+)['"]\s*\)/i);
    const headerUser = document.querySelector('#headerLinks li:first-child');
    if (headerUser && headerUser.innerText && !headerUser.querySelector('a')) {
      const userParts = clean(headerUser.innerText).split(/\s+/);
      profile.consultant = userParts[0].charAt(0).toUpperCase() + userParts[0].slice(1).toLowerCase();
    } else if (consultantGaMatch) {
      const rawUser = consultantGaMatch[1].split('.')[0];
      profile.consultant = rawUser.charAt(0).toUpperCase() + rawUser.slice(1).toLowerCase();
    }

    // 8. Active Membership Details (Member Type, Period, Value, 1st D/O Date)
    const activeMembership = document.querySelector('.membershipDetail:not(.membershipFinishedCancelled)');
    if (activeMembership) {
      const pkgLink = activeMembership.querySelector('h3 a:not(.action)');
      if (pkgLink) {
        profile.memberType = clean(pkgLink.innerText || pkgLink.textContent);
      }

      if (profile.memberType) {
        const periodMatch = profile.memberType.match(/(\d+)\s*(MONTH|YEAR|WEEK|DAY)S?/i);
        if (periodMatch) {
          const unit = periodMatch[2].charAt(0).toUpperCase() + periodMatch[2].slice(1).toLowerCase();
          profile.period = `${periodMatch[1]} ${unit}`;
        }
      }

      const paidMatch = activeMembership.innerText.match(/Paid:\s*R?\s*([0-9.,]+)/i);
      if (paidMatch) {
        let valStr = paidMatch[1].replace(/\s+/g, '').replace(',', '.');
        profile.value = valStr;
      }

      const startMatch = activeMembership.innerText.match(/Start:\s*([^\r\n<]+)/i);
      if (startMatch) {
        const parsedDate = parseToYYYYMMDD(startMatch[1]);
        if (parsedDate) profile.firstDoDate = parsedDate;
      }
    }

    // 9. Notes: From .memberNotes or access number
    const notesElem = document.querySelector('.memberNotes');
    if (notesElem) {
      profile.notes = clean(notesElem.innerText || notesElem.textContent);
    } else {
      const accessElem = document.querySelector('#communicationMemberBar h3.filter');
      if (accessElem) profile.notes = clean(accessElem.innerText || accessElem.textContent);
    }

    // 10. ID Number: From .title h1 strong.grey
    const idElem = document.querySelector('.title h1 strong.grey');
    if (idElem) {
      const idMatch = idElem.innerText.match(/\b\d{13}\b/);
      if (idMatch) profile.idNumber = idMatch[0];
    }

    // Provide friendly canonical aliases
    if (profile.cmNumber) {
      profile.cm = profile.cmNumber;
      profile.memberId = profile.cmNumber;
    }
    if (profile.contactNumber) {
      profile.mobilePhone = profile.contactNumber;
      profile.contact = profile.contactNumber;
    }
    if (profile.emailAddress) {
      profile.email = profile.emailAddress;
    }
    if (profile.memberType) {
      profile.membershipType = profile.memberType;
    }
    if (profile.consultant) {
      profile.salesConsultant = profile.consultant;
    }

    return profile;
  }

  // Scrape structured label-value pairs from the page DOM
  function extractProfileFromDOM() {
    // Check if on Member Details page first
    const isMemberPage = Boolean(
      document.querySelector('#leftColumn h2') ||
      document.querySelector('.membershipDetail') ||
      document.querySelector('#member-contact') ||
      (document.title && document.title.includes('Member Details'))
    );

    let profile = {};
    if (isMemberPage) {
      profile = extractFromMemberDetailsPage();
    }

    // If core fields found, return immediately
    if (profile.cmNumber || profile.memberName || profile.contactNumber) {
      return profile;
    }

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

      const clientName = profile.fullName || [profile.memberName, profile.memberSurname].filter(Boolean).join(' ') || 'Client';
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
    extractFromMemberDetailsPage,
    runScrapeAndSave,
    startElementPicker
  };
})();
