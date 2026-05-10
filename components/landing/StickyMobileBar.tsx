'use client';

import { Phone, MessageCircle, ClipboardList } from 'lucide-react';
import { StateConfig, COLLEGE } from '@/config/states';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { trackWhatsAppClick, trackPhoneClick } from '@/lib/analytics';

interface Props {
  config: StateConfig;
}

export default function StickyMobileBar({ config }: Props) {
  const waUrl = buildWhatsAppUrl({
    phone: config.whatsappNumber,
    message: config.whatsappPrefill
      .replace('{name}', 'Student')
      .replace('{state}', config.displayName),
  });

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div className="grid grid-cols-3 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(10,37,64,0.12)]">

        {/* Call */}
        <a
          href={`tel:${COLLEGE.phone}`}
          onClick={() => trackPhoneClick(config.slug)}
          className="no-tap-highlight flex flex-col items-center justify-center py-3 gap-1 text-primary hover:bg-cream transition-colors"
          aria-label="Call admissions"
        >
          <div className="w-9 h-9 bg-primary/5 rounded-xl flex items-center justify-center">
            <Phone className="w-5 h-5 text-primary" />
          </div>
          <span className="text-xs font-semibold text-primary/70">Call</span>
        </a>

        {/* WhatsApp — prominent center */}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackWhatsAppClick('sticky_bar', config.slug)}
          className="no-tap-highlight flex flex-col items-center justify-center py-2 gap-1 bg-whatsapp relative"
          aria-label="WhatsApp chat"
        >
          {/* Notch effect */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-14 h-14 bg-whatsapp rounded-full flex items-center justify-center shadow-lg border-4 border-white">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <span className="text-xs font-bold text-white mt-6">WhatsApp</span>
        </a>

        {/* Apply Now */}
        <a
          href="#apply"
          className="no-tap-highlight flex flex-col items-center justify-center py-3 gap-1 bg-accent"
          aria-label="Apply for admission"
        >
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <span className="text-xs font-bold text-white">Apply</span>
        </a>
      </div>
    </div>
  );
}
