'use client';

import { useState, useEffect } from 'react';
import { Phone, MessageCircle, Menu, X } from 'lucide-react';
import { StateConfig, COLLEGE } from '@/config/states';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { trackWhatsAppClick, trackPhoneClick } from '@/lib/analytics';

interface Props {
  config: StateConfig;
}

export default function StickyHeader({ config }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const waUrl = buildWhatsAppUrl({
    phone: config.whatsappNumber,
    message: config.whatsappPrefill
      .replace('{name}', 'Student')
      .replace('{state}', config.displayName),
  });

  const navLinks = [
    { label: 'Hostel', href: '#hostel' },
    { label: 'Course', href: '#course' },
    { label: 'Placements', href: '#placements' },
    { label: 'Testimonials', href: '#testimonials' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-primary shadow-lg' : 'bg-primary/95 backdrop-blur-sm'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3 shrink-0">
          {/* SWAP: replace with <Image src="/images/logo.png" ... /> */}
          <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-white font-bold text-sm">DN</span>
          </div>
          <div className="hidden sm:block">
            <div className="text-white font-bold text-sm leading-tight">{COLLEGE.shortName}</div>
            <div className="text-white/60 text-xs">B.Sc Nursing College · Punjab</div>
          </div>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-white/70 hover:text-white text-sm font-medium transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* CTAs */}
        <div className="flex items-center gap-2 shrink-0">
          {/* WhatsApp icon */}
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWhatsAppClick('header', config.slug)}
            className="no-tap-highlight flex items-center justify-center w-9 h-9 bg-whatsapp rounded-lg hover:opacity-90 transition-opacity"
            aria-label="Chat on WhatsApp"
          >
            <MessageCircle className="w-4 h-4 text-white" />
          </a>

          {/* Phone icon — mobile only */}
          <a
            href={`tel:${COLLEGE.phone}`}
            onClick={() => trackPhoneClick(config.slug)}
            className="no-tap-highlight flex md:hidden items-center justify-center w-9 h-9 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
            aria-label="Call us"
          >
            <Phone className="w-4 h-4 text-white" />
          </a>

          {/* Apply Now CTA — desktop */}
          <a
            href="#apply"
            className="hidden md:flex btn-accent text-sm py-2 px-4 no-tap-highlight"
          >
            Apply Now
          </a>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden no-tap-highlight flex items-center justify-center w-9 h-9 text-white/80 hover:text-white"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-primary border-t border-white/10 px-4 py-3">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="block text-white/80 hover:text-white py-2 text-sm font-medium"
            >
              {l.label}
            </a>
          ))}
          <a
            href="#apply"
            onClick={() => setMenuOpen(false)}
            className="mt-2 block w-full text-center btn-accent text-sm"
          >
            Apply Now
          </a>
        </div>
      )}
    </header>
  );
}
