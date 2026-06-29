/** Admin Command Centre — north-star items-per-bill, store comparison and
 *  cross-store inventory health. Works offline (bundled data) and remote. */
import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { getCatalogHealth, getLeaderboard, getStores, getStoreDaily, getDemandAnalysis, getDemandRequests, IS_REMOTE } from "../lib/api";
import type { CatalogHealth, LeaderboardRow, Lang, Store, StoreDaily, DemandCategory, DemandRequestRow } from "../lib/api";
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

export default function CommandCentre({ lang, token }: { lang: Lang; token?: string | null }): JSX.Element {
  const [health, setHealth] = useState<CatalogHealth | null>(null);
  const [board, setBoard] = useState<LeaderboardRow[] | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [daily, setDaily] = useState<StoreDaily[]>([]);
  const [demand, setDemand] = useState<DemandCategory[]>([]);
  const [requests, setRequests] = useState<DemandRequestRow[]>([]);

  useEffect(() => {
    getCatalogHealth().then(setHealth).catch(() => setHealth(null));
    getLeaderboard().then(setBoard).catch(() => setBoard([]));
    getStores().then(setStores).catch(() => {});
    getStoreDaily({ days: 7 }, token).then(setDaily).catch(() => setDaily([]));
    getDemandAnalysis({}, token).then(setDemand).catch(() => setDemand([]));
    getDemandRequests({}, token).then(setRequests).catch(() => setRequests([]));
  }, [token]);

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

  // Network-wide revenue/bills per day (last 7 days), newest first.
  const recentDays = useMemo(() => {
    const byDay = new Map<string, { bills: number; revenue: number }>();
    for (const r of daily) {
      const d = byDay.get(r.day) ?? { bills: 0, revenue: 0 };
      d.bills += r.bills; d.revenue += r.revenue; byDay.set(r.day, d);
    }
    return [...byDay.entries()].map(([day, v]) => ({ day, ...v })).sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, 7);
  }, [daily]);

  // Demand conversion by category (shown vs sold), network-wide.
  const demandRanked = useMemo(() => {
    const byCat = new Map<string, { suggested: number; sold: number }>();
    for (const r of demand) {
      const k = r.category ?? "—";
      const c = byCat.get(k) ?? { suggested: 0, sold: 0 };
      c.suggested += r.suggested; c.sold += r.sold; byCat.set(k, c);
    }
    return [...byCat.entries()]
      .map(([category, v]) => ({ category, ...v, conversion: v.suggested ? v.sold / v.suggested : 0 }))
      .sort((a, b) => b.suggested - a.suggested);
  }, [demand]);

  // Open customer demand (sourcing gaps) first.
  const openRequests = useMemo(() => {
    const open = requests.filter((r) => r.status === "open");
    const rest = requests.filter((r) => r.status !== "open");
    return [...open, ...rest].slice(0, 12);
  }, [requests]);

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

      {/* Recent trading — daily bills + revenue from v_store_daily */}
      {(recentDays.length > 0 || IS_REMOTE) && (
        <section className="cc-card cc-block">
          <h3 className="cc-h">{t(UI.cc_trading, lang)}</h3>
          {recentDays.length === 0 ? <p className="cc-legend">{t(UI.cc_no_data, lang)}</p> : (
            <div className="tbl-scroll">
              <table className="lb-table">
                <thead><tr><th>{t(UI.cc_day, lang)}</th><th>{t(UI.cc_billsn, lang)}</th><th>{t(UI.cc_revenue, lang)}</th></tr></thead>
                <tbody>
                  {recentDays.map((d) => (
                    <tr key={d.day}>
                      <td style={{ fontWeight: 700 }}>{d.day}</td>
                      <td style={{ color: "var(--muted)" }}>{inr(d.bills)}</td>
                      <td className="pts-cell"><b>₹{inr(d.revenue)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Demand & conversion — v_demand_category (shown vs sold) */}
      {(demandRanked.length > 0 || IS_REMOTE) && (
        <section className="cc-card cc-block">
          <h3 className="cc-h">{t(UI.cc_demand, lang)}</h3>
          {demandRanked.length === 0 ? <p className="cc-legend">{t(UI.cc_no_data, lang)}</p> : (
            <div className="tbl-scroll">
              <table className="lb-table">
                <thead><tr><th>{t(UI.cc_category, lang)}</th><th>{t(UI.cc_suggested, lang)}</th><th>{t(UI.cc_sold, lang)}</th><th>{t(UI.cc_conversion, lang)}</th></tr></thead>
                <tbody>
                  {demandRanked.map((d) => (
                    <tr key={d.category}>
                      <td style={{ fontWeight: 700, textTransform: "uppercase" }}>{d.category}</td>
                      <td style={{ color: "var(--muted)" }}>{inr(d.suggested)}</td>
                      <td style={{ color: "var(--muted)" }}>{inr(d.sold)}</td>
                      <td><span className="tag-pill">{Math.round(d.conversion * 100)}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Customer demand (gaps) — demand_requests */}
      {(openRequests.length > 0 || IS_REMOTE) && (
        <section className="cc-card cc-block">
          <h3 className="cc-h">{t(UI.cc_gaps, lang)}</h3>
          {openRequests.length === 0 ? <p className="cc-legend">{t(UI.cc_no_data, lang)}</p> : (
            <>
              <div className="cc-gaps">
                {openRequests.map((r) => (
                  <div className="cc-gap-row" key={r.id}>
                    <span className="cc-gap-main">{[r.category, r.brand, r.sku].filter(Boolean).join(" · ") || "—"}</span>
                    {r.budget_band && <span className="tag-pill">{r.budget_band}</span>}
                    <span style={{ color: "var(--muted)", textTransform: "capitalize" }}>{storeName(r.store_id ?? "")}</span>
                    <span className={`af-pill ${r.status === "open" ? "" : "ok"}`}>{r.status}</span>
                    {r.note && <span className="cc-gap-note">{r.note}</span>}
                  </div>
                ))}
              </div>
              <p className="cc-legend">{t(UI.cc_gaps_hint, lang)}</p>
            </>
          )}
        </section>
      )}
    </div>
  );
}
