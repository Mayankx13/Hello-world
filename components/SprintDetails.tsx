import { sprint, type IncludedPart } from "@/lib/content";
import PlateHead from "@/components/PlateHead";
import Reveal from "@/components/Reveal";
import TrackedSection from "@/components/TrackedSection";

function Parts({ parts }: { parts: IncludedPart[] }) {
  return (
    <>
      {parts.map((part, i) =>
        typeof part === "string" ? (
          part
        ) : (
          <strong key={i}>{part.strong}</strong>
        )
      )}
    </>
  );
}

export default function SprintDetails() {
  return (
    <TrackedSection id="sprint" className="plate" event="view_sprint_details">
      <div className="plate-inner">
        <PlateHead num={sprint.num} label={sprint.label} />
        <div className="sprint-grid">
          <Reveal>
            <h2
              className="display-lg"
              style={{
                maxWidth: "13em",
                marginBottom: "clamp(28px, 4vw, 44px)",
              }}
            >
              {sprint.heading}
            </h2>
            <dl className="included">
              {sprint.included.map((row) => (
                <div className="included-row" key={row.term}>
                  <dt>{row.term}</dt>
                  <dd>
                    <Parts parts={row.parts} />
                  </dd>
                </div>
              ))}
            </dl>
            <p className="price-note">
              <strong>{sprint.priceNote.strong}</strong>
              {sprint.priceNote.body}
            </p>
          </Reveal>
          <Reveal as="aside" className="guarantee">
            <span className="kicker">{sprint.guarantee.kicker}</span>
            <h3>{sprint.guarantee.heading}</h3>
            {sprint.guarantee.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <p className="sigline">{sprint.guarantee.sigline}</p>
          </Reveal>
        </div>
      </div>
    </TrackedSection>
  );
}
