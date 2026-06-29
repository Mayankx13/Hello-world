/** Promotions — staff-facing view of ongoing offers & promotions (read-only). */
import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { getLiveOffers, getStores } from "../lib/api";
import type { Lang, Offer, Store } from "../lib/api";
import { UI, t } from "../lib/i18n";

const fmtDate = (s: string) => {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

export default function Promotions({ lang, storeId }: { lang: Lang; storeId: string }): JSX.Element {
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [stores, setStores] = useState<Store[]>([]);

  useEffect(() => {
    getLiveOffers({ storeId: storeId || null }).then(setOffers).catch(() => setOffers([]));
    getStores().then(setStores).catch(() => {});
  }, [storeId]);

  const storeName = useMemo(() => {
    const m = new Map(stores.map((s) => [s.id, s.name]));
    return (id?: string | null) => (id ? m.get(id) ?? id : t(UI.promo_all_stores, lang));
  }, [stores, lang]);

  return (
    <div className="content-narrow af-screen" lang={lang}>
      <div className="page-head">
        <h1>{t(UI.promo_title, lang)}</h1>
        <p>{t(UI.promo_sub, lang)}</p>
      </div>

      {!offers ? <div className="loading">{t(UI.af_loading, lang)}</div> : offers.length === 0 ? (
        <p className="af-empty-cell">{t(UI.promo_none, lang)}</p>
      ) : (
        <div className="promo-grid">
          {offers.map((o) => (
            <article className="promo-card" key={o.offer_id}>
              <div className="promo-top">
                <span className="promo-live">● {t(UI.promo_live, lang)}</span>
                {o.discount_pct ? <span className="promo-disc">{o.discount_pct}% {t(UI.off_off, lang)}</span> : null}
              </div>
              <h3 className="promo-name">{o.title}</h3>
              {o.description && <p className="promo-desc">{o.description}</p>}
              <div className="promo-tags">
                {o.brand && <span className="tag-pill">{o.brand}</span>}
                {o.category && <span className="tag-pill" style={{ textTransform: "uppercase" }}>{o.category}</span>}
                {o.offer_price ? <span className="tag-pill">₹{o.offer_price.toLocaleString("en-IN")}</span> : null}
              </div>
              <div className="promo-foot">
                <span>{storeName(o.store_id)}</span>
                <span>{fmtDate(o.starts_at)} – {fmtDate(o.ends_at)}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
