/*
 * CRIKLE INTERNSHIP APPLICATION BACKEND
 * Google Apps Script Web App
 *
 * IMPORTANT:
 * This script explicitly opens the target spreadsheet by ID.
 * Do NOT use SpreadsheetApp.getActiveSpreadsheet() in doPost().
 */

const SPREADSHEET_ID = '1k2YGSTjHG-GYbuTbkUUuLaqaqU85zfZ0GDF34QsDeKU';
const SHEET_NAME = 'Applications';

// Email verification settings.
const VERIFICATION_TTL_SECONDS = 15 * 60; // 15 minutes
const VERIFICATION_CACHE_PREFIX = 'crikle_email_verification_';
const VERIFICATION_TOKEN_PREFIX = 'crikle_email_token_';
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwxhYyvxm8468c2fsKgmxqJW6qHpMmS-gTucUBfz_tQHnNGqSVydNe6oouNjv2oG6Q1/exec';

const FOUNDER_EMAILS = [
  'saketsaket0308@gmail.com'
  // Add Sunand's email here when available:
  // 'SUNAND_EMAIL@example.com'
];

const HEADERS = [
  'Timestamp',
  'Name',
  'Email',
  'Phone',
  'College / University',
  'Course & Year',
  'LinkedIn',
  'Role',
  'Why join Crikle',
  'Proud of',
  'Portfolio / Work',
  '₹10,000 → First 1,000 Users',
  'LinkedIn Change',
  'Campus Growth Idea',
  'Why You',
  'Hours / Week',
  'Duration',
  'Source'
];

function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.autoResizeColumns(1, HEADERS.length);
  }

  return sheet;
}

function setupSheet() {
  const sheet = getSheet_();
  sheet.autoResizeColumns(1, HEADERS.length);
  Logger.log('Sheet ready: ' + sheet.getParent().getUrl());
  return 'Sheet ready';
}

/*
 * EMAIL DIAGNOSTIC
 * Run testEmail() once manually from the Apps Script editor.
 * It sends a test message to the first founder address and throws the exact
 * MailApp error if Google has not granted permission or the daily quota is
 * exhausted.
 */
function testEmail() {
  const to = FOUNDER_EMAILS[0];
  if (!to) throw new Error('No founder email configured.');

  const quotaBefore = MailApp.getRemainingDailyQuota();
  Logger.log('MailApp remaining daily recipient quota BEFORE send: ' + quotaBefore);

  MailApp.sendEmail({
    to: to,
    subject: 'Crikle mail system test ✓',
    body: 'This is a test email from the Crikle Google Apps Script backend.\n\nIf you received this, MailApp is authorized and working.',
    name: 'Crikle Hiring Team',
    replyTo: to
  });

  const quotaAfter = MailApp.getRemainingDailyQuota();
  Logger.log('MailApp remaining daily recipient quota AFTER send: ' + quotaAfter);
  return 'Test email sent to ' + to;
}

function getMailStatus() {
  return {
    founder_email: FOUNDER_EMAILS[0] || '',
    remaining_daily_quota: MailApp.getRemainingDailyQuota(),
    timezone: Session.getScriptTimeZone(),
    web_app_url: WEB_APP_URL
  };
}

/*
 * Run this manually once from the Apps Script editor.
 * It verifies that Apps Script has permission to write to the exact Sheet.
 */
function testWrite() {
  const sheet = getSheet_();

  sheet.appendRow([
    new Date(),
    'TEST APPLICATION',
    'test@example.com',
    '0000000000',
    'Crikle Test',
    'Test / 2026',
    '',
    'Test Role',
    'Backend connectivity test',
    'Testing the application pipeline',
    '',
    '',
    '',
    '',
    '',
    '1–2 hrs/week',
    '1 month',
    'MANUAL TEST'
  ]);

  Logger.log('TEST ROW WRITTEN SUCCESSFULLY');
  return 'TEST ROW WRITTEN SUCCESSFULLY';
}

