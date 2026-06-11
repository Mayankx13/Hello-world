import { footer } from "@/lib/content";
import CtaLink from "@/components/CtaLink";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <span className="mark">{footer.mark}</span>
        <span className="f-tag">{footer.tag}</span>
        <span className="f-links">
          {footer.links.map((link) =>
            link.href === "#book" ? (
              <CtaLink
                key={link.label}
                href={link.href}
                ctaId="book_sprint"
                location="footer"
              >
                {link.label}
              </CtaLink>
            ) : (
              <a key={link.label} href={link.href}>
                {link.label}
              </a>
            )
          )}
        </span>
        <span>{footer.copyright}</span>
      </div>
    </footer>
  );
}
