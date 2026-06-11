import { system } from "@/lib/content";
import PlateHead from "@/components/PlateHead";
import Reveal from "@/components/Reveal";

export default function SystemValue() {
  return (
    <section className="plate" id="system">
      <div className="plate-inner">
        <PlateHead num={system.num} label={system.label} />
        <div className="system-grid">
          <Reveal className="system-intro">
            <h2 className="display-lg">{system.heading}</h2>
            <p className="lede">{system.lede}</p>
            <div className="accrue-note">
              <strong>{system.accrueNote.strong}</strong>
              {system.accrueNote.body}
            </div>
          </Reveal>
          <Reveal className="artifact-list">
            {system.artifacts.map((artifact) => (
              <div className="artifact" key={artifact.num}>
                <span className="a-num">{artifact.num}</span>
                <div>
                  <h4>{artifact.heading}</h4>
                  <p>
                    {artifact.body.map((part, i) =>
                      typeof part === "string" ? (
                        part
                      ) : (
                        <em className="brand-em" key={i}>
                          {part.em}
                        </em>
                      )
                    )}
                  </p>
                </div>
              </div>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
