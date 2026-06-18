/**
 * Attach screen. Optional add-ons from result.attach; tapping a row toggles it
 * into the selection. The continue CTA reflects whether anything is selected.
 */
import type { JSX } from "react";
import type { AttachItem } from "@engine";
import type { Lang } from "../lib/api";
import { UI, t } from "../lib/i18n";
import { rupees } from "../lib/format";

export interface AttachProps {
  lang: Lang;
  items: AttachItem[];
  selected: string[];
  onToggle: (id: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

export default function Attach({
  lang,
  items,
  selected,
  onToggle,
  onBack,
  onContinue,
}: AttachProps): JSX.Element {
  return (
    <>
      <div className="eyebrow">{t(UI.attach_eyebrow, lang)}</div>
      <h2>{t(UI.attach_title, lang)}</h2>
      <p className="hint">{t(UI.attach_hint, lang)}</p>
      <div className="attach-list">
        {items.map((a) => {
          const isSel = selected.includes(a.id);
          return (
            <button
              key={a.id}
              type="button"
              className={`attach${isSel ? " sel" : ""}`}
              aria-pressed={isSel}
              onClick={() => onToggle(a.id)}
            >
              <span>
                <span className="a-name">{a.name}</span>
                <span className="a-sub">{a.sub}</span>
              </span>
              <span style={{ display: "flex", alignItems: "center" }}>
                <span className="a-price">{rupees(a.price)}</span>
                <span className="tick" aria-hidden="true">
                  {isSel ? "✓" : ""}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="navrow">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ← {t(UI.back, lang)}
        </button>
        <button type="button" className="btn btn-amber" onClick={onContinue}>
          {selected.length ? t(UI.add_continue, lang) : t(UI.skip_continue, lang)} →
        </button>
      </div>
    </>
  );
}
