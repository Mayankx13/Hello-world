import { z } from "zod";

export const niches = ["coaching", "consulting", "agency", "other"] as const;
export const frequencies = ["daily", "weekly", "monthly", "rarely"] as const;

const chooseOne = { errorMap: () => ({ message: "Choose one." }) };

/**
 * Indian WhatsApp numbers: a 10-digit mobile starting 6–9, optionally
 * prefixed with +91 / 91 / 0 and with spaces, dashes, dots or parens mixed
 * in ("+91 98765-43210"). Normalised to E.164 (+91XXXXXXXXXX) on output.
 */
const INDIAN_MOBILE = /^(?:\+?91|0)?[6-9]\d{9}$/;

export const bookingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Tell us your name.")
    .max(120, "That's a long name — use a shorter one."),
  email: z
    .string()
    .trim()
    .email("That email doesn't look right."),
  whatsapp: z
    .string()
    .transform((v) => v.replace(/[\s\-().]/g, ""))
    .pipe(
      z
        .string()
        .regex(INDIAN_MOBILE, "Enter a valid Indian WhatsApp number (+91).")
    )
    .transform((v) => `+91${v.slice(-10)}`),
  niche: z.enum(niches, chooseOne),
  frequency: z.enum(frequencies, chooseOne),
  // Honeypot — humans never see or fill this field.
  company: z.string().optional(),
});

export type BookingInput = z.input<typeof bookingSchema>;
export type Booking = z.output<typeof bookingSchema>;
