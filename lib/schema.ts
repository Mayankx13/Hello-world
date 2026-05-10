import { z } from 'zod';

export const leadSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name is too long')
      .regex(/^[a-zA-Z\sऀ-ॿ]+$/, 'Please enter a valid name'),

    mobile: z
      .string()
      .regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number'),

    whatsappSame: z.boolean().default(true),

    email: z
      .string()
      .email('Please enter a valid email')
      .optional()
      .or(z.literal('')),

    district: z.string().min(1, 'Please select your city / district'),

    class12Status: z.enum(['appearing', 'passed', 'result_awaited'], {
      required_error: 'Please select your 12th board status',
    }),

    class12Percentage: z
      .string()
      .optional(),

    hostelRequired: z.enum(['yes', 'no']).default('yes'),

    bestTimeToCall: z
      .enum(['morning', 'afternoon', 'evening'])
      .optional(),

    consent: z.boolean().refine((v) => v === true, {
      message: 'Please give consent to be contacted by our admissions team',
    }),

    // Hidden tracking fields
    state: z.string(),
    utmSource: z.string().optional(),
    utmMedium: z.string().optional(),
    utmCampaign: z.string().optional(),
    pageUrl: z.string().optional(),
    referrer: z.string().optional(),
    timestamp: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.class12Status === 'passed') {
        if (!data.class12Percentage || data.class12Percentage.trim() === '') return false;
        const pct = parseFloat(data.class12Percentage);
        if (isNaN(pct) || pct < 0 || pct > 100) return false;
      }
      return true;
    },
    {
      message: 'Please enter a valid 12th percentage (0–100)',
      path: ['class12Percentage'],
    }
  );

export type LeadFormData = z.infer<typeof leadSchema>;

// TypeScript interface for CRM/webhook integration (stub — swap real endpoint)
export interface LeadPayload {
  id: string;
  submittedAt: string;
  source: 'web_form';
  formPosition: 'hero_mini' | 'mid_page' | 'bottom' | 'exit_popup';
  student: {
    name: string;
    mobile: string;
    whatsappNumber: string;
    email?: string;
    state: string;
    district: string;
    class12Status: 'appearing' | 'passed' | 'result_awaited';
    class12Percentage?: number;
    hostelRequired: boolean;
    bestTimeToCall?: 'morning' | 'afternoon' | 'evening';
  };
  tracking: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    pageUrl?: string;
    referrer?: string;
    userAgent?: string;
    ip?: string;
  };
}
