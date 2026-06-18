/**
 * Welcome / hero screen. Live date-time, value props, optional WhatsApp number
 * with DPDP consent line, and the Start CTA. Store is auto-selected upstream
 * (shown in the top bar); this screen just kicks off the journey.
 */
import type { JSX } from "react";
import type { Lang } from "../lib/api";
import { UI, t } from "../lib/i18n";

export interface WelcomeProps {
  lang: Lang;
  mobile: string;
  onMobileChange: (value: string) => void;
  onStart: () => void;
}

export default function Welcome({
  lang,
  mobile,
  onMobileChange,
  onStart,
}: WelcomeProps): JSX.Element {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="hero">
      <div className="datetime">
        {dateStr} · {timeStr}
      </div>
      <div className="eyebrow">{t(UI.welcome_eyebrow, lang)}</div>
      <h1>{t(UI.welcome_title, lang)}</h1>
      <p className="hint">{t(UI.welcome_hint, lang)}</p>
      <div className="phone-row">
        <input
          type="tel"
          inputMode="numeric"
          maxLength={10}
          value={mobile}
          aria-label={t(UI.phone_ph, lang)}
          placeholder={t(UI.phone_ph, lang)}
          onChange={(e) => onMobileChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
        />
        <button type="button" className="btn btn-amber" onClick={onStart}>
          {t(UI.start, lang)} →
        </button>
      </div>
      <p className="consent">{t(UI.consent, lang)}</p>
      <div className="trust">
        <div>
          <b>11</b>&nbsp;{lang === "hi" ? "उत्तर भारत में स्टोर" : "stores across North India"}
        </div>
        <div>
          <b>{lang === "hi" ? "सभी प्रमुख ब्रांड" : "All major brands"}</b>&nbsp;
          {lang === "hi" ? "एक छत के नीचे" : "under one roof"}
        </div>
        <div>
          <b>{t(UI.no_cost_emi, lang)}</b>&nbsp;{lang === "hi" ? "उपलब्ध" : "available"}
        </div>
      </div>
    </div>
  );
}