function doPost(e) {
  try {
    const data = parseRequest_(e);

    // Email verification requests are handled separately from applications.
    const action = clean_(data.action).toLowerCase();
    if (action === 'send_verification') {
      return handleSendVerification_(data);
    }

    // Honeypot / basic bot protection.
    if (String(data.website || '').trim() !== '') {
      return jsonResponse_({ ok: false, error: 'Rejected' });
    }

    const required = [
      'full_name', 'email', 'phone', 'college', 'course_year',
      'role', 'why_join', 'proud_of', 'signal_1000',
      'signal_linkedin', 'signal_idea', 'signal_why_you',
      'hours', 'duration'
    ];

    const missing = required.filter(key => !String(data[key] || '').trim());

    if (missing.length) {
      return jsonResponse_({
        ok: false,
        error: 'Missing required fields',
        fields: missing
      });
    }

    const email = clean_(data.email).toLowerCase();

    if (!isValidEmail_(email)) {
      return jsonResponse_({
        ok: false,
        error: 'Invalid email address'
      });
    }

    // A verification token is required. This prevents fake addresses from
    // being accepted just because they have a valid-looking format.
    if (clean_(data.email_verified).toLowerCase() !== 'true' ||
      !verifyEmailToken_(email, clean_(data.email_verification_token), false)) {
      return jsonResponse_({
        ok: false,
        error: 'Email address has not been verified'
      });
    }

    data.email = email;

    // Explicitly open the target spreadsheet by ID.
    const sheet = getSheet_();
    const now = new Date();

    // Serialize writes so simultaneous applications don't collide.
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      sheet.appendRow([
        now,
        clean_(data.full_name),
        clean_(data.email),
        clean_(data.phone),
        clean_(data.college),
        clean_(data.course_year),
        clean_(data.linkedin),
        clean_(data.role),
        clean_(data.why_join),
        clean_(data.proud_of),
        clean_(data.portfolio),
        clean_(data.signal_1000),
        clean_(data.signal_linkedin),
        clean_(data.signal_idea),
        clean_(data.signal_why_you),
        clean_(data.hours),
        clean_(data.duration),
        clean_(data.source)
      ]);

      consumeEmailVerificationToken_(
        clean_(data.email).toLowerCase(),
        clean_(data.email_verification_token)
      );
    } finally {
      lock.releaseLock();
    }

    // Email errors should not prevent the Sheet row from being saved.
    try {
      sendApplicantConfirmation_(data, now);
    } catch (mailError) {
      console.error('Applicant email failed: ' + mailError);
    }

    try {
      sendFounderNotification_(data, now);
    } catch (mailError) {
      console.error('Founder email failed: ' + mailError);
    }

    return jsonResponse_({
      ok: true,
      message: 'Application received'
    });

  } catch (err) {
    console.error('doPost failed: ' + err);

    return jsonResponse_({
      ok: false,
      error: String(err)
    });
  }
}

function parseRequest_(e) {
  if (!e) return {};

  // Form POSTs from the website arrive here.
  if (e.parameter) {
    const params = {};

    Object.keys(e.parameter).forEach(key => {
      params[key] = e.parameter[key];
    });

    // If parameters were supplied, use them.
    if (Object.keys(params).length > 0) {
      return params;
    }
  }

  // Also support JSON POSTs.
  if (e.postData && e.postData.contents) {
    const type = String(e.postData.type || '').toLowerCase();
    const body = String(e.postData.contents || '');

    if (type.indexOf('application/json') !== -1) {
      return JSON.parse(body || '{}');
    }
  }

  return {};
}

function sendApplicantConfirmation_(data, now) {
  const name = clean_(data.full_name);
  const role = clean_(data.role);

  const subject = 'Crikle Internship Application Received ✓';

  const body =
    `Hi ${name},

Thanks for applying to join Crikle as a ${role}.

We've received your application successfully.

What happens next:
• The founding team will review your application.
• If your profile is shortlisted, we'll contact you directly.
• Please keep an eye on your email and LinkedIn.

Application received: ${Utilities.formatDate(
      now,
      Session.getScriptTimeZone(),
      'dd MMM yyyy, hh:mm a'
    )}

Thanks,
Team Crikle`;

  console.log('Sending applicant confirmation to: ' + data.email);
  MailApp.sendEmail({
    to: data.email,
    subject: subject,
    body: body,
    name: 'Crikle Hiring Team',
    replyTo: FOUNDER_EMAILS[0]
  });
}

