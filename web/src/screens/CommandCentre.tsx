/** Admin Command Centre — north-star items-per-bill, store comparison and
 *  cross-store inventory health. Works offline (bundled data) and remote. */
import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { getCatalogHealth, getLeaderboard, getStores } from "../lib/api";
import type { CatalogHealth, LeaderboardRow, Lang, Store } from "../lib/api";
import { UI, t } from "../lib/i18n";

const CATS = [
  { id: "ac", label: "AC" },
  { id: "tv", label: "TV" },
  { id: "fridge", label: "Fridge" },
  { id: "wm", label: "Washing" },
];
const inr = (n: number) => n.toLocaleString("en-IN");

interface StoreStat {
  storeId: string;
  skus: number;
  units: number;
  bills: number;
  itemsPerBill: number;
  recoRate: number;
  monthPoints: number;
}

export default function CommandCentre({ lang }: { lang: Lang }): JSX.Element {
  const [health, setHealth] = useState<CatalogHealth | null>(null);
  const [board, setBoard] = useState<LeaderboardRow[] | null>(null);
  const [stores, setStores] = useState<Store[]>([]);

  useEffect(() => {
    getCatalogHealth().then(setHealth).catch(() => setHealth(null));
    getLeaderboard().then(setBoard).catch(() => setBoard([]));
    getStores().then(setStores).catch(() => {});
  }, []);

  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? id;

  // North-star items/bill across the whole network (bill-weighted).
  const northStar = useMemo(() => {
    if (!board || board.length === 0) return 0;
    const bills = board.reduce((s, r) => s + r.bills, 0);
    if (!bills) return 0;
    return board.reduce((s, r) => s + r.itemsPerBill * r.bills, 0) / bills;
  }, [board]);

  const deadStock = useMemo(() => {
    const buckets = (health?.ageing ?? []).filter((a) => a.rank >= 5);
    return {
      units: buckets.reduce((s, a) => s + a.units, 0),
      items: buckets.reduce((s, a) => s + a.items, 0),
    };
  }, [health]);
  const deadPct = health && health.totalUnits ? Math.round((deadStock.units / health.totalUnits) * 100) : 0;

  // Per-store roll-up of salesperson performance + inventory coverage.
  const storeStats: StoreStat[] = useMemo(() => {
    const byStore = new Map<string, StoreStat>();
    const ensure = (id: string) => {
      let s = byStore.get(id);
      if (!s) { s = { storeId: id, skus: 0, units: 0, bills: 0, itemsPerBill: 0, recoRate: 0, monthPoints: 0 }; byStore.set(id, s); }
      return s;
    };
    for (const c of health?.perStore ?? []) { const s = ensure(c.storeId); s.skus += c.items; s.units += c.units; }
    // bill-weighted blends per store
    const agg = new Map<string, { ipb: number; reco: number; bills: number; pts: number }>();
    for (const r of board ?? []) {
      const a = agg.get(r.storeId) ?? { ipb: 0, reco: 0, bills: 0, pts: 0 };
      a.ipb += r.itemsPerBill * r.bills; a.reco += r.recoRate * r.bills; a.bills += r.bills; a.pts += r.monthPoints;
      agg.set(r.storeId, a);
    }
    for (const [id, a] of agg) {
      const s = ensure(id);
      s.bills = a.bills; s.monthPoints = a.pts;
      s.itemsPerBill = a.bills ? a.ipb / a.bills : 0;
      s.recoRate = a.bills ? a.reco / a.bills : 0;
    }
    return [...byStore.values()].sort((x, y) => y.itemsPerBill - x.itemsPerBill);
  }, [health, board]);

  // Coverage matrix: store × category SKU counts (zero = a gap to fill).
  const coverage = useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    for (const c of health?.perStore ?? []) {
      const row = m.get(c.storeId) ?? {};
      row[c.category] = c.items;
      m.set(c.storeId, row);
    }
    return m;
  }, [health]);

  if (!health || !board) return <div className="loading">…</div>;

  const maxAge = Math.max(1, ...(health.ageing ?? []).map((a) => a.units));
  const syncedAt = health.lastSyncedAt ? new Date(health.lastSyncedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

  return (
    <div className="content-narrow" lang={lang}>
      <div className="page-head">
        <h1>{t(UI.cc_title, lang)}</h1>
        <p>{t(UI.cc_sub, lang)}</p>
      </div>

      {/* KPI strip */}
      <div className="cc-kpis">
        <div className="cc-kpi cc-kpi-star">
          <span className="cc-k-label">{t(UI.cc_northstar, lang)}</span>
          <span className="cc-k-val">{northStar.toFixed(2)}</span>
          <span className="cc-k-sub">{t(UI.cc_ipb_target, lang)}</span>
        </div>
        <div className="cc-kpi">
          <span className="cc-k-label">{t(UI.stat_skus, lang)}</span>
          <span className="cc-k-val">{inr(health.totalRows)}</span>
          <span className="cc-k-sub">{inr(health.totalUnits)} {t(UI.cc_units_lbl, lang)}</span>
        </div>
        <div className="cc-kpi">
          <span className="cc-k-label">{t(UI.cc_stores_live, lang)}</span>
          <span className="cc-k-val">{stores.length || storeStats.length}</span>
          <span className="cc-k-sub">{t(UI.cc_synced, lang)} {syncedAt}</span>
        </div>
        <div className={`cc-kpi${deadPct >= 15 ? " cc-warn" : ""}`}>
          <span className="cc-k-label">{t(UI.cc_deadstock, lang)}</span>
          <span className="cc-k-val">{inr(deadStock.units)}</span>
          <span className="cc-k-sub">{deadPct}% · {t(UI.cc_deadstock_sub, lang)}</span>
        </div>
      </div>

      {/* Store comparison */}
      <h3 className="cc-h">{t(UI.cc_store_cmp, lang)}</h3>
      <div className="tbl-scroll">
        <table className="lb-table">
          <thead>
            <tr>
              <th>{t(UI.lb_store, lang)}</th>
              <th>{t(UI.cc_skus_short, lang)}</th>
              <th>{t(UI.lb_ipb, lang)}</th>
              <th>{t(UI.lb_reco, lang)}</th>
              <th>{t(UI.cc_bills, lang)}</th>
              <th>{t(UI.lb_points, lang)}</th>
            </tr>
          </thead>
          <tbody>
            {storeStats.map((s) => (
              <tr key={s.storeId}>
                <td style={{ textTransform: "capitalize", fontWeight: 700 }}>{storeName(s.storeId)}</td>
                <td style={{ color: "var(--muted)" }}>{inr(s.skus)}</td>
                <td><span className="tag-pill">{s.itemsPerBill.toFixed(2)}</span></td>
                <td style={{ color: "var(--muted)" }}>{Math.round(s.recoRate * 100)}%</td>
                <td style={{ color: "var(--muted)" }}>{inr(s.bills)}</td>
                <td className="pts-cell"><b>{inr(s.monthPoints)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="cc-grid2">
        {/* Ageing health */}
        <section className="cc-card">
          <h3 className="cc-h">{t(UI.cc_ageing, lang)}</h3>
          <div className="cc-age">
            {(health.ageing ?? []).map((a) => (
              <div className="cc-age-row" key={a.rank}>
                <span className="cc-age-slab">{a.slab ?? `Tier ${a.rank}`}</span>
                <span className="cc-bar"><span className={`cc-bar-fill${a.rank >= 5 ? " aged" : ""}`} style={{ width: `${Math.round((a.units / maxAge) * 100)}%` }} /></span>
                <span className="cc-age-n">{inr(a.units)}</span>
              </div>
            ))}
          </div>
          <p className="cc-legend"><span className="dot fresh" /> {t(UI.cc_fresh, lang)} &nbsp; <span className="dot aged" /> {t(UI.cc_aged, lang)}</p>
        </section>

        {/* Category coverage */}
        <section className="cc-card">
          <h3 className="cc-h">{t(UI.cc_coverage, lang)}</h3>
          <div className="tbl-scroll">
            <table className="lb-table cc-cov">
              <thead>
                <tr><th>{t(UI.lb_store, lang)}</th>{CATS.map((c) => <th key={c.id}>{c.label}</th>)}</tr>
              </thead>
              <tbody>
                {[...coverage.entries()].map(([sid, row]) => (
                  <tr key={sid}>
                    <td style={{ textTransform: "capitalize", fontWeight: 700 }}>{storeName(sid)}</td>
                    {CATS.map((c) => (
                      <td key={c.id} className={!row[c.id] ? "cc-gap" : ""}>{row[c.id] ? inr(row[c.id]) : "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="cc-legend">{t(UI.cc_coverage_hint, lang)}</p>
        </section>
      </div>
    </div>
  );
}
