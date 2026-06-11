import { NextResponse } from "next/server";
import { bookingSchema } from "@/lib/schema";

export const runtime = "nodejs";

/**
 * Booking handler: validates the payload (same Zod schema the client
 * uses) and forwards it to the n8n webhook in BOOKING_WEBHOOK_URL.
 * The webhook URL never reaches the browser.
 */
export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request." },
      { status: 400 }
    );
  }

  const parsed = bookingSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Validation failed.",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 422 }
    );
  }

  const { company, ...booking } = parsed.data;
  // Honeypot tripped — report success without delivering anything.
  if (company) {
    return NextResponse.json({ ok: true });
  }

  const webhookUrl = process.env.BOOKING_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error("BOOKING_WEBHOOK_URL is not configured");
    return NextResponse.json(
      { ok: false, error: "Booking is temporarily unavailable." },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...booking,
        submittedAt: new Date().toISOString(),
        source: "aiez-landing",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error(`Booking webhook responded ${res.status}`);
      return NextResponse.json(
        { ok: false, error: "Booking could not be delivered." },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error("Booking webhook request failed", err);
    return NextResponse.json(
      { ok: false, error: "Booking could not be delivered." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
