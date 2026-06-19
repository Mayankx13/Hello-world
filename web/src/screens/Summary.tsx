/**
 * Summary / bill. Lists the chosen product plus any add-ons, the total, the
 * items-on-bill count and a no-cost EMI line. Mock share/call actions, plus the
 * staff outcome logger which records the session and shows a brief thank-you.
 */
import type { JSX } from "react";
import type { AttachItem, RecommendationCard } from "@engine";
import type { Lang } from "../lib/api";
import { UI, t } from "../lib/i18n";
import { rupees } from "../lib/format";

export type Outcome = "bought_recommended" | "bought_different" | "still_thinking";

export interface SummaryProps {
  lang: Lang;
  picked: RecommendationCard;
  attachItems: AttachItem[];
  exchange: boolean;
  logged: boolean;
  onLogOutcome: (outcome: Outcome) => void;
  onBack: () => void;
  onRestart: () => void;
}

export default function Summary({
  lang,
  picked,
  attachItems,
  exchange,
  logged,
  onLogOutcome,
  onBack,
  onRestart,
}: SummaryProps): JSX.Element {
  const total = picked.price + attachItems.reduce((sum, a) => sum + a.price, 0);
  const itemsPerBill = 1 + attachItems.length;
  const months = picked.emiMonths || 24;
  const emiPerMonth = Math.round(total / months / 10) * 10;
  const itemWord = itemsPerBill === 1 ? t(UI.item, lang) : t(UI.items, lang);

  const outcomes: { key: Outcome; label: string }[] = [
    { key: "bought_recommended", label: t(UI.bought_rec, lang) },
    { key: "bought_different", label: t(UI.bought_diff, lang) },
    { key: "still_thinking", label: t(UI.still_thinking, lang) },
  ];

  return (
    <>
      <div className="eyebrow">{t(UI.summary_eyebrow, lang)}</div>
      <h2>{t(UI.summary_title, lang)}</h2>

      <div className="bill">
        <div className="bill-row">
          <span>
            <b>{picked.brand}</b> {picked.model}
          </span>
          <b>{rupees(picked.price)}</b>
        </div>
        {attachItems.map((a) => (
          <div className="bill-row" key={a.id}>
            <span>{a.name}</span>
            <span>{rupees(a.price)}</span>
          </div>
        ))}
        <div className="bill-total">
          <span>
            {t(UI.total, lang)} {exchange ? t(UI.before_exchange, lang) : ""}
          </span>
          <span>{rupees(total)}</span>
        </div>
        {picked.emiEligible && (
          <div className="ipb">
            {itemsPerBill} {itemWord} {t(UI.on_bill, lang)} · {t(UI.no_cost_emi, lang)}{" "}
            {rupees(emiPerMonth)}
            {t(UI.mo, lang)}
          </div>
        )}
      </div>

      <div className="actions">
        <button
          type="button"
          className="btn btn-amber"
          onClick={() =>
            alert(
              lang === "hi"
                ? "डेमो: सारांश WhatsApp पर फ़ोटो, स्पेक्स व प्राइस-होल्ड लिंक के साथ भेजा जाएगा।"
                : "Demo: summary would be sent on WhatsApp with photos, specs & a hold-my-price link.",
            )
          }
        >
          {t(UI.send_whatsapp, lang)}
        </button>
        <button
          type="button"
          className="btn btn-indigo"
          onClick={() =>
            alert(
              lang === "hi"
                ? "डेमो: यह सारांश फ्लोर स्टाफ़ के टैबलेट पर भेजा जाएगा।"
                : "Demo: pings the floor staff tablet with this summary.",
            )
          }
        >
          {t(UI.call_staff, lang)}
        </button>
      </div>

      {logged ? (
        <div className="outcome">
          <div className="empty">
            <p>
              {lang === "hi"
                ? "धन्यवाद! परिणाम दर्ज हो गया।"
                : "Thank you! Outcome logged."}
            </p>
          </div>
        </div>
      ) : (
        <div className="outcome">
          <div className="subq">{t(UI.staff_log, lang)}</div>
          <div className="toggle-row" role="group" aria-label={t(UI.staff_log, lang)}>
            {outcomes.map((o) => (
              <button
                key={o.key}
                type="button"
                className="chip"
                onClick={() => onLogOutcome(o.key)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="navrow">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ← {t(UI.back, lang)}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onRestart}>
          {t(UI.new_customer, lang)} →
        </button>
      </div>
    </>
  );
}
