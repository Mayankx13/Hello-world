import { faq, type IncludedPart } from "@/lib/content";
import PlateHead from "@/components/PlateHead";
import Reveal from "@/components/Reveal";

function Paragraph({ parts }: { parts: IncludedPart[] }) {
  return (
    <p>
      {parts.map((part, i) =>
        typeof part === "string" ? (
          part
        ) : (
          <strong key={i}>{part.strong}</strong>
        )
      )}
    </p>
  );
}

/**
 * FAQ as native <details>/<summary> — keyboard- and screen-reader-
 * accessible without ARIA wiring.
 */
export default function FAQ() {
  return (
    <section className="plate" id="faq">
      <div className="plate-inner">
        <PlateHead num={faq.num} label={faq.label} />
        <Reveal className="faq-list">
          {faq.items.map((item) => (
            <details className="faq-item" key={item.q}>
              <summary>
                {item.q}
                <span className="faq-toggle" aria-hidden="true">
                  +
                </span>
              </summary>
              <div className="faq-body">
                {item.a.map((para, i) => (
                  <Paragraph key={i} parts={para.parts} />
                ))}
              </div>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
