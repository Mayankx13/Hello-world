/**
 * Profiler — one questionnaire question per screen. Single- vs multi-select is
 * driven by question.kind/max; "Next" unlocks once at least one option is
 * chosen. A notSure option is always selectable (never blocked by the max cap).
 */
import type { JSX } from "react";
import type { Lang, QCategory } from "../lib/api";
import { UI, t } from "../lib/i18n";

export interface ProfilerProps {
  lang: Lang;
  category: QCategory;
  categoryLabel: string;
  qIndex: number;
  /** selected option ids for the current question. */
  selected: string[];
  onToggle: (optionId: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function Profiler({
  lang,
  category,
  categoryLabel,
  qIndex,
  selected,
  onToggle,
  onBack,
  onNext,
}: ProfilerProps): JSX.Element {
  const q = category.questions[qIndex];
  const total = category.questions.length;
  const isMulti = q.kind === "multi";
  const max = q.max ?? 1;
  const eyebrow =
    lang === "hi"
      ? `${categoryLabel} · सवाल ${qIndex + 1}/${total}`
      : `${categoryLabel} · Question ${qIndex + 1} of ${total}`;

  return (
    <>
      <div className="q-wrap">
        <div className="eyebrow">{eyebrow}</div>
        <h2 id="profiler-prompt">{t(q.prompt, lang)}</h2>
        {q.hint && <p className="hint">{t(q.hint, lang)}</p>}
        <div className="chips" role="group" aria-labelledby="profiler-prompt">
          {q.options.map((o) => {
            const isSel = selected.includes(o.id);
            // In a multi question, block selecting a new option once at max —
            // unless it is the always-available notSure choice.
            const atCap = isMulti && !isSel && selected.length >= max && !o.notSure;
            return (
              <button
                key={o.id}
                type="button"
                className={`chip${isSel ? " sel" : ""}`}
                aria-pressed={isSel}
                disabled={atCap}
                onClick={() => onToggle(o.id)}
              >
                {t(o.label, lang)}
                {o.sub && t(o.sub, lang) ? <small>{t(o.sub, lang)}</small> : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="navrow">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ← {t(UI.back, lang)}
        </button>
        <button
          type="button"
          className="btn btn-indigo"
          disabled={selected.length === 0}
          onClick={onNext}
        >
          {t(UI.next, lang)} →
        </button>
      </div>
    </>
  );
}
