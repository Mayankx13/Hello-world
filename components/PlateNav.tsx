"use client";

import { useEffect, useState } from "react";
import { nav, site } from "@/lib/content";
import { trackCtaClick } from "@/lib/analytics";

/**
 * Fixed top bar: wordmark, numbered section nav (02–08) with
 * scroll-position highlighting, and the persistent Book CTA.
 */
export default function PlateNav() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const sections = nav.links
      .map((l) => document.querySelector<HTMLElement>(l.href))
      .filter((el): el is HTMLElement => el !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(`#${entry.target.id}`);
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      className={`topbar${scrolled ? " is-scrolled" : ""}`}
      aria-label={nav.ariaLabel}
    >
      <a className="wordmark" href="#top">
        <span className="mark">{site.name}</span>
        <span className="tag">{site.tagline}</span>
      </a>
      <div className="plate-nav" aria-label={nav.sectionsAriaLabel}>
        {nav.links.map((link) => (
          <a
            key={link.num}
            href={link.href}
            aria-label={`${link.label} — section ${link.num}`}
            className={active === link.href ? "is-active" : undefined}
          >
            {link.num}
          </a>
        ))}
      </div>
      <a
        className="btn btn-primary"
        href="#book"
        onClick={() => trackCtaClick("book_sprint", "topbar")}
      >
        {nav.cta}
      </a>
    </nav>
  );
}
