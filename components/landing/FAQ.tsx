'use client';

import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { StateConfig } from '@/config/states';

interface Props {
  config: StateConfig;
}

export default function FAQ({ config }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-14 px-4 bg-white" id="faq">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <span className="inline-block bg-accent/10 text-accent text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-3">
            FAQs
          </span>
          <h2 className="section-title">
            Questions from{' '}
            <span className="text-accent">{config.displayName} Families</span>
          </h2>
          <p className="section-subtitle">
            Common questions asked by students and parents from {config.displayName}.
          </p>
        </div>

        {/* Schema.org FAQ markup */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: config.faqs.map((faq) => ({
                '@type': 'Question',
                name: faq.question,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: faq.answer,
                },
              })),
            }),
          }}
        />

        {/* Accordion */}
        <div className="space-y-3">
          {config.faqs.map((faq, i) => (
            <div
              key={i}
              className={`border rounded-2xl overflow-hidden transition-all duration-200 ${
                openIndex === i
                  ? 'border-accent/30 shadow-card'
                  : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              <button
                className="w-full flex items-center gap-3 p-4 sm:p-5 text-left group"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                aria-expanded={openIndex === i}
              >
                <div
                  className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                    openIndex === i ? 'bg-accent text-white' : 'bg-cream text-primary/40'
                  }`}
                >
                  <HelpCircle className="w-4 h-4" />
                </div>
                <span className="flex-1 font-semibold text-primary text-sm sm:text-base leading-snug">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`w-5 h-5 text-primary/40 shrink-0 transition-transform duration-200 ${
                    openIndex === i ? 'rotate-180 text-accent' : ''
                  }`}
                />
              </button>

              {openIndex === i && (
                <div className="px-4 sm:px-5 pb-5 pt-0 animate-fade-in">
                  <div className="ml-10 text-primary/70 text-sm leading-relaxed border-l-2 border-accent/20 pl-4">
                    {faq.answer}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Still have questions */}
        <div className="mt-8 bg-cream rounded-2xl p-5 text-center">
          <p className="font-semibold text-primary mb-2">Still have questions?</p>
          <p className="text-sm text-primary/60 mb-4">
            Our {config.displayName} admissions counsellor is available on WhatsApp — get answers in minutes.
          </p>
          <a
            href="#apply"
            className="btn-accent inline-block no-tap-highlight"
          >
            Talk to a Counsellor →
          </a>
        </div>
      </div>
    </section>
  );
}
