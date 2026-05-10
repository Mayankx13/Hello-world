'use client';

import { useState, useEffect, useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Loader2, AlertCircle, MessageCircle, Phone } from 'lucide-react';
import { StateConfig, COLLEGE } from '@/config/states';
import { leadSchema, LeadFormData } from '@/lib/schema';
import { buildThankYouWhatsAppUrl, buildFallbackWhatsAppUrl } from '@/lib/whatsapp';
import { submitToGoogleForm } from '@/lib/googleForm';
import {
  trackLeadSubmit,
  trackFormStart,
  trackFieldDropOff,
  trackWhatsAppClick,
  trackPhoneClick,
} from '@/lib/analytics';

export type FormVariant = 'mini' | 'full';

interface Props {
  config: StateConfig;
  variant?: FormVariant;
  position?: 'hero_mini' | 'mid_page' | 'bottom' | 'exit_popup';
}

type SubmitState = 'idle' | 'loading' | 'success' | 'error';

function getUtmParam(key: string): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get(key) ?? '';
}

export default function LeadForm({ config, variant = 'full', position = 'mid_page' }: Props) {
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [submittedData, setSubmittedData] = useState<LeadFormData | null>(null);
  const formId = useId();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, touchedFields },
    trigger,
  } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      whatsappSame: true,
      hostelRequired: 'yes',
      consent: false,
      state: config.slug,
      timestamp: new Date().toISOString(),
    },
  });

  const class12Status = watch('class12Status');
  const isMini = variant === 'mini';

  // Track form start on first interaction
  const handleFirstInteraction = (() => {
    let fired = false;
    return () => {
      if (!fired) {
        fired = true;
        trackFormStart(config.slug, position);
      }
    };
  })();

  // Field-level drop-off tracking
  const handleFieldBlur = (fieldName: string) => {
    if (touchedFields[fieldName as keyof LeadFormData]) return;
    trackFieldDropOff({ fieldName, state: config.slug, formPosition: position });
  };

  const onSubmit = async (data: LeadFormData) => {
    setSubmitState('loading');

    // Enrich with tracking data
    const enrichedData: LeadFormData = {
      ...data,
      state: config.slug,
      utmSource: getUtmParam('utm_source'),
      utmMedium: getUtmParam('utm_medium'),
      utmCampaign: getUtmParam('utm_campaign'),
      pageUrl: typeof window !== 'undefined' ? window.location.href : '',
      referrer: typeof window !== 'undefined' ? document.referrer : '',
      timestamp: new Date().toISOString(),
    };

    try {
      // Primary destination: Google Form. Fire in parallel with /api/leads
      // (server console log for QA / analytics). Google Form is no-cors so
      // we can't read its response — we treat it as success unless network errors.
      const [googleFormResult] = await Promise.all([
        submitToGoogleForm({ ...enrichedData, formPosition: position }),
        fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...enrichedData, formPosition: position }),
        }).catch((e) => {
          // /api/leads failure is non-blocking — Google Form is the source of truth
          console.warn('[/api/leads] non-blocking failure:', e);
        }),
      ]);

      if (!googleFormResult.configured) {
        console.warn(
          '[Lead Form] Google Form not configured. Lead captured in /api/leads ' +
          'console log only. Configure Google Form in lib/googleForm.ts to start ' +
          'persisting leads.'
        );
      }

      setSubmittedData(enrichedData);
      setSubmitState('success');

      trackLeadSubmit({
        state: config.slug,
        name: data.name,
        mobile: data.mobile,
        district: data.district,
        formPosition: position,
        whatsappPayload: {
          to: data.mobile,
          templateName: 'nursing_lead_confirmation_v1',
          params: {
            studentName: data.name,
            state: config.displayName,
            district: data.district,
            mobileForCallback: data.mobile,
            collegeWhatsapp: COLLEGE.whatsapp,
          },
          metadata: {
            utmSource: enrichedData.utmSource,
            utmMedium: enrichedData.utmMedium,
            utmCampaign: enrichedData.utmCampaign,
            pageUrl: enrichedData.pageUrl ?? '',
            referrer: enrichedData.referrer ?? '',
            timestamp: enrichedData.timestamp ?? '',
          },
        },
      });

      // Auto-redirect to WhatsApp after 3s on success
      setTimeout(() => {
        const waUrl = buildThankYouWhatsAppUrl({
          phone: config.whatsappNumber,
          name: data.name,
          state: config.displayName,
          district: data.district,
        });
        window.open(waUrl, '_blank', 'noopener');
      }, 3000);
    } catch (err) {
      console.error('[Lead Form Error]', err);
      setErrorMsg('Submission failed. Please try WhatsApp below.');
      setSubmitState('error');
    }
  };

  // ─── Success screen ───────────────────────────────────────────────────────
  if (submitState === 'success' && submittedData) {
    const waUrl = buildThankYouWhatsAppUrl({
      phone: config.whatsappNumber,
      name: submittedData.name,
      state: config.displayName,
      district: submittedData.district,
    });

    return (
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-form text-center animate-fade-in">
        <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-success" />
        </div>
        <h3 className="text-xl font-bold text-primary mb-2">Application Received! 🎉</h3>
        <p className="text-primary/60 text-sm mb-6">
          Thank you, <strong>{submittedData.name}</strong>! Our {config.displayName} admissions
          counsellor will call you within{' '}
          <strong className="text-accent">30 minutes</strong>.
          Redirecting you to WhatsApp for instant chat…
        </p>
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackWhatsAppClick('thank_you', config.slug)}
          className="btn-whatsapp w-full flex items-center justify-center gap-2 text-base no-tap-highlight"
        >
          <MessageCircle className="w-5 h-5" />
          Chat with Counsellor Now
        </a>
        <p className="text-xs text-primary/30 mt-3">Your info is safe. No spam. Only admission-related calls.</p>
      </div>
    );
  }

  // ─── Error screen ─────────────────────────────────────────────────────────
  if (submitState === 'error' && submittedData) {
    const fallbackUrl = buildFallbackWhatsAppUrl({
      phone: config.whatsappNumber,
      formData: submittedData as unknown as Record<string, unknown>,
      state: config.displayName,
    });

    return (
      <div className="bg-white rounded-2xl p-6 shadow-form text-center animate-fade-in">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h3 className="font-bold text-primary mb-1">Oops! Something went wrong.</h3>
        <p className="text-sm text-primary/60 mb-4">{errorMsg}</p>
        <a
          href={fallbackUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackWhatsAppClick('fallback', config.slug)}
          className="btn-whatsapp w-full flex items-center justify-center gap-2 no-tap-highlight"
        >
          <MessageCircle className="w-5 h-5" />
          Send Application via WhatsApp
        </a>
        <button
          onClick={() => setSubmitState('idle')}
          className="mt-3 text-sm text-accent hover:underline"
        >
          Try form again
        </button>
      </div>
    );
  }

  // ─── Mini form (3 fields — above fold) ───────────────────────────────────
  if (isMini) {
    return (
      <form
        id={`${formId}-mini`}
        onSubmit={handleSubmit(onSubmit)}
        onFocus={handleFirstInteraction}
        className="p-5"
        aria-label="Quick admission enquiry form"
        noValidate
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
          <p className="text-xs font-semibold text-success uppercase tracking-wide">Admissions Open — 2025</p>
        </div>
        <h3 className="font-bold text-primary text-lg mb-4">
          Quick Apply — Get a Call in 30 Min
        </h3>

        <div className="space-y-3">
          <div>
            <label htmlFor={`${formId}-name`} className="form-label">Full Name *</label>
            <input
              {...register('name')}
              id={`${formId}-name`}
              type="text"
              placeholder="Your full name"
              autoComplete="name"
              className="form-input"
              onBlur={() => handleFieldBlur('name')}
            />
            {errors.name && <p className="form-error"><AlertCircle className="w-3 h-3" />{errors.name.message}</p>}
          </div>

          <div>
            <label htmlFor={`${formId}-mobile`} className="form-label">Mobile Number *</label>
            <input
              {...register('mobile')}
              id={`${formId}-mobile`}
              type="tel"
              placeholder="10-digit mobile number"
              autoComplete="tel"
              maxLength={10}
              inputMode="numeric"
              className="form-input"
              onBlur={() => handleFieldBlur('mobile')}
            />
            {errors.mobile && <p className="form-error"><AlertCircle className="w-3 h-3" />{errors.mobile.message}</p>}
          </div>

          <div>
            <label htmlFor={`${formId}-district-mini`} className="form-label">Your City / District *</label>
            <select
              {...register('district')}
              id={`${formId}-district-mini`}
              className="form-input"
              onBlur={() => handleFieldBlur('district')}
            >
              <option value="">Select your district</option>
              {config.districts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            {errors.district && <p className="form-error"><AlertCircle className="w-3 h-3" />{errors.district.message}</p>}
          </div>

          {/* Hidden required fields — auto-set */}
          <input type="hidden" {...register('class12Status')} value="appearing" />
          <input type="hidden" {...register('consent')} value="true" />

          <button
            type="submit"
            disabled={submitState === 'loading'}
            className="btn-accent w-full flex items-center justify-center gap-2 no-tap-highlight"
          >
            {submitState === 'loading' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
            ) : (
              'Get Free Counselling Call →'
            )}
          </button>

          <p className="text-center text-xs text-primary/40">
            🔒 We respect your privacy. No spam calls.
          </p>
        </div>
      </form>
    );
  }

  // ─── Full form ────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl shadow-form overflow-hidden" id="apply">
      {/* Header bar */}
      <div className="bg-accent px-6 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-white/80 text-xs font-semibold uppercase tracking-wide">Admissions Open — 2025</span>
          </div>
          <h3 className="text-white font-bold text-lg">Apply for B.Sc Nursing</h3>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-white/70 text-xs">Response within</p>
          <p className="text-white font-bold">30 minutes</p>
        </div>
      </div>

      <form
        id={formId}
        onSubmit={handleSubmit(onSubmit)}
        onFocus={handleFirstInteraction}
        className="p-5 sm:p-6"
        aria-label="B.Sc Nursing admission enquiry form"
        noValidate
      >
        <div className="grid sm:grid-cols-2 gap-4">

          {/* Full Name */}
          <div>
            <label htmlFor={`${formId}-name-full`} className="form-label">Full Name *</label>
            <input
              {...register('name')}
              id={`${formId}-name-full`}
              type="text"
              placeholder="Your full name"
              autoComplete="name"
              className="form-input"
              onBlur={() => handleFieldBlur('name')}
            />
            {errors.name && <p className="form-error"><AlertCircle className="w-3 h-3" />{errors.name.message}</p>}
          </div>

          {/* Mobile */}
          <div>
            <label htmlFor={`${formId}-mobile-full`} className="form-label">Mobile Number *</label>
            <input
              {...register('mobile')}
              id={`${formId}-mobile-full`}
              type="tel"
              placeholder="10-digit mobile number"
              autoComplete="tel"
              maxLength={10}
              inputMode="numeric"
              className="form-input"
              onBlur={() => handleFieldBlur('mobile')}
            />
            {errors.mobile && <p className="form-error"><AlertCircle className="w-3 h-3" />{errors.mobile.message}</p>}
          </div>

          {/* WhatsApp same */}
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                {...register('whatsappSame')}
                type="checkbox"
                defaultChecked
                className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent cursor-pointer"
              />
              <span className="text-sm text-primary/70 group-hover:text-primary transition-colors">
                WhatsApp number is same as mobile number
              </span>
            </label>
          </div>

          {/* Email */}
          <div>
            <label htmlFor={`${formId}-email`} className="form-label">Email (optional)</label>
            <input
              {...register('email')}
              id={`${formId}-email`}
              type="email"
              placeholder="your@email.com"
              autoComplete="email"
              className="form-input"
            />
            {errors.email && <p className="form-error"><AlertCircle className="w-3 h-3" />{errors.email.message}</p>}
          </div>

          {/* District */}
          <div>
            <label htmlFor={`${formId}-district-full`} className="form-label">City / District *</label>
            <select
              {...register('district')}
              id={`${formId}-district-full`}
              className="form-input"
              onBlur={() => handleFieldBlur('district')}
            >
              <option value="">Select your district</option>
              {config.districts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            {errors.district && <p className="form-error"><AlertCircle className="w-3 h-3" />{errors.district.message}</p>}
          </div>

          {/* 12th Status */}
          <div>
            <label htmlFor={`${formId}-12th`} className="form-label">12th Board Status *</label>
            <select
              {...register('class12Status')}
              id={`${formId}-12th`}
              className="form-input"
              onBlur={() => handleFieldBlur('class12Status')}
            >
              <option value="">Select status</option>
              <option value="appearing">Currently Appearing (2025)</option>
              <option value="passed">Already Passed</option>
              <option value="result_awaited">Result Awaited</option>
            </select>
            {errors.class12Status && (
              <p className="form-error"><AlertCircle className="w-3 h-3" />{errors.class12Status.message}</p>
            )}
          </div>

          {/* 12th Percentage — conditional */}
          {class12Status === 'passed' && (
            <div className="animate-fade-in">
              <label htmlFor={`${formId}-pct`} className="form-label">12th Percentage *</label>
              <input
                {...register('class12Percentage')}
                id={`${formId}-pct`}
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="e.g. 72.5"
                inputMode="decimal"
                className="form-input"
              />
              {errors.class12Percentage && (
                <p className="form-error"><AlertCircle className="w-3 h-3" />{errors.class12Percentage.message}</p>
              )}
            </div>
          )}

          {/* Hostel */}
          <div>
            <p className="form-label mb-2">Hostel Required? *</p>
            <div className="flex gap-3">
              {(['yes', 'no'] as const).map((v) => (
                <label
                  key={v}
                  className={`flex-1 flex items-center justify-center gap-2 border-2 rounded-xl py-2.5 cursor-pointer transition-all text-sm font-semibold capitalize ${
                    watch('hostelRequired') === v
                      ? 'border-accent bg-accent/5 text-accent'
                      : 'border-gray-200 text-primary/50 hover:border-gray-300'
                  }`}
                >
                  <input
                    {...register('hostelRequired')}
                    type="radio"
                    value={v}
                    className="sr-only"
                    defaultChecked={v === 'yes'}
                  />
                  {v === 'yes' ? '✅ Yes' : '🏠 No'}
                </label>
              ))}
            </div>
          </div>

          {/* Best time to call */}
          <div>
            <label htmlFor={`${formId}-time`} className="form-label">Best Time to Call</label>
            <select {...register('bestTimeToCall')} id={`${formId}-time`} className="form-input">
              <option value="">Anytime</option>
              <option value="morning">Morning (9 AM – 12 PM)</option>
              <option value="afternoon">Afternoon (12 PM – 4 PM)</option>
              <option value="evening">Evening (4 PM – 8 PM)</option>
            </select>
          </div>

          {/* Consent */}
          <div className="sm:col-span-2">
            <label className="flex items-start gap-2.5 cursor-pointer group">
              <input
                {...register('consent')}
                type="checkbox"
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent cursor-pointer shrink-0"
              />
              <span className="text-sm text-primary/70 leading-relaxed">
                I agree to be contacted by the {COLLEGE.shortName} admissions team via call and WhatsApp regarding my enquiry. *
              </span>
            </label>
            {errors.consent && (
              <p className="form-error mt-1"><AlertCircle className="w-3 h-3" />{errors.consent.message}</p>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="mt-5">
          <button
            type="submit"
            disabled={submitState === 'loading'}
            className="btn-accent w-full text-base py-4 flex items-center justify-center gap-2 no-tap-highlight hover:scale-[1.01] transition-transform"
          >
            {submitState === 'loading' ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Submitting your application…</>
            ) : (
              <>🎓 Submit Application — Get Call in 30 Min</>
            )}
          </button>

          <p className="text-center text-xs text-primary/40 mt-2">
            🔒 We respect your privacy. No spam calls. Only admission-related contact.
          </p>
        </div>
      </form>
    </div>
  );
}
