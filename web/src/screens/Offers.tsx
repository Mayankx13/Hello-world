/**
 * Offers (admin) — "offer of the day" manager. Lists every offer (GET
 * /offers/all), creates new ones (POST /offers) and deletes them
 * (DELETE /offers/:id). A boost_weight > 0 nudges the recommendation engine to
 * surface matching brand/category stock first while the offer is live.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { listAllOffers, createOffer, deleteOffer, getStores } from "../lib/api";
import { useToast } from "../lib/toast";
import type { Lang, Offer, Store } from "../lib/api";
import { UI, t } from "../lib/i18n";

const CATS: { id: string; label: string }[] = [
  { id: "", label: "—" }, { id: "ac", label: "AC" }, { id: "tv", label: "TV" }, { id: "fridge", label: "Fridge" }, { id: "wm", label: "Washing" },
];
const inr = (n: number) => "₹" + n.toLocaleString("en-IN");
const todayISO = () => new Date().toISOString().slice(0, 10);
const plusDaysISO = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

type Window = "live" | "scheduled" | "ended" | "inactive";
function offerWindow(o: Offer, now: string): Window {
  if (!o.active) return "inactive";
  if (o.starts_at > now) return "scheduled";
  if (o.ends_at < now) return "ended";
  return "live";
}
function windowLabel(w: Window, lang: Lang): string {
  const map: Record<Window, keyof typeof UI> = { live: "off_live", scheduled: "off_scheduled", ended: "off_ended", inactive: "off_inactive" };
  return t(UI[map[w]], lang);
}

export default function Offers({ lang, token }: { lang: Lang; token: string | null }): JSX.Element {
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const now = todayISO();

  const reload = useCallback(() => { listAllOffers(token).then(setOffers).catch(() => setOffers([])); }, [token]);
  useEffect(() => { reload(); getStores().then(setStores).catch(() => {}); }, [reload]);

  const storeName = useMemo(() => {
    const m = new Map(stores.map((s) => [s.id, s.name]));
    return (id: string | null | undefined) => (id ? m.get(id) ?? id : t(UI.off_any_store, lang));
  }, [stores, lang]);
  const toast = useToast();

  async function remove(o: Offer) {
    setBusy(o.offer_id);
    try {
      await deleteOffer(o.offer_id, token);
      toast.notify(t(UI.toast_removed, lang));
      reload();
    } catch (err) {
      toast.notify((err as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="content-narrow af-screen" lang={lang}>
      <div className="page-head">
        <h1>{t(UI.off_title, lang)}</h1>
        <p>{t(UI.off_sub, lang)}</p>
      </div>

      <CreateOfferForm lang={lang} stores={stores} onSaved={reload} token={token} />

      <h3 className="af-h">{t(UI.off_all, lang)}</h3>
      {!offers ? <div className="loading">{t(UI.af_loading, lang)}</div> : offers.length === 0 ? (
        <p className="af-empty-cell">{t(UI.af_none, lang)}</p>
      ) : (
        <div className="tbl-scroll">
          <table className="lb-table">
            <thead>
              <tr>
                <th>{t(UI.off_offer_title, lang)}</th>
                <th>{t(UI.af_store, lang)}</th>
                <th>{t(UI.off_discount, lang)}</th>
                <th>{t(UI.off_window, lang)}</th>
                <th>{t(UI.off_boost, lang)}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => {
                const w = offerWindow(o, now);
                return (
                  <tr key={o.offer_id}>
                    <td>
                      <b>{o.title}</b>
                      <small style={{ display: "block", color: "var(--muted)" }}>
                        {[o.brand, o.category ? o.category.toUpperCase() : null].filter(Boolean).join(" · ")}
                      </small>
                    </td>
                    <td style={{ textTransform: "capitalize", color: "var(--muted)" }}>{storeName(o.store_id)}</td>
                    <td>{o.discount_pct ? `${o.discount_pct}%` : o.offer_price ? inr(o.offer_price) : "—"}</td>
                    <td>
                      <span className={`af-pill ${w === "live" ? "ok" : w === "ended" || w === "inactive" ? "off" : "warn"}`}>{windowLabel(w, lang)}</span>
                      <small style={{ display: "block", color: "var(--muted)" }}>{o.starts_at} → {o.ends_at}</small>
                    </td>
                    <td>{o.boost_weight > 0 ? <span className="af-boost">⚡ {o.boost_weight}</span> : <span style={{ color: "var(--muted)" }}>0</span>}</td>
                    <td style={{ textAlign: "right" }}>
                      <button type="button" className="btn-link danger" disabled={busy === o.offer_id} onClick={() => remove(o)}>{t(UI.off_delete, lang)}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CreateOfferForm({ lang, stores, onSaved, token }: {
  lang: Lang; stores: Store[]; onSaved: () => void; token: string | null;
}): JSX.Element {
  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [store, setStore] = useState("");
  const [discount, setDiscount] = useState("");
  const [price, setPrice] = useState("");
  const [starts, setStarts] = useState(todayISO());
  const [ends, setEnds] = useState(plusDaysISO(7));
  const [boost, setBoost] = useState(0);
  const [saving, setSaving] = useState(false);

  const valid = title.trim() !== "" && starts !== "" && ends !== "" && ends >= starts;
  const toast = useToast();

  async function save() {
    if (!valid) return;
    setSaving(true);
    try {
      await createOffer({
        title: title.trim(),
        brand: brand.trim() || null,
        category: category || null,
        store_id: store || null,
        discount_pct: discount ? Number(discount) : null,
        offer_price: price ? Number(price) : null,
        starts_at: starts,
        ends_at: ends,
        boost_weight: boost,
        active: true,
        created_by: "admin",
      }, token);
      toast.notify(t(UI.toast_saved, lang));
      setTitle(""); setBrand(""); setCategory(""); setDiscount(""); setPrice(""); setBoost(0);
      onSaved();
    } catch (err) {
      toast.notify((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="af-form ed-card">
      <h3 className="af-h" style={{ marginTop: 0 }}>{t(UI.off_create, lang)}</h3>
      <div className="af-grid">
        <label className="ed-field" style={{ gridColumn: "1 / -1" }}><span>{t(UI.off_offer_title, lang)}</span>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="LG AC — Year-end clearance" />
        </label>
        <label className="ed-field"><span>{t(UI.off_brand, lang)}</span>
          <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} />
        </label>
        <label className="ed-field"><span>{t(UI.off_category, lang)}</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label className="ed-field"><span>{t(UI.af_store, lang)}</span>
          <select value={store} onChange={(e) => setStore(e.target.value)}>
            <option value="">{t(UI.off_any_store, lang)}</option>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="ed-field"><span>{t(UI.off_discount, lang)}</span>
          <input type="number" min={0} max={100} value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </label>
        <label className="ed-field"><span>{t(UI.off_price, lang)}</span>
          <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <label className="ed-field"><span>{t(UI.off_starts, lang)}</span>
          <input type="date" value={starts} onChange={(e) => setStarts(e.target.value)} />
        </label>
        <label className="ed-field"><span>{t(UI.off_ends, lang)}</span>
          <input type="date" value={ends} min={starts} onChange={(e) => setEnds(e.target.value)} />
        </label>
      </div>

      <label className="ed-field">
        <span>{t(UI.off_boost, lang)}: <b>{boost.toFixed(2)}</b></span>
        <input type="range" min={0} max={1} step={0.05} value={boost} onChange={(e) => setBoost(Number(e.target.value))} />
        <small>{t(UI.off_boost_hint, lang)}</small>
      </label>

      <div className="ed-actions">
        <button type="button" className="btn btn-amber btn-sm" disabled={!valid || saving} onClick={save}>{saving ? t(UI.af_saving, lang) : t(UI.off_create, lang)}</button>
      </div>
    </div>
  );
}
