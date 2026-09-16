// HOTCOPY - WhatsApp Message Templates & Interpolator
(function() {
  'use strict';

  const DEFAULT_TEMPLATES = [
    {
      id: 'welcome',
      label: '🎉 Welcome & Confirmation',
      text: "Hi {FirstName}, thank you for joining! This is {Consultant} from {Branch}. Your {Package} membership (CM#: {CM#}) has been successfully processed. Please let us know if you have any questions!"
    },
    {
      id: 'followup',
      label: '👋 Quick Follow-up',
      text: "Hi {FirstName}, this is {Consultant} from {Branch} following up on your {Package} membership. Hope all is well and we look forward to seeing you!"
    },
    {
      id: 'docs',
      label: '📄 Document Request',
      text: "Hi {FirstName}, this is {Consultant} from {Branch}. Could you kindly share a copy of your ID document to finalize your {Package} file?"
    }
  ];

  /**
   * Normalizes phone numbers to WhatsApp E.164 digits-only format.
   * Handles South Africa (+27, 082...) and international prefixes.
   * @param {string} rawPhone
   * @returns {string|null}
   */
  function normalizePhone(rawPhone) {
    if (!rawPhone || typeof rawPhone !== 'string') return null;

    // Remove parenthetical domestic trunk indicator: +27 (0)82 332 9522 -> +27 82 332 9522
    let cleaned = rawPhone.replace(/\(\s*0\s*\)/g, '');

    // Remove non-digit characters except +
    cleaned = cleaned.trim().replace(/[^\d+]/g, '');

    // Replace 00XX with +XX
    if (cleaned.startsWith('00')) {
      cleaned = '+' + cleaned.slice(2);
    }

    // International +XX format
    if (cleaned.startsWith('+')) {
      const digits = cleaned.slice(1);
      // South Africa domestic zero typo (+27082... -> 2782...)
      if (digits.startsWith('270') && digits.length === 12) {
        return '27' + digits.slice(3);
      }
      return digits.length >= 8 && digits.length <= 15 ? digits : null;
    }

    // Local South African 10-digit number starting with 0 (e.g. 082 123 4567 -> 27821234567)
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      return '27' + cleaned.slice(1);
    }

    // Already 11 digits starting with 27
    if (cleaned.startsWith('27') && cleaned.length === 11) {
      return cleaned;
    }

    // General fallback: digits only between 7 and 15
    if (/^\d{7,15}$/.test(cleaned)) {
      return cleaned;
    }

    return null;
  }

  /**
   * Interpolates profile variables into template text.
   * @param {string} template
   * @param {Object} profile
   * @returns {string}
   */
  function interpolateTemplate(template, profile = {}) {
    if (!template) return '';

    const firstName = profile.firstName || profile.memberName || (profile.fullName ? profile.fullName.split(' ')[0] : 'there');
    const surname = profile.memberSurname || (profile.fullName && profile.fullName.includes(' ') ? profile.fullName.split(' ').slice(1).join(' ') : '');
    const fullName = profile.fullName || [firstName, surname].filter(Boolean).join(' ') || 'Client';
    const cmNumber = profile.cmNumber || profile.memberId || '';
    const branch = profile.branch || 'our club';
    const consultant = profile.consultant || profile.salesConsultant || 'Our Team';
    const pkg = profile.memberType || profile.membershipType || 'membership';
    const date = profile.dateLoaded || new Date().toLocaleDateString();

    return template
      .replace(/\{FirstName\}/gi, firstName)
      .replace(/\{LastName\}/gi, surname)
      .replace(/\{Surname\}/gi, surname)
      .replace(/\{FullName\}/gi, fullName)
      .replace(/\{Name\}/gi, fullName)
      .replace(/\{CM#\}/gi, cmNumber)
      .replace(/\{MemberID\}/gi, cmNumber)
      .replace(/\{Branch\}/gi, branch)
      .replace(/\{Consultant\}/gi, consultant)
      .replace(/\{Package\}/gi, pkg)
      .replace(/\{Membership\}/gi, pkg)
      .replace(/\{Date\}/gi, date);
  }

  // Export to window / extension global
  if (typeof window !== 'undefined') {
    window.HotcopyWhatsApp = {
      DEFAULT_TEMPLATES,
      normalizePhone,
      interpolateTemplate
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      DEFAULT_TEMPLATES,
      normalizePhone,
      interpolateTemplate
    };
  }
})();