function sendFounderNotification_(data, now) {
  const founderEmails = FOUNDER_EMAILS
    .map(x => String(x).trim())
    .filter(x => x && x.indexOf('@') !== -1);

  if (!founderEmails.length) return;

  const subject =
    `New Crikle applicant — ${clean_(data.full_name)} — ${clean_(data.role)}`;

  const body =
    `NEW CRIKLE INTERNSHIP APPLICATION

Applicant: ${clean_(data.full_name)}
Email: ${clean_(data.email)}
Phone: ${clean_(data.phone)}
College: ${clean_(data.college)}
Course & Year: ${clean_(data.course_year)}
LinkedIn: ${clean_(data.linkedin) || '—'}
Role: ${clean_(data.role)}

WHY CRIKLE
${clean_(data.why_join)}

PROUD OF
${clean_(data.proud_of)}

PORTFOLIO / WORK
${clean_(data.portfolio) || '—'}

HIGH-SIGNAL QUESTIONS

₹10,000 + 30 days → first 1,000 users:
${clean_(data.signal_1000)}

One thing to change about LinkedIn:
${clean_(data.signal_linkedin)}

Crazy campus idea:
${clean_(data.signal_idea)}

Why choose them over a better résumé:
${clean_(data.signal_why_you)}

AVAILABILITY
Hours: ${clean_(data.hours)}
Duration: ${clean_(data.duration)}

Received: ${Utilities.formatDate(
      now,
      Session.getScriptTimeZone(),
      'dd MMM yyyy, hh:mm a'
    )}

Open the Applications sheet to review the full record.`;

  console.log('Sending founder notification to: ' + founderEmails.join(','));
  MailApp.sendEmail({
    to: founderEmails.join(','),
    subject: subject,
    body: body,
    name: 'Crikle Hiring System'
  });
}

function handleSendVerification_(data) {
  const email = clean_(data.email).toLowerCase();
  const siteUrl = clean_(data.site_url).replace(/\/+$/, '');

  if (!isValidEmail_(email)) {
    return jsonResponse_({ ok: false, error: 'Invalid email address' });
  }

  if (!/^https?:\/\/[^\s]+$/i.test(siteUrl)) {
    return jsonResponse_({ ok: false, error: 'Invalid site URL' });
  }

  // Prevent accidental rapid resend loops. The frontend also has a 30s cooldown.
  const rateKey = VERIFICATION_CACHE_PREFIX + 'rate_' + email;
  const rateCache = CacheService.getScriptCache();
  if (rateCache.get(rateKey)) {
    return jsonResponse_({ ok: false, error: 'Please wait 30 seconds before requesting another verification email.' });
  }
  rateCache.put(rateKey, '1', 30);

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const token = Utilities.getUuid();

  const cache = CacheService.getScriptCache();
  cache.put(
    VERIFICATION_CACHE_PREFIX + email,
    JSON.stringify({
      code: code,
      token: token,
      email: email,
      siteUrl: siteUrl
    }),
    VERIFICATION_TTL_SECONDS
  );

  cache.put(
    VERIFICATION_TOKEN_PREFIX + token,
    JSON.stringify({
      email: email,
      siteUrl: siteUrl
    }),
    VERIFICATION_TTL_SECONDS
  );

  const subject = 'Verify your email for Crikle';
  const body =
    `Hi,

Someone is applying for the Crikle founding intern team using this email address.

Click this link to verify that you own this inbox:

${siteUrl}/apply.html?email_verified=1&email=${encodeURIComponent(email)}&verification_token=${encodeURIComponent(token)}
This verification link expires in 15 minutes.

If you did not request this, you can ignore this email.

Thanks,
Team Crikle`;

  console.log('Sending verification email to: ' + email);
  MailApp.sendEmail({
    to: email,
    subject: subject,
    body: body,
    name: 'Crikle Hiring Team',
    replyTo: FOUNDER_EMAILS[0]
  });

  return jsonResponse_({
    ok: true,
    message: 'Verification email sent'
  });
}

