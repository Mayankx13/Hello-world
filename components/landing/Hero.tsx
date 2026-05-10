'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ShieldCheck, Award, BookOpen, ChevronDown, MessageCircle, Users, GraduationCap, Home } from 'lucide-react';
import { StateConfig, COLLEGE } from '@/config/states';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { trackWhatsAppClick } from '@/lib/analytics';

interface Props {
  config: StateConfig;
  miniFormSlot?: React.ReactNode;
}

interface CounterProps {
  target: number;
  suffix?: string;
  duration?: number;
}

function AnimatedCounter({ target, suffix = '', duration = 1500 }: CounterProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start = Math.min(start + step, target);
      setCount(Math.floor(start));
      if (start >= target) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);

  return (
    <span>
      {count.toLocaleString('en-IN')}
      {suffix}
    </span>
  );
}

export default function Hero({ config, miniFormSlot }: Props) {
  const [countersVisible, setCountersVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setCountersVisible(true), 600);
    return () => clearTimeout(timer);
  }, []);

  const waUrl = buildWhatsAppUrl({
    phone: config.whatsappNumber,
    message: config.whatsappPrefill
      .replace('{name}', 'Student')
      .replace('{state}', config.displayName),
  });

  return (
    <section className="relative min-h-screen flex flex-col overflow-hidden" id="hero">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src={config.heroImage}
          alt={`${COLLEGE.name} campus — ${config.displayName}`}
          fill
          className="object-cover object-center"
          priority
          sizes="100vw"
          // SWAP: replace heroImage in config/states.ts with real photo path
          onError={(e) => {
            // Fallback to gradient if image fails
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        {/* Gradient overlay — primary deep blue */}
        <div className="absolute inset-0 bg-hero-gradient" />
        {/* Extra mobile darkening for readability */}
        <div className="absolute inset-0 bg-primary/20 md:bg-transparent" />
      </div>

      {/* Fallback background when image not loaded */}
      <div className="absolute inset-0 z-[-1] bg-gradient-to-br from-primary via-primary-600 to-primary-700" />

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col pt-20 pb-6">
        <div className="max-w-6xl mx-auto px-4 w-full flex-1 flex flex-col lg:flex-row items-start lg:items-center gap-8 py-8">

          {/* Left: Copy */}
          <div className="flex-1 animate-fade-in">
            {/* Trust badges */}
            <div className="flex flex-wrap gap-2 mb-5">
              {COLLEGE.approvals.map((badge) => (
                <span key={badge} className="trust-badge">
                  <ShieldCheck className="w-3 h-3" />
                  {badge}
                </span>
              ))}
            </div>

            {/* Headline */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight text-balance mb-3">
              {config.heroHeadline}
            </h1>

            {/* Subhead — English */}
            <p className="text-white/80 text-base sm:text-lg mb-2 font-medium">
              {config.heroSubheadEnglish}
            </p>

            {/* Subhead — Regional script */}
            <p className="text-devanagari text-white/70 text-base sm:text-lg mb-6 font-medium">
              {config.heroSubheadRegional}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <a
                href="#apply"
                className="btn-accent text-center text-base sm:text-lg py-4 px-8 no-tap-highlight rounded-2xl shadow-xl hover:scale-105 transition-transform"
              >
                🏥 Reserve Your Hostel Seat
              </a>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick('hero', config.slug)}
                className="btn-whatsapp text-center text-base sm:text-lg py-4 px-6 no-tap-highlight rounded-2xl flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-5 h-5" />
                Chat on WhatsApp
              </a>
            </div>

            {/* Microcopy */}
            <p className="text-white/50 text-xs">
              🔒 Your details are safe. No spam. Counsellor calls only.
            </p>
          </div>

          {/* Right: Mini form on desktop / video slot */}
          <div className="w-full lg:w-[420px] shrink-0">
            {/* Mini form (above fold) */}
            {miniFormSlot && (
              <div className="bg-white rounded-2xl shadow-form overflow-hidden">
                {miniFormSlot}
              </div>
            )}

            {/* Optional video embed slot — desktop only */}
            {/* SWAP: Add YouTube video ID in env or config to enable */}
            {/*
            <div className="hidden lg:block mt-4 rounded-2xl overflow-hidden aspect-video">
              <iframe
                src="https://www.youtube.com/embed/VIDEO_ID?autoplay=1&mute=1&loop=1&playlist=VIDEO_ID"
                className="w-full h-full"
                allow="autoplay; encrypted-media"
                allowFullScreen
                title="Campus tour"
              />
            </div>
            */}
          </div>
        </div>

        {/* Stats counter strip */}
        <div className="max-w-6xl mx-auto px-4 w-full mt-auto">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-4 py-4">
            <div className="grid grid-cols-3 divide-x divide-white/20">
              <div className="text-center px-3">
                <div className="flex justify-center mb-1">
                  <Users className="w-5 h-5 text-accent" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white">
                  {countersVisible ? <AnimatedCounter target={1200} suffix="+" /> : '0+'}
                </div>
                <div className="text-white/60 text-xs mt-0.5">Students Placed</div>
              </div>
              <div className="text-center px-3">
                <div className="flex justify-center mb-1">
                  <GraduationCap className="w-5 h-5 text-accent" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white">
                  {countersVisible ? <AnimatedCounter target={8} /> : '0'}
                </div>
                <div className="text-white/60 text-xs mt-0.5">Batches Graduated</div>
              </div>
              <div className="text-center px-3">
                <div className="flex justify-center mb-1">
                  <Home className="w-5 h-5 text-accent" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white">
                  {countersVisible ? <AnimatedCounter target={300} /> : '0'}
                </div>
                <div className="text-white/60 text-xs mt-0.5">Hostel Capacity</div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="flex justify-center mt-6 animate-bounce-slow">
          <ChevronDown className="w-6 h-6 text-white/40" />
        </div>
      </div>
    </section>
  );
}
