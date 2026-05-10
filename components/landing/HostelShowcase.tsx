'use client';

import Image from 'next/image';
import { useState } from 'react';
import {
  Shield, Wifi, Utensils, Zap, Droplets, BookOpen,
  Heart, Users, Camera, Clock, CheckCircle2, Star
} from 'lucide-react';
import { COLLEGE } from '@/config/states';

// SWAP: replace these with real hostel photo paths (WebP, ~800px wide)
const HOSTEL_PHOTOS = [
  { src: '/images/hostel/room.jpg', alt: 'Hostel rooms — clean, well-furnished double occupancy' },
  { src: '/images/hostel/mess.jpg', alt: 'Mess hall — home-style North Indian meals' },
  { src: '/images/hostel/common-area.jpg', alt: 'Common area — comfortable lounge with TV' },
  { src: '/images/hostel/study-room.jpg', alt: 'Study room — quiet, well-lit, Wi-Fi enabled' },
  { src: '/images/hostel/gate.jpg', alt: 'Hostel gate — biometric entry, 24/7 security' },
  { src: '/images/hostel/medical.jpg', alt: 'Medical room — 24/7 nurse on duty' },
];

const FEATURES = [
  {
    icon: Shield,
    label: '24/7 CCTV + Female Wardens',
    desc: 'Every corridor, entrance, and common area monitored. Female wardens on each floor round the clock.',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    icon: Camera,
    label: 'Biometric Entry + Visitor Log',
    desc: 'Residents enter via fingerprint only. All visitors logged. No unauthorized entry possible.',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  {
    icon: Utensils,
    label: 'Home-Style Mess',
    desc: 'Veg + non-veg North Indian meals, 3 times daily. Seasonal menu, pure ingredients, no compromise.',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
  },
  {
    icon: Wifi,
    label: 'High-Speed Wi-Fi',
    desc: '50 Mbps campus-wide Wi-Fi included. Study resources, video calls home, Netflix — no data worries.',
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  {
    icon: BookOpen,
    label: 'Dedicated Study Room',
    desc: 'Quiet, air-conditioned study room with reference books, printer access, and whiteboard space.',
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
  },
  {
    icon: Heart,
    label: 'Medical Room — 24/7 Nurse',
    desc: 'On-campus nurse, first-aid, BP/temperature monitoring. Doctor on call for emergencies.',
    color: 'text-red-600',
    bg: 'bg-red-50',
  },
  {
    icon: Zap,
    label: 'Power Backup',
    desc: 'Full power backup via generator — no interruptions to studying or charging devices.',
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
  },
  {
    icon: Droplets,
    label: 'RO Purified Water',
    desc: 'RO + UV purified drinking water on every floor. No need to buy bottled water.',
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
  },
  {
    icon: Users,
    label: 'Visiting Hours for Parents',
    desc: 'Parents welcome every Sunday 10 AM – 4 PM. Guest room available for outstation parents.',
    color: 'text-teal-600',
    bg: 'bg-teal-50',
  },
  {
    icon: Clock,
    label: 'Laundry Service',
    desc: 'In-house laundry machines. Clothes washed and dried — no extra charges, included in hostel fee.',
    color: 'text-pink-600',
    bg: 'bg-pink-50',
  },
];

export default function HostelShowcase() {
  const [activePhoto, setActivePhoto] = useState(0);

  return (
    <section className="py-14 px-4 bg-white" id="hostel">
      <div className="max-w-6xl mx-auto">

        {/* Section header */}
        <div className="text-center mb-10">
          <span className="inline-block bg-accent/10 text-accent text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-3">
            Hostel Life
          </span>
          <h2 className="section-title">
            Your Home Away From Home —{' '}
            <span className="text-accent">Safe & Comfortable</span>
          </h2>
          <p className="section-subtitle max-w-xl mx-auto">
            300-seat girls&apos; hostel on campus. Every parent who visits says:
            <em className="text-accent font-semibold"> &quot;Safer than we expected.&quot;</em>
          </p>
        </div>

        {/* Photo gallery */}
        <div className="mb-12">
          {/* Main photo */}
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-form mb-3">
            <Image
              src={HOSTEL_PHOTOS[activePhoto].src}
              alt={HOSTEL_PHOTOS[activePhoto].alt}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 896px"
              // SWAP: replace with real hostel photos
              onError={(e) => {
                // Show placeholder gradient when image missing
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            {/* Fallback gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center -z-0">
              <div className="text-center text-white/40">
                <Camera className="w-12 h-12 mx-auto mb-2" />
                <p className="text-sm">
                  {/* SWAP instruction */}
                  Hostel photo — swap in config/states.ts → HOSTEL_PHOTOS
                </p>
              </div>
            </div>

            {/* Photo label */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 p-4">
              <p className="text-white text-sm font-medium">{HOSTEL_PHOTOS[activePhoto].alt}</p>
            </div>
          </div>

          {/* Thumbnail strip */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {HOSTEL_PHOTOS.map((photo, i) => (
              <button
                key={i}
                onClick={() => setActivePhoto(i)}
                className={`shrink-0 relative w-20 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                  activePhoto === i
                    ? 'border-accent shadow-md scale-105'
                    : 'border-transparent hover:border-accent/40'
                }`}
                aria-label={photo.alt}
              >
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  className="object-cover"
                  sizes="80px"
                  onError={(e) => {
                    (e.target as HTMLImageElement).parentElement!.style.background =
                      '#E8EFF6';
                  }}
                />
                {/* Fallback mini color */}
                <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                  <Camera className="w-4 h-4 text-primary/30" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Transparent fee callout */}
        <div className="bg-accent/5 border-2 border-accent/20 rounded-2xl p-5 mb-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-accent mb-1">
              All-Inclusive Hostel Fee
            </p>
            <p className="text-3xl font-extrabold text-primary">
              {COLLEGE.hostelFeePerYear}
              <span className="text-lg font-semibold text-primary/60"> / year</span>
            </p>
            <p className="text-sm text-primary/60 mt-1">
              Includes room · meals · Wi-Fi · laundry · power backup · RO water · medical room
            </p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className="w-4 h-4 fill-accent text-accent" />
              ))}
            </div>
            <p className="text-xs text-primary/50">Rated by 1,200+ parents</p>
          </div>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FEATURES.map((f, i) => (
            <div key={i} className="hostel-feature group hover:shadow-form transition-shadow duration-200">
              <div className={`${f.bg} p-2.5 rounded-xl shrink-0`}>
                <f.icon className={`w-5 h-5 ${f.color}`} />
              </div>
              <div>
                <p className="font-semibold text-primary text-sm">{f.label}</p>
                <p className="text-primary/55 text-xs leading-relaxed mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Parent guarantee strip */}
        <div className="mt-8 bg-primary rounded-2xl p-5 flex items-center gap-4">
          <CheckCircle2 className="w-8 h-8 text-accent shrink-0" />
          <div>
            <p className="text-white font-bold">
              Parents&apos; Satisfaction Guarantee
            </p>
            <p className="text-white/60 text-sm">
              Visit any day before admission — see the hostel, meet the wardens, inspect the mess.
              100% parents who visit leave satisfied. We have nothing to hide.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
