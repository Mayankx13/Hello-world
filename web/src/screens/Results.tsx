/**
 * Results — Good / Better / Best cards plus an optional "worth the stretch"
 * card. Null tiers are skipped; if nothing matched, a friendly empty state
 * offers a route back to adjust the budget.
 */
import type { JSX } from "react";
import type { Lang, RecommendResult } from "../lib/api";
import type { RecommendationCard } from "@engine";
import { UI, t } from "../lib/i18n";
import Card from "../components/Card";

export interface ResultsProps {
  lang: Lang;
  result: RecommendResult;
  exchange: boolean;
  onChoose: (card: RecommendationCard) => void;
  onAdjustBudget: () => void;
}

export default function Results({
  lang,
  result,
  exchange,
  onChoose,
  onAdjustBudget,
}: ResultsProps): JSX.Element {
  const tiers: { card: RecommendationCard | null; ribbon: string; stretch: boolean }[] = [
    { card: result.good, ribbon: t(UI.good, lang), stretch: false },
    { card: result.better, ribbon: t(UI.better, lang), stretch: false },
    { card: result.best, ribbon: t(UI.best, lang), stretch: false },
    { card: result.stretch, ribbon: t(UI.stretch_ribbon, lang), stretch: true },
  ];
  const visible = tiers.filter((x) => x.card !== null);
  const hint =
    t(UI.results_hint, lang) +
    (result.stretch ? t(UI.plus_stretch, lang) : "") +
    (exchange ? ". " + t(UI.exchange_note, lang) : "");

  return (
    <>
      <div className="eyebrow">{t(UI.results_eyebrow, lang)}</div>
      <h2>{t(UI.results_title, lang)}</h2>
      <p className="hint">{hint}</p>

      {visible.length === 0 ? (
        <div className="empty">
          <p>
            {lang === "hi"
              ? "इस बजट में अभी कोई मिलान नहीं मिला। बजट थोड़ा बदलकर देखें।"
              : "No in-stock match in this budget right now. Try adjusting your budget."}
          </p>
          <div className="navrow">
            <span />
            <button type="button" className="btn btn-amber" onClick={onAdjustBudget}>
              {t(UI.adjust_budget, lang)} →
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="cards">
            {visible.map(({ card, ribbon, stretch }) => (
              <Card
                key={card!.id}
                card={card!}
                ribbon={ribbon}
                stretch={stretch}
                exchange={exchange}
                lang={lang}
                onChoose={onChoose}
              />
            ))}
          </div>
          <div className="navrow">
            <button type="button" className="btn btn-ghost" onClick={onAdjustBudget}>
              ← {t(UI.adjust_budget, lang)}
            </button>
            <span />
          </div>
        </>
      )}
    </>
  );
}
