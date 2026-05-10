import { Phone, Mail, MapPin, Instagram, Facebook, Youtube } from 'lucide-react';
import { COLLEGE } from '@/config/states';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-primary text-white pt-12 pb-24 md:pb-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">

          {/* College info */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">{COLLEGE.shortName.slice(0, 2)}</span>
              </div>
              <div>
                <p className="font-bold text-white">{COLLEGE.name}</p>
                <p className="text-white/50 text-xs">B.Sc Nursing College · Punjab</p>
              </div>
            </div>
            <p className="text-white/60 text-sm leading-relaxed mb-4">
              INC Approved · NMC Recognized · {COLLEGE.affiliation}.
              Empowering North Indian girls to build world-class nursing careers since 2016.
            </p>
            {/* Social links */}
            <div className="flex gap-3">
              <a
                href={COLLEGE.socialInstagram}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 bg-white/10 hover:bg-accent rounded-lg flex items-center justify-center transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href={COLLEGE.socialFacebook}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 bg-white/10 hover:bg-accent rounded-lg flex items-center justify-center transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="w-4 h-4" />
              </a>
              <a
                href={COLLEGE.socialYoutube}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 bg-white/10 hover:bg-accent rounded-lg flex items-center justify-center transition-colors"
                aria-label="YouTube"
              >
                <Youtube className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-bold text-white mb-4">Contact Us</h3>
            <div className="space-y-3">
              <a
                href={`tel:${COLLEGE.phone}`}
                className="flex items-start gap-2.5 text-white/60 hover:text-white transition-colors text-sm group"
              >
                <Phone className="w-4 h-4 shrink-0 mt-0.5 group-hover:text-accent transition-colors" />
                <span>{COLLEGE.phone}</span>
              </a>
              <a
                href={`mailto:${COLLEGE.email}`}
                className="flex items-start gap-2.5 text-white/60 hover:text-white transition-colors text-sm group"
              >
                <Mail className="w-4 h-4 shrink-0 mt-0.5 group-hover:text-accent transition-colors" />
                <span>{COLLEGE.email}</span>
              </a>
              <a
                href={COLLEGE.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2.5 text-white/60 hover:text-white transition-colors text-sm group"
              >
                <MapPin className="w-4 h-4 shrink-0 mt-0.5 group-hover:text-accent transition-colors" />
                <span>{COLLEGE.address}</span>
              </a>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="font-bold text-white mb-4">Quick Links</h3>
            <ul className="space-y-2">
              {[
                { label: 'About College', href: '#hero' },
                { label: 'Hostel Facilities', href: '#hostel' },
                { label: 'Course Details', href: '#course' },
                { label: 'Placements', href: '#placements' },
                { label: 'Testimonials', href: '#testimonials' },
                { label: 'Apply Now', href: '#apply' },
                { label: 'Privacy Policy', href: '/privacy' },
              ].map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-white/60 hover:text-white text-sm transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Accreditation strip */}
        <div className="border-t border-white/10 pt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-3">
            {COLLEGE.approvals.map((approval) => (
              <span
                key={approval}
                className="text-xs bg-white/10 text-white/60 px-3 py-1 rounded-full"
              >
                ✓ {approval}
              </span>
            ))}
          </div>
          <p className="text-white/30 text-xs">
            © {currentYear} {COLLEGE.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
