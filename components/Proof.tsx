import { proof } from "@/lib/content";
import PlateHead from "@/components/PlateHead";
import Reveal from "@/components/Reveal";
import MediaSlot from "@/components/MediaSlot";
import CloneComparison from "@/components/CloneComparison";

export default function Proof() {
  return (
    <section className="plate" id="proof">
      <div className="plate-inner">
        <PlateHead num={proof.num} label={proof.label} />

        <CloneComparison />

        <div className="proof-grid">
          {proof.testimonials.map((t) => (
            <Reveal className="testimonial" key={t.who}>
              <span className="illustrative">{t.flag}</span>
              <blockquote>{t.quote}</blockquote>
              <div className="attrib">
                <MediaSlot
                  src={t.photo}
                  alt={t.photo ? t.who : ""}
                  label="photo"
                  sizes="44px"
                />
                <p className="who">
                  <strong>{t.who}</strong>
                  <span>{t.detail}</span>
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="metrics-row">
          {proof.metrics.map((m) => (
            <Reveal className="metric" key={m.label}>
              <p className="m-label">{m.label}</p>
              <p className="m-pair">
                <span className="m-before">{m.before}</span>
                <span className="m-arrow">→</span>
                <span className="m-after">{m.after}</span>
              </p>
              <p className="m-note">{m.note}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
