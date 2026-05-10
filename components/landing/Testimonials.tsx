'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Quote, Play, Star, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { StateConfig } from '@/config/states';

interface Props {
  config: StateConfig;
}

export default function Testimonials({ config }: Props) {
  const [active, setActive] = useState(0);
  const [videoOpen, setVideoOpen] = useState(false);
  const { testimonials } = config;
  const videoTestimonial = testimonials.find((t) => t.videoUrl);

  return (
    <section className="py-14 px-4 bg-cream" id="testimonials">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <span className="inline-block bg-accent/10 text-accent text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-3">
            Student Stories
          </span>
          <h2 className="section-title">
            What {config.displayName} Students{' '}
            <span className="text-accent">Say About Us</span>
          </h2>
          <p className="section-subtitle">
            Real stories from real graduates — not actors, not stock photos.
          </p>
        </div>

        {/* Featured testimonial — large card */}
        <div className="bg-white rounded-2xl shadow-form p-6 sm:p-8 mb-6 relative overflow-hidden">
          <Quote className="absolute top-4 right-4 w-16 h-16 text-accent/10" />

          <div className="flex flex-col sm:flex-row gap-6">
            {/* Photo */}
            <div className="shrink-0">
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-cream">
                <Image
                  src={testimonials[active].photo}
                  alt={testimonials[active].name}
                  fill
                  className="object-cover"
                  sizes="96px"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                {/* Fallback avatar */}
                <div className="absolute inset-0 flex items-center justify-center bg-accent/10">
                  <span className="text-3xl font-bold text-accent">
                    {testimonials[active].name.charAt(0)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1">
              {/* Stars */}
              <div className="flex gap-0.5 mb-3">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className="w-4 h-4 fill-accent text-accent" />
                ))}
              </div>

              {/* Quote */}
              <blockquote className="text-primary/80 text-base sm:text-lg leading-relaxed italic mb-4">
                &quot;{testimonials[active].quote}&quot;
              </blockquote>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div>
                  <p className="font-bold text-primary">{testimonials[active].name}</p>
                  <div className="flex items-center gap-1 text-xs text-primary/50">
                    <MapPin className="w-3 h-3" />
                    <span>{testimonials[active].hometown}, {config.displayName}</span>
                    <span className="mx-1">·</span>
                    <span>Batch {testimonials[active].batch}</span>
                  </div>
                  {testimonials[active].currentEmployer && (
                    <p className="text-xs text-accent font-semibold mt-0.5">
                      📍 {testimonials[active].currentEmployer}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-50">
            <div className="flex gap-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    i === active ? 'bg-accent w-6' : 'bg-gray-200 hover:bg-gray-300'
                  }`}
                  aria-label={`Testimonial ${i + 1}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setActive((a) => (a - 1 + testimonials.length) % testimonials.length)}
                className="p-2 rounded-lg bg-cream hover:bg-gray-100 text-primary transition-colors"
                aria-label="Previous testimonial"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActive((a) => (a + 1) % testimonials.length)}
                className="p-2 rounded-lg bg-cream hover:bg-gray-100 text-primary transition-colors"
                aria-label="Next testimonial"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Small cards grid */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          {testimonials.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setActive(i)}
              className={`text-left bg-white rounded-2xl p-4 shadow-card border-2 transition-all hover:shadow-form ${
                i === active ? 'border-accent' : 'border-transparent'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-cream shrink-0">
                  <Image
                    src={t.photo}
                    alt={t.name}
                    fill
                    className="object-cover"
                    sizes="40px"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-accent/10">
                    <span className="text-sm font-bold text-accent">{t.name.charAt(0)}</span>
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-primary text-sm">{t.name}</p>
                  <p className="text-xs text-primary/50">{t.hometown} · {t.batch}</p>
                </div>
              </div>
              <p className="text-xs text-primary/60 line-clamp-2">&quot;{t.quote}&quot;</p>
            </button>
          ))}
        </div>

        {/* Video testimonial slot */}
        {videoTestimonial && (
          <div className="bg-white rounded-2xl overflow-hidden shadow-card">
            <div className="relative aspect-video bg-primary cursor-pointer" onClick={() => setVideoOpen(true)}>
              {/* Thumbnail */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform">
                  <Play className="w-7 h-7 text-white ml-1" />
                </div>
                <p className="text-white font-semibold">Watch {videoTestimonial.name}&apos;s Story</p>
                <p className="text-white/50 text-sm">{videoTestimonial.hometown} · Batch {videoTestimonial.batch}</p>
              </div>
            </div>

            {/* Video modal */}
            {videoOpen && videoTestimonial.videoUrl && (
              <div
                className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                onClick={() => setVideoOpen(false)}
              >
                <div
                  className="w-full max-w-3xl aspect-video rounded-2xl overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <iframe
                    src={`${videoTestimonial.videoUrl}?autoplay=1`}
                    className="w-full h-full"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                    title={`${videoTestimonial.name} testimonial`}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
