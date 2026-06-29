/**
 * Incentives (all roles) — milestones to chase + the incentive ledger.
 * Salespeople see their own ledger; admin/manager can filter by employee.
 * Milestones list shows metric / threshold / period / reward. The ledger shows
 * period, points, ₹ amount and status (credited / settled).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { listMilestones, listIncentives, listEmployees, pointsToInr } from "../lib/api";
import type { AuthUser, Employee, Incentive, IncentiveStatus, Lang, Milestone, MilestoneMetric } from "../lib/api";
import { UI, t } from "../lib/i18n";

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

function metricLabel(m: MilestoneMetric, lang: Lang): string {
  const map: Record<MilestoneMetric, keyof typeof UI> = {
    items_per_bill: "inc_m_ipb", bills: "inc_m_bills", reco_rate: "inc_m_reco", revenue: "inc_m_revenue", points: "inc_points",
  };
  return t(UI[map[m]], lang);
}
function periodLabel(p: Milestone["period"], lang: Lang): string {
  return p === "weekly" ? t(UI.inc_weekly, lang) : p === "monthly" ? t(UI.inc_monthly, lang) : t(UI.inc_once, lang);
}
function statusLabel(s: IncentiveStatus, lang: Lang): string {
  const map: Record<IncentiveStatus, keyof typeof UI> = { pending: "inc_pending", credited: "inc_credited", settled: "inc_settled", void: "inc_void" };
  return t(UI[map[s]], lang);
}
function threshold(m: Milestone): string {
  if (m.metric === "reco_rate") return Math.round(m.threshold * 100) + "%";
  if (m.metric === "revenue") return inr(m.threshold);
  if (m.metric === "items_per_bill") return m.threshold.toFixed(2);
  return String(m.threshold);
}

export default function Incentives({ lang, user, token }: { lang: Lang; user: AuthUser; token: string | null }): JSX.Element {
  const isStaffAdmin = user.role === "admin" || user.role === "manager";
  const [milestones, setMilestones] = useState<Milestone[] | null>(null);
  const [rows, setRows] = useState<Incentive[] | null>(null);
  const [emps, setEmps] = useState<Employee[]>([]);
  // Salespeople are locked to their own id; managers/admins can filter.
  const [empFilter, setEmpFilter] = useState<string>(isStaffAdmin ? "" : user.id);

  useEffect(() => {
    listMilestones(token).then(setMilestones).catch(() => setMilestones([]));
    if (isStaffAdmin) {
      const opts = user.role === "manager" && user.storeId ? { storeId: user.storeId } : undefined;
      listEmployees(opts, token).then(setEmps).catch(() => {});
    }
  }, [token, isStaffAdmin, user.role, user.storeId]);

  const reload = useCallback(() => {
    const employeeId = isStaffAdmin ? (empFilter || null) : user.id;
    listIncentives({ employeeId }, token).then(setRows).catch(() => setRows([]));
  }, [isStaffAdmin, empFilter, user.id, token]);
  useEffect(() => { reload(); }, [reload]);

  const empName = useMemo(() => {
    const m = new Map(emps.map((e) => [e.employee_id, e.name]));
    return (id: string) => m.get(id) ?? id;
  }, [emps]);

  const credited = useMemo(
    () => (rows ?? []).filter((r) => r.status === "credited" || r.status === "settled").reduce((sum, r) => sum + r.amount_inr, 0),
    [rows],
  );
  // Total actually disbursed (settled by payroll).
  const paidOut = useMemo(
    () => (rows ?? []).filter((r) => r.status === "settled").reduce((sum, r) => sum + r.amount_inr, 0),
    [rows],
  );
  // Per-period (month) rollup — newest first.
  const byPeriod = useMemo(() => {
    const m = new Map<string, { credited: number; paid: number; points: number }>();
    for (const r of rows ?? []) {
      if (r.status === "void") continue;
      const a = m.get(r.period) ?? { credited: 0, paid: 0, points: 0 };
      if (r.status === "credited" || r.status === "settled") a.credited += r.amount_inr;
      if (r.status === "settled") a.paid += r.amount_inr;
      a.points += r.points;
      m.set(r.period, a);
    }
    return [...m.entries()].sort((x, y) => (x[0] < y[0] ? 1 : -1));
  }, [rows]);

  return (
    <div className="content-narrow af-screen" lang={lang}>
      <div className="page-head">
        <h1>{t(UI.inc_title, lang)}</h1>
        <p>{t(UI.inc_sub, lang)}</p>
      </div>

      <h3 className="af-h">{t(UI.inc_milestones, lang)}</h3>
      {!milestones ? <div className="loading">{t(UI.af_loading, lang)}</div> : milestones.length === 0 ? (
        <p className="af-empty-cell">{t(UI.af_none, lang)}</p>
      ) : (
        <div className="af-cards">
          {milestones.map((m) => (
            <div className="af-mcard" key={m.milestone_id}>
              <div className="af-mcard-top">
                <span className="af-mcard-metric">{metricLabel(m.metric, lang)}</span>
                <span className="tag-pill">{periodLabel(m.period, lang)}</span>
              </div>
              <div className="af-mcard-name">{m.name}</div>
              <div className="af-mcard-foot">
                <span className="af-mcard-th">{t(UI.inc_threshold, lang)} <b>{threshold(m)}</b></span>
                <span className="af-mcard-reward">{inr(m.reward_inr)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {rows && rows.length > 0 && (
        <>
          <div className="inc-stats">
            <div className="inc-stat paid"><span className="inc-stat-l">{t(UI.inc_paid_out, lang)}</span><span className="inc-stat-v">{inr(paidOut)}</span></div>
            <div className="inc-stat"><span className="inc-stat-l">{t(UI.inc_total_credit, lang)}</span><span className="inc-stat-v">{inr(credited)}</span></div>
          </div>
          <h3 className="af-h">{t(UI.inc_by_month, lang)}</h3>
          <div className="tbl-scroll">
            <table className="lb-table">
              <thead><tr>
                <th>{t(UI.inc_period, lang)}</th><th>{t(UI.inc_points, lang)}</th>
                <th>{t(UI.inc_amount, lang)}</th><th>{t(UI.inc_paid_out, lang)}</th>
              </tr></thead>
              <tbody>
                {byPeriod.map(([period, v]) => (
                  <tr key={period}>
                    <td style={{ fontWeight: 700 }}>{period}</td>
                    <td><span className="tag-pill">{v.points}</span></td>
                    <td className="pts-cell"><b>{inr(v.credited)}</b></td>
                    <td style={{ color: "var(--success, #1B7F4D)", fontWeight: 700 }}>{inr(v.paid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="af-ledger-head">
        <h3 className="af-h" style={{ margin: 0 }}>{t(UI.inc_ledger, lang)}</h3>
        <span style={{ flex: 1 }} />
        {isStaffAdmin && (
          <label className="af-inline-field">
            <span>{t(UI.inc_filter_emp, lang)}</span>
            <select value={empFilter} onChange={(e) => setEmpFilter(e.target.value)}>
              <option value="">{t(UI.af_all_stores, lang)}</option>
              {emps.map((e) => <option key={e.employee_id} value={e.employee_id}>{e.name}</option>)}
            </select>
          </label>
        )}
        <span className="tag-pill" style={{ background: "var(--amber-soft)", color: "var(--amber-deep)" }}>{t(UI.pts_rate, lang)}</span>
        <span className="af-credit-pill">{t(UI.inc_total_credit, lang)}: <b>{inr(credited)}</b></span>
      </div>

      {!rows ? <div className="loading">{t(UI.af_loading, lang)}</div> : rows.length === 0 ? (
        <p className="af-empty-cell">{t(UI.af_none, lang)}</p>
      ) : (
        <div className="tbl-scroll">
          <table className="lb-table">
            <thead>
              <tr>
                {isStaffAdmin && <th>{t(UI.ppl_employee, lang)}</th>}
                <th>{t(UI.inc_period, lang)}</th>
                <th>{t(UI.inc_points, lang)}</th>
                <th>{t(UI.inc_worth, lang)}</th>
                <th>{t(UI.inc_amount, lang)}</th>
                <th>{t(UI.af_status, lang)}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  {isStaffAdmin && <td><b>{empName(r.employee_id)}</b></td>}
                  <td style={{ color: "var(--muted)" }}>{r.period}{r.reason ? <small style={{ display: "block" }}>{r.reason}</small> : null}</td>
                  <td><span className="tag-pill">{r.points}</span></td>
                  <td style={{ color: "var(--amber-deep)", fontWeight: 700 }}>{inr(pointsToInr(r.points))}</td>
                  <td className="pts-cell"><b>{inr(r.amount_inr)}</b></td>
                  <td><span className={`af-pill ${r.status === "credited" || r.status === "settled" ? "ok" : r.status === "void" ? "off" : ""}`}>{statusLabel(r.status, lang)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
