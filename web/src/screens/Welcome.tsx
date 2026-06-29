/**
 * Welcome / hero screen. Live date-time, value props, optional WhatsApp number
 * with DPDP consent line, and the Start CTA. Entering a known number recalls the
 * customer (past touchpoints, brand/budget/premium tags) so the picks are tailored.
 */
import { useEffect, useState } from "react";
import type { JSX } from "react";
import { recallCustomer, getLiveOffers } from "../lib/api";
import type { CustomerInfo, Lang, Offer } from "../lib/api";
import { UI, t } from "../lib/i18n";

export interface WelcomeProps {
  lang: Lang;
  mobile: string;
  onMobileChange: (value: string) => void;
  onStart: () => void;
  onRecall?: (info: CustomerInfo | null) => void;
}

const PRETTY: Record<string, string> = { value: "Value", mainstream: "Mainstream", premium: "Premium", luxury: "Luxury", cash: "Cash", card: "Card", emi: "EMI", upi: "UPI", exchange: "Exchange" };

export default function Welcome({ lang, mobile, onMobileChange, onStart, onRecall }: WelcomeProps): JSX.Element {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  const [recall, setRecall] = useState<CustomerInfo | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);

  // Live "offer of the day" strip (subtle, below the trust row). Never blocks.
  useEffect(() => {
    let live = true;
    getLiveOffers().then((o) => { if (live) setOffers(o.slice(0, 4)); }).catch(() => {});
    return () => { live = false; };
  }, []);

  useEffect(() => {
    let live = true;
    if (mobile.length === 10) {
      recallCustomer(mobile).then((info) => { if (live) { setRecall(info); onRecall?.(info); } });
    } else if (recall) {
      setRecall(null); onRecall?.(null);
    }
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobile]);

  const c = recall?.customer;
  const brands = [...new Set((recall?.prefs ?? []).filter((p) => p.affinity !== "avoid").map((p) => p.brand))].slice(0, 4);

  return (
    <div className="hero">
      <div className="datetime">{dateStr} · {timeStr}</div>
      <div className="eyebrow">{t(UI.welcome_eyebrow, lang)}</div>
      <h1>{t(UI.welcome_title, lang)}</h1>
      <p className="hint">{t(UI.welcome_hint, lang)}</p>
      <div className="phone-row">
        <input
          type="tel" inputMode="numeric" maxLength={10} value={mobile}
          aria-label={t(UI.phone_ph, lang)} placeholder={t(UI.phone_ph, lang)}
          onChange={(e) => onMobileChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
        />
        <button type="button" className="btn btn-amber" onClick={onStart}>{t(UI.start, lang)} →</button>
      </div>

      {c && (
        <div className="recall" role="status">
          <div className="recall-head">
            <span className="recall-badge">★</span>
            <b>{t(UI.recall_back, lang)}{c.name ? `, ${c.name}` : ""}!</b>
            <span className="recall-sub">{t(UI.recall_remembers, lang)}</span>
          </div>
          <div className="recall-tags">
            {c.premium_tier && <span className="recall-tag">{PRETTY[c.premium_tier] ?? c.premium_tier}</span>}
            {c.preferred_payment && <span className="recall-tag">{t(UI.recall_pays, lang)} {PRETTY[c.preferred_payment] ?? c.preferred_payment}</span>}
            {brands.length > 0 && <span className="recall-tag">{t(UI.recall_likes, lang)} {brands.join(", ")}</span>}
          </div>
          {(recall?.recentEvents?.length ?? 0) > 0 && (
            <div className="recall-events">
              <span className="recall-lbl">{t(UI.recall_last, lang)}:</span>
              {recall!.recentEvents.slice(0, 3).map((e, i) => (
                <span key={i} className="recall-ev">
                  {[e.category, e.brand, e.budget_band].filter(Boolean).join(" · ") || e.type}
                  {e.ts ? ` · ${new Date(e.ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="consent">{t(UI.consent, lang)}</p>
      <div className="trust">
        <div><b>11</b>&nbsp;{lang === "hi" ? "उत्तर भारत में स्टोर" : "stores across North India"}</div>
        <div><b>{lang === "hi" ? "सभी प्रमुख ब्रांड" : "All major brands"}</b>&nbsp;{lang === "hi" ? "एक छत के नीचे" : "under one roof"}</div>
        <div><b>{t(UI.no_cost_emi, lang)}</b>&nbsp;{lang === "hi" ? "उपलब्ध" : "available"}</div>
      </div>

      {offers.length > 0 && (
        <div className="welcome-offers" aria-label={t(UI.off_latest, lang)}>
          <span className="wo-lbl">{t(UI.off_latest, lang)}</span>
          <div className="wo-strip">
            {offers.map((o) => (
              <span className="wo-chip" key={o.offer_id}>
                <b>{o.title}</b>
                {o.discount_pct ? <em>{o.discount_pct}% {t(UI.off_off, lang)}</em> : null}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
