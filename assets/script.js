// Crikle hiring site — production application behaviour
// Browser → Google Apps Script Web App → Google Sheet + email

const APPLICATION_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzMT_UJK0yW7JAIRgH38Wd65ezsX0iCWMcHpllXL_t_VBgAyE6hiYCjngWfnsMdCP14/exec';
const DRAFT_KEY = 'crikle_application_draft_v2';
const VERIFY_COOLDOWN_MS = 30000;

const $ = (sel, root = document) => root.querySelector(sel);

window.addEventListener('DOMContentLoaded', () => {
  const toggle = $('.nav-toggle');
  const links = $('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', links.classList.contains('open'));
    });
    links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => links.classList.remove('open')));
  }

  const form = $('#apply-form');
  if (form) initApplyForm(form);
});

function initApplyForm(form) {
  const banner = $('#form-status');
  const submitButton = form.querySelector('button[type="submit"]');
  const honeypot = form.querySelector('[name="website"]');
  const emailInput = $('#email');
  const verifyEmailBtn = $('#verify-email-btn');
  const verificationBox = $('#email-verification-box');
  const verificationMessage = $('#email-verification-message');
  const emailVerified = $('#email_verified');
  const verificationToken = $('#email_verification_token');

  let verificationEmail = '';
  let cooldownTimer = null;

  function showBanner(type, msg) {
    if (!banner) return;
    banner.textContent = msg;
    banner.classList.remove('error');
    if (type === 'error') banner.classList.add('error');
    banner.classList.add('show');
  }

  function setVerificationMessage(msg, isError = false) {
    if (!verificationMessage) return;
    verificationMessage.textContent = msg;
    verificationMessage.style.color = isError ? '#B42318' : 'var(--ink-soft)';
  }

  function validEmailFormat(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }

  function saveDraft() {
    try {
      const data = {};
      for (const el of form.elements) {
        if (!el.name || el.name === 'website' || el.type === 'submit' || el.type === 'button') continue;
        if (el.type === 'radio' || el.type === 'checkbox') {
          if (el.checked) data[el.name] = el.value;
        } else {
          data[el.name] = el.value;
        }
      }
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function restoreDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      Object.entries(data).forEach(([name, value]) => {
        const fields = form.querySelectorAll(`[name="${CSS.escape(name)}"]`);
        fields.forEach(field => {
          if (field.type === 'radio' || field.type === 'checkbox') {
            field.checked = field.value === value;
          } else {
            field.value = value;
          }
        });
      });
    } catch (_) {}
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
  }

  function resetEmailVerification(message = '') {
    verificationEmail = '';
    if (emailVerified) emailVerified.value = 'false';
    if (verificationToken) verificationToken.value = '';
    if (verificationBox) verificationBox.style.display = message ? 'block' : 'none';
    if (verifyEmailBtn) {
      verifyEmailBtn.disabled = false;
      verifyEmailBtn.textContent = 'Verify email';
    }
    if (message) setVerificationMessage(message);
  }

  function startCooldown() {
    if (!verifyEmailBtn) return;
    const until = Date.now() + VERIFY_COOLDOWN_MS;
    const tick = () => {
      const left = Math.max(0, until - Date.now());
      if (!left) {
        verifyEmailBtn.disabled = false;
        verifyEmailBtn.textContent = 'Resend verification';
        return;
      }
      verifyEmailBtn.disabled = true;
      verifyEmailBtn.textContent = `Resend in ${Math.ceil(left / 1000)}s`;
      cooldownTimer = setTimeout(tick, 500);
    };
    clearTimeout(cooldownTimer);
    tick();
  }

  restoreDraft();

  emailInput?.addEventListener('input', () => {
    const current = emailInput.value.trim().toLowerCase();
    if (verificationEmail && current !== verificationEmail) {
      resetEmailVerification('Email changed. Please verify the new address.');
    }
    saveDraft();
  });

  form.addEventListener('input', saveDraft);
  form.addEventListener('change', saveDraft);

  verifyEmailBtn?.addEventListener('click', () => {
    const email = emailInput.value.trim().toLowerCase();
    if (!validEmailFormat(email)) {
      showBanner('error', 'Please enter a valid email address first.');
      emailInput.focus();
      return;
    }
    if (!APPLICATION_ENDPOINT) {
      showBanner('error', 'The email verification system is not configured.');
      return;
    }

    saveDraft();
    verificationEmail = email;
    if (verificationBox) verificationBox.style.display = 'block';
    if (verifyEmailBtn) {
      verifyEmailBtn.disabled = true;
      verifyEmailBtn.textContent = 'Sending…';
    }
    setVerificationMessage('Sending a verification link to this inbox…');
    showBanner('ok', 'Sending your verification email…');

    // Issue a plain GET request to the Apps Script Web App. A temporary
    // image request avoids CORS preflights and does not rely on sendBeacon.
    const url = APPLICATION_ENDPOINT +
      '?action=send_verification' +
      '&email=' + encodeURIComponent(email) +
      '&site_url=' + encodeURIComponent(window.location.origin) +
      '&_=' + Date.now();

    const img = document.createElement('img');
    img.width = 1;
    img.height = 1;
    img.alt = '';
    img.style.position = 'absolute';
    img.style.left = '-9999px';
    img.style.top = '-9999px';
    img.onload = img.onerror = () => img.remove();
    document.body.appendChild(img);
    img.src = url;

    if (verifyEmailBtn) verifyEmailBtn.textContent = 'Email requested ✓';
    setVerificationMessage('Check your inbox and spam folder for the Crikle verification email. Click the link inside it, then return here.');
    showBanner('ok', 'Verification email requested. Check your inbox.');
    startCooldown();
  });

  const params = new URLSearchParams(window.location.search);
  const verifiedFromUrl = params.get('email_verified') === '1';
  const verifiedEmailFromUrl = (params.get('email') || '').trim().toLowerCase();
  const tokenFromUrl = params.get('verification_token') || '';

  if (verifiedFromUrl && verifiedEmailFromUrl && tokenFromUrl) {
    emailInput.value = verifiedEmailFromUrl;
    verificationEmail = verifiedEmailFromUrl;
    emailVerified.value = 'true';
    verificationToken.value = tokenFromUrl;
    verificationBox.style.display = 'block';
    verifyEmailBtn.disabled = true;
    verifyEmailBtn.textContent = 'Email verified ✓';
    setVerificationMessage('Email verified successfully. Your application can now be submitted.');
    showBanner('ok', 'Email verified ✓ — finish the form and submit your application.');
    saveDraft();
    window.history.replaceState({}, document.title, window.location.pathname);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (honeypot && honeypot.value.trim()) return;

    const required = form.querySelectorAll('[required]');
    let firstInvalid = null;
    let valid = true;

    required.forEach(field => {
      const group = field.closest('.choice-group');
      if (group) {
        const checked = form.querySelector(`input[name="${CSS.escape(field.name)}"]:checked`);
        if (!checked) {
          valid = false;
          if (!firstInvalid) firstInvalid = field;
        }
      } else if (!field.value.trim()) {
        valid = false;
        if (!firstInvalid) firstInvalid = field;
      }
    });

    if (!valid) {
      showBanner('error', 'A few required fields are still empty — please check the form.');
      if (firstInvalid) {
        firstInvalid.closest('.field, .form-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstInvalid.focus({ preventScroll: true });
      }
      return;
    }

    if (emailVerified.value !== 'true' || !verificationToken.value) {
      showBanner('error', 'Please verify your email address before submitting.');
      emailInput.focus();
      return;
    }

    const verifiedEmail = emailInput.value.trim().toLowerCase();
    if (!verificationEmail || verifiedEmail !== verificationEmail) {
      showBanner('error', 'Please verify the current email address before submitting.');
      emailInput.focus();
      return;
    }

    const data = new FormData(form);
    const payload = {};
    for (const [key, value] of data.entries()) {
      if (key !== 'website') payload[key] = String(value).trim();
    }
    payload.source = window.location.href;
    payload.submitted_at_client = new Date().toISOString();

    submitButton.disabled = true;
    submitButton.textContent = 'Submitting…';
    showBanner('ok', 'Submitting your application…');

    try {
      await fetch(APPLICATION_ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams(payload),
        keepalive: true
      });

      clearDraft();
      form.reset();
      verificationEmail = '';
      emailVerified.value = 'false';
      verificationToken.value = '';
      verificationBox.style.display = 'none';
      submitButton.textContent = 'Application submitted ✓';
      showBanner('ok', 'Application submitted successfully. Check your inbox for the Crikle confirmation email.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Crikle application submission failed:', error);
      submitButton.disabled = false;
      submitButton.textContent = 'Submit application →';
      showBanner('error', 'We could not submit your application. Please check your connection and try again.');
    }
  });
}
