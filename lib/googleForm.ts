'use client';

import { LeadFormData } from './schema';

/* ─────────────────────────────────────────────────────────────────────────────
   Google Form lead submission

   HOW TO SET UP YOUR REAL FORM (5 minutes):
   1. Go to https://forms.google.com → create a new form with these fields
      (matching the names below, type as noted):
        - Full Name           [Short answer]
        - Mobile Number       [Short answer]
        - WhatsApp Same       [Multiple choice: Yes / No]
        - Email               [Short answer]
        - State               [Short answer]
        - District            [Short answer]
        - 12th Status         [Multiple choice]
        - 12th Percentage     [Short answer]
        - Hostel Required     [Multiple choice: Yes / No]
        - Best Time To Call   [Multiple choice]
        - Form Position       [Short answer]
        - UTM Source          [Short answer]
        - UTM Medium          [Short answer]
        - UTM Campaign        [Short answer]
        - Page URL            [Short answer]
        - Referrer            [Short answer]
        - Timestamp           [Short answer]

   2. Click "Send" → "Link" tab → copy the form URL. The FORM_ID is the
      long string between /d/e/ and /viewform.

   3. To get each field's entry.NNN ID:
        a. Open the live form
        b. Right-click → "View Page Source" (or use prefilled-link trick)
        c. Search for "entry." — each field has a unique entry.NNNNNNNNNN ID
        d. Map each field name to its entry ID below

   4. Paste FORM_ID + all entry IDs below. Set GOOGLE_FORM.enabled = true.

   5. (Optional) Enable email notifications inside Google Forms → Responses →
      Get email notifications, OR connect to Google Sheets for a CRM-like view.
   ───────────────────────────────────────────────────────────────────────────── */

export const GOOGLE_FORM = {
  enabled: false, // ← flip to TRUE after pasting real form ID + entry IDs
  formId: '1FAIpQLSeREPLACE_ME_WITH_REAL_GOOGLE_FORM_ID',
  fields: {
    name:              'entry.1000000001',
    mobile:            'entry.1000000002',
    whatsappSame:      'entry.1000000003',
    email:             'entry.1000000004',
    state:             'entry.1000000005',
    district:          'entry.1000000006',
    class12Status:     'entry.1000000007',
    class12Percentage: 'entry.1000000008',
    hostelRequired:    'entry.1000000009',
    bestTimeToCall:    'entry.1000000010',
    formPosition:      'entry.1000000011',
    utmSource:         'entry.1000000012',
    utmMedium:         'entry.1000000013',
    utmCampaign:       'entry.1000000014',
    pageUrl:           'entry.1000000015',
    referrer:          'entry.1000000016',
    timestamp:         'entry.1000000017',
  },
};

export type GoogleFormSubmitResult = {
  attempted: boolean;
  configured: boolean;
};

export async function submitToGoogleForm(
  data: LeadFormData & { formPosition?: string }
): Promise<GoogleFormSubmitResult> {
  // Always log the payload locally (visible in browser DevTools console for QA)
  console.log('[Google Form] Submission attempted:', data);

  if (!GOOGLE_FORM.enabled) {
    console.warn(
      '[Google Form] DISABLED — set GOOGLE_FORM.enabled = true in lib/googleForm.ts ' +
      'after configuring real form ID + entry IDs. Lead NOT sent to Google Form.'
    );
    return { attempted: false, configured: false };
  }

  const url = `https://docs.google.com/forms/d/e/${GOOGLE_FORM.formId}/formResponse`;
  const body = new URLSearchParams();

  body.append(GOOGLE_FORM.fields.name, data.name);
  body.append(GOOGLE_FORM.fields.mobile, data.mobile);
  body.append(GOOGLE_FORM.fields.whatsappSame, data.whatsappSame ? 'Yes' : 'No');
  body.append(GOOGLE_FORM.fields.email, data.email ?? '');
  body.append(GOOGLE_FORM.fields.state, data.state);
  body.append(GOOGLE_FORM.fields.district, data.district);
  body.append(GOOGLE_FORM.fields.class12Status, data.class12Status);
  body.append(GOOGLE_FORM.fields.class12Percentage, data.class12Percentage ?? '');
  body.append(GOOGLE_FORM.fields.hostelRequired, data.hostelRequired === 'yes' ? 'Yes' : 'No');
  body.append(GOOGLE_FORM.fields.bestTimeToCall, data.bestTimeToCall ?? '');
  body.append(GOOGLE_FORM.fields.formPosition, data.formPosition ?? 'unknown');
  body.append(GOOGLE_FORM.fields.utmSource, data.utmSource ?? '');
  body.append(GOOGLE_FORM.fields.utmMedium, data.utmMedium ?? '');
  body.append(GOOGLE_FORM.fields.utmCampaign, data.utmCampaign ?? '');
  body.append(GOOGLE_FORM.fields.pageUrl, data.pageUrl ?? '');
  body.append(GOOGLE_FORM.fields.referrer, data.referrer ?? '');
  body.append(GOOGLE_FORM.fields.timestamp, data.timestamp ?? new Date().toISOString());

  // Google Forms doesn't return CORS headers — must use no-cors.
  // Response is opaque, so we can't read status. If fetch resolves, browser
  // sent the request; failure only happens on real network errors.
  await fetch(url, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  return { attempted: true, configured: true };
}
