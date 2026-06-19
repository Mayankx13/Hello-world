/**
 * Recommendation card. Renders one RecommendationCard exactly per the design:
 * ribbon · brand · model · price · (no-cost EMI) · fit line · 2 pros + 1 con ·
 * in-stock badge · choose button. Stretch cards get the amber treatment.
 */
import type { JSX } from "react";
import type { Lang } from "../lib/api";
import type { RecommendationCard } from "@engine";
import { UI, t } from "../lib/i18n";
import { rupees } from "../lib/format";

export interface CardProps {
  card: RecommendationCard;
  /** localized ribbon label (GOOD / BETTER / BEST / WORTH THE STRETCH). */
  ribbon: string;
  stretch: boolean;
  exchange: boolean;
  lang: Lang;
  onChoose: (card: RecommendationCard) => void;
}

export default function Card({
  card,
  ribbon,
  stretch,
  exchange,
  lang,
  onChoose,
}: CardProps): JSX.Element {
  const emiLine =
    `${t(UI.no_cost_emi, lang)} ${rupees(card.emiPerMonth)}${t(UI.mo, lang)} × ${card.emiMonths}` +
    (exchange && card.exchangeEligible ? " · exchange value extra" : "");

  return (
    <div className={`card${stretch ? " stretch" : ""}`}>
      <div className="ribbon">{ribbon}</div>
      <div className="card-body">
        <div className="c-brand">{card.brand}</div>
        <div className="c-model">{card.model}</div>
        <div className="c-price">{rupees(card.price)}</div>
        {card.emiEligible && <div className="c-emi">{emiLine}</div>}
        <div className="fit">{card.fitLine}</div>
        <div className="pc">
          <div className="pro">{card.pros[0]}</div>
          <div className="pro">{card.pros[1]}</div>
          <div className="con">{card.con}</div>
        </div>
        <span className="stock">
          <span className="led" aria-hidden="true" />
          {t(UI.in_stock, lang)} {card.inStockAsOf}
        </span>
        <button
          type="button"
          className={`btn ${stretch ? "btn-amber" : "btn-indigo"}`}
          onClick={() => onChoose(card)}
        >
          {t(UI.choose, lang)}
        </button>
      </div>
    </div>
  );
}
