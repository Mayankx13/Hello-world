'use client';

import { useEffect } from 'react';
import { StateConfig } from '@/config/states';
import { trackPageView } from '@/lib/analytics';
import StickyHeader from './StickyHeader';
import Hero from './Hero';
import WhyUs from './WhyUs';
import HostelShowcase from './HostelShowcase';
import CourseDetails from './CourseDetails';
import Placements from './Placements';
import Testimonials from './Testimonials';
import FAQ from './FAQ';
import Footer from './Footer';
import StickyMobileBar from './StickyMobileBar';
import ExitIntent from './ExitIntent';
import LeadForm from './LeadForm';

interface Props {
  config: StateConfig;
}

export default function LandingPage({ config }: Props) {
  useEffect(() => {
    trackPageView(config.slug);
  }, [config.slug]);

  return (
    <>
      <StickyHeader config={config} />

      <main>
        {/* ── 1. Hero — above the fold ──────────────────────────────────── */}
        {/* Mini form rendered inside Hero (above fold — ≤1 thumb scroll on 6.1" mobile) */}
        <Hero
          config={config}
          miniFormSlot={
            <LeadForm config={config} variant="mini" position="hero_mini" />
          }
        />

        {/* ── 2. Why [State] Students Choose Us ────────────────────────── */}
        <WhyUs config={config} />

        {/* ── 3. Hostel Showcase — priority section ────────────────────── */}
        <HostelShowcase />

        {/* ── 4. Lead Form — mid-page (full form) ─────────────────────── */}
        <section className="py-14 px-4 bg-cream" id="apply">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <span className="inline-block bg-accent/10 text-accent text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-3">
                Apply Now
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-primary">
                Reserve Your Seat for{' '}
                <span className="text-accent">2025 Batch</span>
              </h2>
              <p className="text-primary/60 text-sm mt-2">
                Fill the form — our {config.displayName} counsellor will call you back within 30 minutes.
              </p>
            </div>
            <LeadForm config={config} variant="full" position="mid_page" />
          </div>
        </section>

        {/* ── 5. Course Details ─────────────────────────────────────────── */}
        <CourseDetails />

        {/* ── 6. Placements ────────────────────────────────────────────── */}
        <Placements />

        {/* ── 7. Testimonials ──────────────────────────────────────────── */}
        <Testimonials config={config} />

        {/* ── 8. FAQ ───────────────────────────────────────────────────── */}
        <FAQ config={config} />

        {/* ── 9. Lead Form — bottom of page (full form, second instance) ─ */}
        <section className="py-14 px-4 bg-primary" id="apply-bottom">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white">
                Ready to Join? Apply in{' '}
                <span className="text-accent">60 Seconds</span>
              </h2>
              <p className="text-white/60 text-sm mt-2">
                Seats are filling fast for {config.displayName} students. Apply today.
              </p>
            </div>
            <LeadForm config={config} variant="full" position="bottom" />
          </div>
        </section>

        {/* ── 10. Footer ───────────────────────────────────────────────── */}
        <Footer />
      </main>

      {/* ── Fixed elements ───────────────────────────────────────────────── */}
      <StickyMobileBar config={config} />
      <ExitIntent config={config} />
    </>
  );
}
