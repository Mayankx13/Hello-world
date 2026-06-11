"use client";

import type { ReactNode } from "react";
import { trackCtaClick } from "@/lib/analytics";

/**
 * Anchor that reports a `cta_click` dataLayer event (GTM → Pixel) on click.
 */
export default function CtaLink({
  href,
  ctaId,
  location,
  className,
  children,
}: {
  href: string;
  ctaId: string;
  location: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={() => trackCtaClick(ctaId, location)}
    >
      {children}
    </a>
  );
}