function hasMailServer_(email) {
  const domain = clean_(email).split('@').pop().toLowerCase();
  if (!domain || domain.indexOf('.') === -1) return false;

  try {
    const url = 'https://dns.google/resolve?name=' +
      encodeURIComponent(domain) + '&type=MX';

    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true
    });

    if (response.getResponseCode() !== 200) return false;

    const result = JSON.parse(response.getContentText() || '{}');
    if (Number(result.Status) !== 0) return false;

    // If MX is absent, RFC-compliant mail delivery may fall back to an A/AAAA
    // record. Check that fallback too before rejecting the domain.
    if (Array.isArray(result.Answer) && result.Answer.length > 0) return true;

    const fallbackUrl = 'https://dns.google/resolve?name=' +
      encodeURIComponent(domain) + '&type=A';
    const fallbackResponse = UrlFetchApp.fetch(fallbackUrl, {
      muteHttpExceptions: true,
      followRedirects: true
    });

    if (fallbackResponse.getResponseCode() !== 200) return false;
    const fallback = JSON.parse(fallbackResponse.getContentText() || '{}');
    return Number(fallback.Status) === 0 &&
      Array.isArray(fallback.Answer) &&
      fallback.Answer.length > 0;
  } catch (err) {
    console.error('MX lookup failed for ' + domain + ': ' + err);
    return false;
  }
}

function verifyEmailToken_(email, token, consume) {
  if (!email || !token) return false;

  const cache = CacheService.getScriptCache();
  const raw = cache.get(VERIFICATION_TOKEN_PREFIX + token);

  if (!raw) return false;

  try {
    const record = JSON.parse(raw);
    if (String(record.email).toLowerCase() !== email.toLowerCase()) return false;

    if (consume) {
      consumeEmailVerificationToken_(email, token);
    }

    return true;
  } catch (err) {
    return false;
  }
}

function consumeEmailVerificationToken_(email, token) {
  const cache = CacheService.getScriptCache();
  cache.remove(VERIFICATION_TOKEN_PREFIX + token);
  cache.remove(VERIFICATION_CACHE_PREFIX + email.toLowerCase());
}

function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};

  if (String(params.action || '').toLowerCase() === 'verify_email') {
    const email = clean_(params.email).toLowerCase();
    const token = clean_(params.verification_token);

    if (!isValidEmail_(email) || !token) {
      return jsonResponse_({
        ok: false,
        email_verified: false,
        error: 'Invalid verification request'
      });
    }

    const valid = verifyEmailToken_(email, token, false);

    return jsonResponse_({
      ok: valid,
      email_verified: valid,
      error: valid ? '' : 'Verification link is invalid or expired'
    });
  }

  // existing send_verification code...

  if (params.email_verified === '1' &&
    params.email &&
    params.verification_token) {
    const email = clean_(params.email).toLowerCase();
    const token = clean_(params.verification_token);

    const cache = CacheService.getScriptCache();
    const raw = cache.get(VERIFICATION_TOKEN_PREFIX + token);

    if (raw) {
      try {
        const record = JSON.parse(raw);

        if (record.email === email) {
          const base = String(record.siteUrl || '').replace(/\/+$/, '');
          const redirectUrl =
            base +
            '/apply.html?email_verified=1&email=' +
            encodeURIComponent(email) +
            '&verification_token=' +
            encodeURIComponent(token);

          return HtmlService.createHtmlOutput(`
  <html>
    <head>
      <base target="_top">
    </head>
    <body>
      <p>Email verified. Returning to the application…</p>
      <script>
        window.open(${JSON.stringify(redirectUrl)}, '_top');
      </script>
    </body>
  </html>
`);
        }
      } catch (err) {
        console.error('Verification redirect failed: ' + err);
      }
    }

    return HtmlService.createHtmlOutput(
      '<p>This verification link is invalid or has expired. Please request a new one from the Crikle application form.</p>'
    );
  }

  return jsonResponse_({
    ok: true,
    service: 'Crikle application endpoint',
    message: 'Crikle backend is live.'
  });
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function clean_(value) {
  return String(value == null ? '' : value).trim();
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
