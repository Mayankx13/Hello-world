/** Gamified leaderboard — weekly/monthly, within-store and across stores. */
import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { getLeaderboard, getStores, pointsToInr } from "../lib/api";
import type { AuthUser, Lang, LeaderboardRow, Store } from "../lib/api";
import { UI, t } from "../lib/i18n";

const MEDALS = ["🥇", "🥈", "🥉"];
const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

export default function Leaderboard({ lang, user }: { lang: Lang; user: AuthUser }): JSX.Element {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [period, setPeriod] = useState<"week" | "month">("month");
  const [scope, setScope] = useState<"store" | "all">(user.role === "admin" ? "all" : "store");

  useEffect(() => {
    getLeaderboard().then(setRows).catch(() => setRows([]));
    getStores().then(setStores).catch(() => {});
  }, []);

  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? id;

  const ranked = useMemo(() => {
    if (!rows) return [];
    const base = scope === "store" && user.storeId ? rows.filter((r) => r.storeId === user.storeId) : rows;
    const key = period === "week" ? "weekPoints" : "monthPoints";
    return [...base].sort((a, b) => b[key] - a[key]);
  }, [rows, scope, period, user.storeId]);

  const pts = (r: LeaderboardRow) => (period === "week" ? r.weekPoints : r.monthPoints);
  const initials = (n: string) => n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  if (!rows) return <div className="loading">…</div>;

  const top3 = ranked.slice(0, 3);
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean) as LeaderboardRow[];

  return (
    <div className="content-narrow" lang={lang}>
      <div className="page-head">
        <h1>{t(UI.lb_title, lang)}</h1>
        <p>{t(UI.lb_sub, lang)} · <span style={{ color: "var(--amber-deep)", fontWeight: 700 }}>{t(UI.pts_rate, lang)}</span></p>
      </div>

      <div className="lb-tabs">
        <button type="button" className={`lb-tab${period === "week" ? " on" : ""}`} onClick={() => setPeriod("week")}>{t(UI.lb_week, lang)}</button>
        <button type="button" className={`lb-tab${period === "month" ? " on" : ""}`} onClick={() => setPeriod("month")}>{t(UI.lb_month, lang)}</button>
        <span style={{ flex: 1 }} />
        {user.storeId && (
          <button type="button" className={`lb-tab${scope === "store" ? " on" : ""}`} onClick={() => setScope("store")}>{t(UI.lb_within, lang)}</button>
        )}
        <button type="button" className={`lb-tab${scope === "all" ? " on" : ""}`} onClick={() => setScope("all")}>{t(UI.lb_across, lang)}</button>
      </div>

      {podiumOrder.length === 3 && (
        <div className="podium">
          {podiumOrder.map((r) => {
            const rank = ranked.indexOf(r);
            return (
              <div key={r.userId} className={`p${rank === 0 ? " gold" : ""}`}>
                <div className="medal">{MEDALS[rank]}</div>
                <div className="pav">{initials(r.name)}</div>
                <div className="pn">{r.name}{r.userId === user.id ? " ·" : ""}</div>
                <div className="pstore">{storeName(r.storeId)}</div>
                <div className="ppts">{pts(r).toLocaleString("en-IN")}<small> {t(UI.lb_points, lang)}</small></div>
                <div className="pworth">{inr(pointsToInr(pts(r)))}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="tbl-scroll">
        <table className="lb-table">
          <thead>
            <tr>
              <th>{t(UI.lb_rank, lang)}</th>
              <th>{t(UI.lb_rep, lang)}</th>
              <th>{t(UI.lb_store, lang)}</th>
              <th>{t(UI.lb_ipb, lang)}</th>
              <th>{t(UI.lb_reco, lang)}</th>
              <th>{t(UI.lb_points, lang)}</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r, i) => (
              <tr key={r.userId} className={r.userId === user.id ? "me" : ""}>
                <td className="rankcell">{i + 1}</td>
                <td>
                  <span className="lb-rep">
                    <span className="av">{initials(r.name)}</span>
                    <span>{r.name}{r.userId === user.id && <span className="you-chip">{t(UI.lb_you, lang)}</span>}
                      {r.streak >= 3 && <small style={{ display: "block", color: "var(--amber-deep)", fontWeight: 700 }}>🔥 {r.streak} {t(UI.lb_streak, lang)}</small>}
                    </span>
                  </span>
                </td>
                <td style={{ textTransform: "capitalize", color: "var(--muted)" }}>{storeName(r.storeId)}</td>
                <td><span className="tag-pill">{r.itemsPerBill.toFixed(2)}</span></td>
                <td style={{ color: "var(--muted)" }}>{Math.round(r.recoRate * 100)}%</td>
                <td className="pts-cell"><b>{pts(r).toLocaleString("en-IN")}</b><small style={{ display: "block", color: "var(--amber-deep)", fontWeight: 700 }}>{inr(pointsToInr(pts(r)))}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
