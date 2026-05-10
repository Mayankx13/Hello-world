'use client';

/* ─────────────────────────────────────────────────────────────────────────────
   Analytics helpers — all events console-logged for QA; real IDs swapped in env
   ───────────────────────────────────────────────────────────────────────────── */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export type LeadEventData = {
  state: string;
  name?: string;
  mobile?: string;
  district?: string;
  formPosition?: 'hero_mini' | 'mid_page' | 'bottom' | 'exit_popup';
  // WhatsApp Business API payload contract (document for integration)
  whatsappPayload?: WhatsAppLeadPayload;
};

export type FieldDropOffEvent = {
  fieldName: string;
  state: string;
  formPosition?: string;
};

// WhatsApp Business API lead payload contract
export type WhatsAppLeadPayload = {
  to: string;           // student WhatsApp number with country code
  templateName: string; // "nursing_lead_confirmation_v1"
  params: {
    studentName: string;
    state: string;
    district: string;
    mobileForCallback: string;
    collegeWhatsapp: string;
  };
  metadata: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    pageUrl: string;
    referrer: string;
    timestamp: string;
  };
};

function safeGtag(...args: unknown[]) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag(...args);
  }
}

function safeFbq(...args: unknown[]) {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq(...args);
  }
}

export function trackLeadSubmit(data: LeadEventData) {
  // Console log for QA — always fires
  console.log('[Lead Event] generate_lead', {
    timestamp: new Date().toISOString(),
    ...data,
  });

  // GA4
  safeGtag('event', 'generate_lead', {
    state: data.state,
    district: data.district,
    form_position: data.formPosition,
    currency: 'INR',
  });

  // Meta Pixel
  safeFbq('track', 'Lead', {
    content_name: `BSc Nursing - ${data.state}`,
    content_category: 'Education',
    state: data.state,
  });

  // WhatsApp Business API — document the payload contract
  if (data.whatsappPayload) {
    console.log('[WhatsApp API Payload]', JSON.stringify(data.whatsappPayload, null, 2));
    // SWAP: POST to your WhatsApp Business API endpoint:
    // fetch('/api/whatsapp-lead', { method: 'POST', body: JSON.stringify(data.whatsappPayload) })
  }
}

export function trackFieldDropOff(data: FieldDropOffEvent) {
  console.log('[Field Drop-off]', {
    timestamp: new Date().toISOString(),
    ...data,
  });

  safeGtag('event', 'form_field_dropoff', {
    field_name: data.fieldName,
    state: data.state,
    form_position: data.formPosition,
  });
}

export function trackFormStart(state: string, formPosition: string) {
  console.log('[Form Start]', { state, formPosition, timestamp: new Date().toISOString() });

  safeGtag('event', 'form_start', {
    state,
    form_position: formPosition,
  });
}

export function trackWhatsAppClick(source: string, state: string) {
  console.log('[WhatsApp Click]', { source, state, timestamp: new Date().toISOString() });

  safeGtag('event', 'whatsapp_click', { source, state });
  safeFbq('track', 'Contact', { source, state });
}

export function trackPhoneClick(state: string) {
  console.log('[Phone Click]', { state, timestamp: new Date().toISOString() });
  safeGtag('event', 'phone_click', { state });
}

export function trackPageView(state: string) {
  console.log('[Page View]', { state, timestamp: new Date().toISOString() });
  safeGtag('event', 'page_view', { state, page_type: 'landing' });
}
