/**
 * Budget screen. Three band buttons are built from config.priceBands[category]
 * (good/better/best tuples), followed by the stretch + exchange toggles.
 * "Show my matches" stays disabled until a band is chosen.
 */
import type { JSX } from "react";
import type { Lang } from "../lib/api";
import type { CategoryBands } from "@engine";
import type { BandName } from "../state";
import { UI, t } from "../lib/i18n";
import { bandRangeLabel } from "../lib/format";

export interface BudgetProps {
  lang: Lang;
  categoryLabel: string;
  bands: CategoryBands;
  budgetBand: BandName | null;
  stretch: boolean;
  exchange: boolean;
  onPickBand: (band: BandName) => void;
  onSetStretch: (value: boolean) => void;
  onSetExchange: (value: boolean) => void;
  onBack: () => void;
  onSubmit: () => void;
}

const ORDER: { band: BandName; tierLabel: keyof typeof UI }[] = [
  { band: "good", tierLabel: "good" },
  { band: "better", tierLabel: "better" },
  { band: "best", tierLabel: "best" },
];

export default function Budget({
  lang,
  categoryLabel,
  bands,
  budgetBand,
  stretch,
  exchange,
  onPickBand,
  onSetStretch,
  onSetExchange,
  onBack,
  onSubmit,
}: BudgetProps): JSX.Element {
  return (
    <>
      <div className="q-wrap">
        <div className="eyebrow">
          {categoryLabel} · {t(UI.almost, lang)}
        </div>
        <h2>{t(UI.budget_title, lang)}</h2>
        <div className="bands" role="group" aria-label={t(UI.budget_title, lang)}>
          {ORDER.map(({ band, tierLabel }) => {
            const isSel = budgetBand === band;
            return (
              <button
                key={band}
                type="button"
                className={`band${isSel ? " sel" : ""}`}
                aria-pressed={isSel}
                onClick={() => onPickBand(band)}
              >
                <div className="b-tier">{t(UI[tierLabel], lang)}</div>
                <div className="b-amt">{bandRangeLabel(bands[band], lang)}</div>
              </button>
            );
          })}
        </div>

        <div className="subq">{t(UI.stretch_q, lang)}</div>
        <div className="toggle-row" role="group" aria-label={t(UI.stretch_q, lang)}>
          <button
            type="button"
            className={`chip${stretch ? " sel" : ""}`}
            aria-pressed={stretch}
            onClick={() => onSetStretch(true)}
          >
            {t(UI.stretch_yes, lang)}
          </button>
          <button
            type="button"
            className={`chip${!stretch ? " sel" : ""}`}
            aria-pressed={!stretch}
            onClick={() => onSetStretch(false)}
          >
            {t(UI.stretch_no, lang)}
          </button>
        </div>

        <div className="subq">{t(UI.exchange_q, lang)}</div>
        <div className="toggle-row" role="group" aria-label={t(UI.exchange_q, lang)}>
          <button
            type="button"
            className={`chip${exchange ? " sel" : ""}`}
            aria-pressed={exchange}
            onClick={() => onSetExchange(true)}
          >
            {t(UI.yes, lang)}
          </button>
          <button
            type="button"
            className={`chip${!exchange ? " sel" : ""}`}
            aria-pressed={!exchange}
            onClick={() => onSetExchange(false)}
          >
            {t(UI.no, lang)}
          </button>
        </div>
      </div>
      <div className="navrow">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ← {t(UI.back, lang)}
        </button>
        <button
          type="button"
          className="btn btn-amber"
          disabled={budgetBand === null}
          onClick={onSubmit}
        >
          {t(UI.show_matches, lang)} →
        </button>
      </div>
    </>
  );
}
