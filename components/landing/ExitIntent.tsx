'use client';

import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, Loader2, CheckCircle2, MessageCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { StateConfig, COLLEGE } from '@/config/states';
import { buildThankYouWhatsAppUrl, buildFallbackWhatsAppUrl } from '@/lib/whatsapp';
import { submitToGoogleForm } from '@/lib/googleForm';
import { trackLeadSubmit, trackFormStart } from '@/lib/analytics';

interface Props {
  config: StateConfig;
}

const exitSchema = z.object({
  name: z.string().min(2, 'Please enter your name'),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Enter valid 10-digit mobile number'),
  consent: z.boolean().refine((v) => v === true, { message: 'Please give consent' }),
});
type ExitFormData = z.infer<typeof exitSchema>;

type SubmitState = 'idle' | 'loading' | 'success' | 'error';

export default function ExitIntent({ config }: Props) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submittedName, setSubmittedName] = useState('');
  const hasTriggered = useRef(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ExitFormData>({
    resolver: zodResolver(exitSchema),
    defaultValues: { consent: true },
  });

  // Exit intent: trigger when mouse leaves viewport top edge (desktop only)
  useEffect(() => {
    if (dismissed) return;

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 10 && !hasTriggered.current) {
        hasTriggered.current = true;
        setVisible(true);
        trackFormStart(config.slug, 'exit_popup');
      }
    };

    // Only on desktop
    if (window.innerWidth >= 768) {
      document.addEventListener('mouseleave', handleMouseLeave);
    }

    // Also trigger on 40s of scroll inactivity (backup trigger)
    let scrollTimer: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        if (!hasTriggered.current && !dismissed) {
          hasTriggered.current = true;
          setVisible(true);
          trackFormStart(config.slug, 'exit_popup');
        }
      }, 40000);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimer);
    };
  }, [dismissed, config.slug]);

  const onSubmit = async (data: ExitFormData) => {
    setSubmitState('loading');
    setSubmittedName(data.name);

    const leadPayload = {
      ...data,
      state: config.slug,
      formPosition: 'exit_popup' as const,
      district: 'Not specified',
      class12Status: 'appearing' as const,
      class12Percentage: undefined,
      hostelRequired: 'yes' as const,
      bestTimeToCall: undefined,
      whatsappSame: true,
      email: '',
      timestamp: new Date().toISOString(),
      pageUrl: window.location.href,
      referrer: document.referrer,
    };

    try {
      // Submit to Google Form (primary) + /api/leads (server log) in parallel
      await Promise.all([
        submitToGoogleForm(leadPayload),
        fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(leadPayload),
        }).catch((e) => console.warn('[/api/leads] non-blocking failure:', e)),
      ]);

      setSubmitState('success');
      trackLeadSubmit({ state: config.slug, name: data.name, mobile: data.mobile, formPosition: 'exit_popup' });
    } catch {
      setSubmitState('error');
    }
  };

  const dismiss = () => {
    setVisible(false);
    setDismissed(true);
  };

  if (!visible) return null;

  const waUrl = buildThankYouWhatsAppUrl({
    phone: config.whatsappNumber,
    name: submittedName || 'Student',
    state: config.displayName,
  });

  return (
    <div
      className="hidden md:flex fixed inset-0 z-[100] items-center justify-center bg-black/50 animate-fade-in"
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-label="Don't leave yet"
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="bg-accent px-6 py-4">
          <p className="text-white/80 text-xs font-semibold uppercase tracking-wide mb-1">Wait! Don&apos;t leave yet</p>
          <h2 className="text-white font-bold text-xl">
            Get Your Free Counselling Call 🎓
          </h2>
        </div>

        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-white/80 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6">
          {submitState === 'success' ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" />
              <h3 className="font-bold text-primary text-lg mb-2">Application Received! 🎉</h3>
              <p className="text-primary/60 text-sm mb-5">
                Our counsellor will call you within <strong>30 minutes</strong>.
              </p>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-whatsapp w-full flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                Chat on WhatsApp Now
              </a>
            </div>
          ) : (
            <>
              <p className="text-primary/60 text-sm mb-5">
                Leave your number — our <strong>{config.displayName} counsellor</strong> will
                call you back with all admission details, fee structure, and hostel info.
              </p>

              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
                <div>
                  <input
                    {...register('name')}
                    type="text"
                    placeholder="Your name"
                    autoComplete="name"
                    className="form-input"
                  />
                  {errors.name && <p className="form-error"><AlertCircle className="w-3 h-3" />{errors.name.message}</p>}
                </div>

                <div>
                  <input
                    {...register('mobile')}
                    type="tel"
                    placeholder="10-digit mobile number"
                    autoComplete="tel"
                    maxLength={10}
                    inputMode="numeric"
                    className="form-input"
                  />
                  {errors.mobile && <p className="form-error"><AlertCircle className="w-3 h-3" />{errors.mobile.message}</p>}
                </div>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    {...register('consent')}
                    type="checkbox"
                    defaultChecked
                    className="mt-0.5 w-4 h-4 rounded text-accent"
                  />
                  <span className="text-xs text-primary/60">
                    I agree to be contacted by {COLLEGE.shortName} admissions team.
                  </span>
                </label>
                {errors.consent && <p className="form-error"><AlertCircle className="w-3 h-3" />{errors.consent.message}</p>}

                {submitState === 'error' && (
                  <div className="bg-red-50 text-red-600 text-xs p-3 rounded-lg">
                    Something went wrong. Please{' '}
                    <a
                      href={buildFallbackWhatsAppUrl({
                        phone: config.whatsappNumber,
                        formData: {},
                        state: config.displayName,
                      })}
                      className="underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      contact us on WhatsApp
                    </a>
                    .
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitState === 'loading'}
                  className="btn-accent w-full flex items-center justify-center gap-2"
                >
                  {submitState === 'loading' ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                  ) : (
                    'Get Free Call Back →'
                  )}
                </button>

                <p className="text-center text-xs text-primary/30">🔒 No spam. Admission calls only.</p>
              </form>
            </>
          )}
        </div>

        <button
          onClick={dismiss}
          className="w-full py-3 text-xs text-primary/30 hover:text-primary/50 transition-colors border-t"
        >
          No thanks, I&apos;ll look for another college
        </button>
      </div>
    </div>
  );
}
