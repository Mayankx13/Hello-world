import { how } from "@/lib/content";
import PlateHead from "@/components/PlateHead";
import Reveal from "@/components/Reveal";

export default function HowItWorks() {
  return (
    <section className="plate" id="how">
      <div className="plate-inner">
        <PlateHead num={how.num} label={how.label} />
        <Reveal
          as="h2"
          className="display-lg"
          style={{ maxWidth: "14em", marginBottom: "clamp(36px, 5vw, 56px)" }}
        >
          {how.heading}
        </Reveal>
        <Reveal className="steps">
          {how.steps.map((step) => (
            <div className="step" key={step.num}>
              <span className="step-num">{step.num}</span>
              <h3 className="display-md">{step.heading}</h3>
              <p>{step.body}</p>
              <p className="step-note">
                {step.note.lead}
                <strong>{step.note.strong}</strong>
              </p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
