/**
 * Feedback (all roles) — submit a category + 1–5 rating + message, optionally
 * anonymously (POST /feedback is PUBLIC). Admin/manager additionally see a list
 * of recent feedback (GET /feedback, gated).
 */
import { useCallback, useEffect, useState } from "react";
import type { JSX } from "react";
import { submitFeedback, listFeedback } from "../lib/api";
import { useToast } from "../lib/toast";
import type { AuthUser, Feedback as FeedbackRow, FeedbackCategory, Lang } from "../lib/api";
import { UI, t } from "../lib/i18n";

const CATEGORIES: FeedbackCategory[] = ["store", "management", "product", "customer", "process", "other"];

function catLabel(c: FeedbackCategory, lang: Lang): string {
  const map: Record<FeedbackCategory, keyof typeof UI> = {
    store: "fb_c_store", management: "fb_c_management", product: "fb_c_product",
    customer: "fb_c_customer", process: "fb_c_process", other: "fb_c_other",
  };
  return t(UI[map[c]], lang);
}

export default function Feedback({ lang, user, token }: { lang: Lang; user: AuthUser; token: string | null }): JSX.Element {
  const isStaffAdmin = user.role === "admin" || user.role === "manager";

  const [category, setCategory] = useState<FeedbackCategory>("store");
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [anon, setAnon] = useState(false);
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);

  const [recent, setRecent] = useState<FeedbackRow[] | null>(null);
  const reload = useCallback(() => {
    if (!isStaffAdmin) return;
    const opts = user.role === "manager" && user.storeId ? { storeId: user.storeId } : undefined;
    listFeedback(opts, token).then(setRecent).catch(() => setRecent([]));
  }, [isStaffAdmin, user.role, user.storeId, token]);
  useEffect(() => { reload(); }, [reload]);
  const toast = useToast();

  async function send() {
    setSaving(true);
    try {
      await submitFeedback({
        category,
        rating: rating || null,
        message: message.trim() || null,
        anonymous: anon,
        employee_id: anon ? null : user.id,
        store_id: user.storeId,
      }, token);
      toast.notify(t(UI.toast_sent, lang));
      setSent(true);
      setMessage("");
      setRating(0);
      reload();
    } catch (err) {
      toast.notify((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="content-narrow af-screen" lang={lang}>
      <div className="page-head">
        <h1>{t(UI.fb_title, lang)}</h1>
        <p>{t(UI.fb_sub, lang)}</p>
      </div>

      <div className="af-form ed-card">
        <h3 className="af-h" style={{ marginTop: 0 }}>{t(UI.fb_submit_head, lang)}</h3>

        <label className="ed-field"><span>{t(UI.fb_category, lang)}</span>
          <div className="af-chips">
            {CATEGORIES.map((c) => (
              <button key={c} type="button" className={`af-chip${category === c ? " on" : ""}`} onClick={() => setCategory(c)}>{catLabel(c, lang)}</button>
            ))}
          </div>
        </label>

        <label className="ed-field"><span>{t(UI.fb_rating, lang)}</span>
          <div className="af-stars" role="radiogroup" aria-label={t(UI.fb_rating, lang)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" className={`af-star${rating >= n ? " on" : ""}`} aria-checked={rating === n} role="radio"
                onClick={() => setRating(n === rating ? 0 : n)}>★</button>
            ))}
          </div>
        </label>

        <label className="ed-field"><span>{t(UI.fb_message, lang)}</span>
          <textarea className="af-textarea" rows={4} value={message} placeholder={t(UI.fb_message_ph, lang)}
            onChange={(e) => { setMessage(e.target.value); setSent(false); }} />
        </label>

        <label className="ed-check">
          <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} /> {t(UI.fb_anon, lang)}
        </label>

        <div className="ed-actions">
          <button type="button" className="btn btn-amber btn-sm" disabled={saving || (rating === 0 && message.trim() === "")} onClick={send}>
            {saving ? t(UI.af_saving, lang) : t(UI.fb_send, lang)}
          </button>
          {sent && <span className="ed-ok">{t(UI.fb_sent, lang)}</span>}
        </div>
      </div>

      {isStaffAdmin && (
        <>
          <h3 className="af-h">{t(UI.fb_recent, lang)}</h3>
          {!recent ? <div className="loading">{t(UI.af_loading, lang)}</div> : recent.length === 0 ? (
            <p className="af-empty-cell">{t(UI.af_none, lang)}</p>
          ) : (
            <div className="af-fb-list">
              {recent.map((f) => (
                <div className="af-fb-item" key={f.id}>
                  <div className="af-fb-top">
                    <span className="tag-pill">{catLabel(f.category, lang)}</span>
                    {f.rating ? <span className="af-fb-rating">{"★".repeat(f.rating)}<span className="af-fb-rating-off">{"★".repeat(5 - f.rating)}</span></span> : null}
                    <span className="af-fb-who">{f.anonymous ? t(UI.fb_anonymous, lang) : (f.employee_id ?? "")}</span>
                    {f.created_at && <span className="af-fb-date">{new Date(f.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
                  </div>
                  {f.message && <p className="af-fb-msg">{f.message}</p>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
