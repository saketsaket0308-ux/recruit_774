# Crikle Email Verification — GET Fix

This package removes `sendBeacon()` from the Apply page. The Verify Email button now issues a plain GET request to the Google Apps Script Web App using a temporary image request.

## 1. Backend
Open the SAME Google Apps Script project used by your current Crikle `/exec` URL. Replace `Code.gs` with `backend/Code.gs`. Save. Then **Deploy → Manage deployments → Edit → New version → Deploy**. Keep **Execute as: Me** and **Who has access: Anyone**.

Do not create a new Apps Script project.

## 2. Website
Deploy the contents of this folder to Netlify.

## 3. Test
Open the deployed Apply page in an Incognito/private tab, type a real email, click Verify Email once, and check Inbox/Spam.

## 4. Guaranteed diagnostic
Immediately after clicking Verify Email, open Apps Script → Executions. The backend should show an execution for the GET request and the log:
`GET send_verification received for: email@example.com`

If there is no new execution at all, the live Netlify page is not using the JavaScript in this package or is pointing at a different Apps Script URL.

Apps Script Web App URL configured in this package:
https://script.google.com/macros/s/AKfycbzMT_UJK0yW7JAIRgH38Wd65ezsX0iCWMcHpllXL_t_VBgAyE6hiYCjngWfnsMdCP14/exec
