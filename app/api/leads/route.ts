import { NextRequest, NextResponse } from 'next/server';
import { leadSchema, LeadPayload } from '@/lib/schema';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate with Zod — strip unknown keys
    const parsed = leadSchema.safeParse(body);

    if (!parsed.success) {
      console.warn('[Leads API] Validation failed:', parsed.error.flatten());
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Build typed lead payload (CRM integration contract)
    const leadPayload: LeadPayload = {
      id: randomUUID(),
      submittedAt: new Date().toISOString(),
      source: 'web_form',
      formPosition: (body.formPosition as LeadPayload['formPosition']) ?? 'mid_page',
      student: {
        name: data.name,
        mobile: data.mobile,
        whatsappNumber: data.whatsappSame ? data.mobile : data.mobile, // extend if separate WA field added
        email: data.email ?? undefined,
        state: data.state,
        district: data.district,
        class12Status: data.class12Status,
        class12Percentage: data.class12Percentage
          ? parseFloat(data.class12Percentage)
          : undefined,
        hostelRequired: data.hostelRequired === 'yes',
        bestTimeToCall: data.bestTimeToCall,
      },
      tracking: {
        utmSource: data.utmSource,
        utmMedium: data.utmMedium,
        utmCampaign: data.utmCampaign,
        pageUrl: data.pageUrl,
        referrer: data.referrer,
        userAgent: request.headers.get('user-agent') ?? undefined,
        ip: request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? undefined,
      },
    };

    // ── Console log for QA ─────────────────────────────────────────────────
    console.log('\n[Lead Received] ─────────────────────────────────────────');
    console.log(JSON.stringify(leadPayload, null, 2));
    console.log('──────────────────────────────────────────────────────────\n');

    // ── STUB: Plug real CRM/webhook here ──────────────────────────────────
    // await fetch(process.env.CRM_WEBHOOK_URL!, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.CRM_API_KEY}` },
    //   body: JSON.stringify(leadPayload),
    // });

    // ── STUB: Send WhatsApp notification to college ────────────────────────
    // await fetch(process.env.WHATSAPP_API_URL!, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.WHATSAPP_API_TOKEN}` },
    //   body: JSON.stringify({ to: process.env.COLLEGE_WHATSAPP_NUMBER, ...leadPayload }),
    // });

    return NextResponse.json({
      success: true,
      leadId: leadPayload.id,
      message: 'Application received. Counsellor will call within 30 minutes.',
    });
  } catch (err) {
    console.error('[Leads API] Error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Leads API — POST only' }, { status: 405 });
}
