"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { track, type AnalyticsEvent } from "@/lib/analytics";

/**
 * <section> that pushes a dataLayer event the first time it scrolls
 * into view (≥20% visible). Children stay server-rendered.
 */
export default function TrackedSection({
  id,
  className,
  event,
  children,
}: {
  id: string;
  className?: string;
  event: AnalyticsEvent;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          track(event);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [event]);

  return (
    <section ref={ref} id={id} className={className}>
      {children}
    </section>
  );
}
