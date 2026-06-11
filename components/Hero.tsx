import { hero } from "@/lib/content";
import CtaLink from "@/components/CtaLink";
import ReelFrame from "@/components/ReelFrame";

export default function Hero() {
  return (
    <header className="plate hero">
      <div className="plate-inner">
        <div className="grid">
          <div>
            <span className="kicker">{hero.kicker}</span>
            <h1 className="display-xl">{hero.headline}</h1>
            <p className="lede">{hero.lede}</p>
            <div className="cta-row">
              <CtaLink
                href="#book"
                ctaId="book_sprint"
                location="hero"
                className="btn btn-primary"
              >
                {hero.primaryCta} <span className="arrow">→</span>
              </CtaLink>
              <CtaLink
                href="#proof"
                ctaId="watch_reel"
                location="hero"
                className="btn btn-ghost"
              >
                {hero.secondaryCta} <span className="arrow">↓</span>
              </CtaLink>
            </div>
            <p className="trust-line">
              {hero.trust.audience}
              <span className="sep">·</span>
              {hero.trust.location}
            </p>
          </div>
          <div className="reel-col">
            <ReelFrame
              caption={hero.reel.caption}
              duration={hero.reel.duration}
              placeholder={hero.reel.placeholder}
              poster={hero.reel.poster}
              video={hero.reel.video}
              priority
            />
          </div>
        </div>
      </div>
    </header>
  );
}
