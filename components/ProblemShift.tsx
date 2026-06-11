import { shift } from "@/lib/content";
import PlateHead from "@/components/PlateHead";
import Reveal from "@/components/Reveal";

const glyphs = ["a.", "b.", "c.", "d.", "e."];

function Ledger({ items }: { items: string[] }) {
  return (
    <ul className="ledger">
      {items.map((item, i) => (
        <li key={i}>
          <span className="glyph">{glyphs[i]}</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ProblemShift() {
  return (
    <section className="plate" id="shift">
      <div className="plate-inner">
        <PlateHead num={shift.num} label={shift.label} />
        <Reveal
          as="h2"
          className="display-lg"
          style={{ maxWidth: "16em", marginBottom: "clamp(36px, 5vw, 56px)" }}
        >
          {shift.heading}
        </Reveal>
        <Reveal className="contrast">
          <div className="col treadmill">
            <p className="col-tag">{shift.treadmill.tag}</p>
            <h3 className="display-md">{shift.treadmill.heading}</h3>
            <Ledger items={shift.treadmill.items} />
          </div>
          <div className="col clone">
            <p className="col-tag">{shift.clone.tag}</p>
            <h3 className="display-md">{shift.clone.heading}</h3>
            <Ledger items={shift.clone.items} />
          </div>
        </Reveal>
        <Reveal as="p" className="pull-quote">
          {shift.pullQuote}
        </Reveal>
      </div>
    </section>
  );
}
