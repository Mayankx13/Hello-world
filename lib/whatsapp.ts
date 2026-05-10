/* ─────────────────────────────────────────────────────────────────────────────
   WhatsApp link builder utilities
   ───────────────────────────────────────────────────────────────────────────── */

export type WhatsAppParams = {
  phone: string;       // with country code, no +, e.g. "919876543210"
  message: string;
};

export function buildWhatsAppUrl({ phone, message }: WhatsAppParams): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function buildLeadWhatsAppUrl(params: {
  phone: string;
  name: string;
  state: string;
  district?: string;
  mobile?: string;
  prefillTemplate: string;
}): string {
  let message = params.prefillTemplate
    .replace('{name}', params.name || 'Student')
    .replace('{state}', params.state);

  if (params.district) {
    message += ` I am from ${params.district}.`;
  }
  if (params.mobile) {
    message += ` My number is ${params.mobile}.`;
  }

  return buildWhatsAppUrl({ phone: params.phone, message });
}

export function buildThankYouWhatsAppUrl(params: {
  phone: string;
  name: string;
  state: string;
  district?: string;
}): string {
  const message =
    `Hi! I just submitted my B.Sc Nursing application on your website. ` +
    `My name is ${params.name || 'Student'} from ${params.state}` +
    (params.district ? `, ${params.district}` : '') +
    `. Please connect me with a counsellor. Thank you! 🙏`;

  return buildWhatsAppUrl({ phone: params.phone, message });
}

export function buildFallbackWhatsAppUrl(params: {
  phone: string;
  formData: Record<string, unknown>;
  state: string;
}): string {
  const name = String(params.formData.name || 'Student');
  const mobile = String(params.formData.mobile || '');
  const district = String(params.formData.district || '');

  const message =
    `[Admission Enquiry - Form Submitted via Website]\n` +
    `Name: ${name}\n` +
    `State: ${params.state}\n` +
    `District: ${district}\n` +
    `Mobile: ${mobile}\n` +
    `Course: B.Sc Nursing\n` +
    `Hostel: ${params.formData.hostelRequired === 'yes' ? 'Required' : 'Not Required'}\n` +
    `12th Status: ${params.formData.class12Status || 'Not specified'}\n` +
    `Best Time to Call: ${params.formData.bestTimeToCall || 'Anytime'}\n` +
    `\nPlease call me back for admission counselling. 🙏`;

  return buildWhatsAppUrl({ phone: params.phone, message });
}
