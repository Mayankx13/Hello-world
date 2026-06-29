/**
 * People (admin/manager) — three tabs over the HR endpoints:
 *   • Employees: roster + add form (POST /employees) + activate/deactivate (PATCH).
 *   • Attendance: store+date picker, summary counts, mark per employee (POST).
 *   • Leaves: pending list with Approve/Reject (PATCH) + a request form (POST).
 *
 * `token` is the API bearer when remote (null offline, where writes persist to
 * localStorage so the demo still works).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import {
  listEmployees, saveEmployee, setEmployeeStatus,
  listAttendance, getAttendanceSummary, markAttendance,
  listLeaves, createLeave, decideLeave, leaveDays,
  getStores, IS_REMOTE,
} from "../lib/api";
import type {
  Employee, AttendanceStatus, AttendanceSummary,
  Leave, LeaveType, Role, Lang, Store,
} from "../lib/api";
import { UI, t } from "../lib/i18n";

type Tab = "employees" | "attendance" | "leaves";

const ROLES: Role[] = ["salesperson", "manager", "admin"];
const ATT_OPTS: AttendanceStatus[] = ["present", "absent", "half_day", "leave", "week_off", "holiday"];
const LEAVE_TYPES: LeaveType[] = ["casual", "sick", "earned", "unpaid"];

const todayISO = () => new Date().toISOString().slice(0, 10);

function attLabel(s: AttendanceStatus, lang: Lang): string {
  const map: Record<AttendanceStatus, keyof typeof UI> = {
    present: "ppl_present", absent: "ppl_absent", half_day: "ppl_half_day",
    leave: "ppl_leave", week_off: "ppl_week_off", holiday: "ppl_holiday",
  };
  return t(UI[map[s]], lang);
}
function leaveTypeLabel(ty: LeaveType, lang: Lang): string {
  const map: Record<LeaveType, keyof typeof UI> = { casual: "ppl_lv_casual", sick: "ppl_lv_sick", earned: "ppl_lv_earned", unpaid: "ppl_lv_unpaid" };
  return t(UI[map[ty]], lang);
}
function roleLabel(r: Role, lang: Lang): string {
  return r === "admin" ? t(UI.role_admin, lang) : r === "manager" ? t(UI.role_manager, lang) : t(UI.role_salesperson, lang);
}

export default function People({ lang, storeId, token, isAdmin }: { lang: Lang; storeId: string; token: string | null; isAdmin: boolean }): JSX.Element {
  const [tab, setTab] = useState<Tab>("employees");
  const [stores, setStores] = useState<Store[]>([]);

  useEffect(() => { getStores().then(setStores).catch(() => {}); }, []);
  const storeName = useCallback((id: string | null | undefined) => stores.find((s) => s.id === id)?.name ?? id ?? "—", [stores]);

  return (
    <div className="content-narrow af-screen" lang={lang}>
      <div className="page-head">
        <h1>{t(UI.ppl_title, lang)}</h1>
        <p>{t(UI.ppl_sub, lang)}</p>
      </div>

      <div className="lb-tabs">
        <button type="button" className={`lb-tab${tab === "employees" ? " on" : ""}`} onClick={() => setTab("employees")}>{t(UI.ppl_tab_emp, lang)}</button>
        <button type="button" className={`lb-tab${tab === "attendance" ? " on" : ""}`} onClick={() => setTab("attendance")}>{t(UI.ppl_tab_att, lang)}</button>
        <button type="button" className={`lb-tab${tab === "leaves" ? " on" : ""}`} onClick={() => setTab("leaves")}>{t(UI.ppl_tab_lv, lang)}</button>
      </div>

      {!IS_REMOTE && <p className="af-demo-note">{t(UI.af_offline_note, lang)}</p>}

      {tab === "employees" && <Employees lang={lang} token={token} stores={stores} storeName={storeName} isAdmin={isAdmin} />}
      {tab === "attendance" && <AttendanceTab lang={lang} token={token} stores={stores} defaultStoreId={storeId} />}
      {tab === "leaves" && <Leaves lang={lang} token={token} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Employees tab
// ---------------------------------------------------------------------------
function Employees({ lang, token, stores, storeName, isAdmin }: {
  lang: Lang; token: string | null; stores: Store[]; storeName: (id: string | null | undefined) => string; isAdmin: boolean;
}): JSX.Element {
  const [rows, setRows] = useState<Employee[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(() => { listEmployees(undefined, token).then(setRows).catch(() => setRows([])); }, [token]);
  useEffect(() => { reload(); }, [reload]);

  async function toggleStatus(e: Employee) {
    setBusy(e.employee_id);
    await setEmployeeStatus(e.employee_id, e.status === "active" ? "inactive" : "active", token);
    reload();
    setBusy(null);
  }

  if (!rows) return <div className="loading">{t(UI.af_loading, lang)}</div>;

  return (
    <section className="af-section">
      <div className="af-bar">
        <span className="af-count">{rows.length}</span>
        {isAdmin && (
          <button type="button" className="btn btn-amber btn-sm" onClick={() => setAdding((v) => !v)}>
            {adding ? t(UI.af_cancel, lang) : `+ ${t(UI.ppl_add_emp, lang)}`}
          </button>
        )}
      </div>

      {isAdmin && adding && <AddEmployeeForm lang={lang} stores={stores} onSaved={() => { setAdding(false); reload(); }} onCancel={() => setAdding(false)} token={token} />}

      <div className="tbl-scroll">
        <table className="lb-table">
          <thead>
            <tr>
              <th>{t(UI.af_name, lang)}</th>
              <th>{t(UI.af_role, lang)}</th>
              <th>{t(UI.af_store, lang)}</th>
              <th>{t(UI.af_status, lang)}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="af-empty-cell">{t(UI.af_none, lang)}</td></tr>
            ) : rows.map((e) => (
              <tr key={e.employee_id}>
                <td>
                  <span className="af-emp">
                    <b>{e.name}</b>
                    {e.title && <small>{e.title}</small>}
                  </span>
                </td>
                <td style={{ color: "var(--muted)" }}>{roleLabel(e.role, lang)}</td>
                <td style={{ textTransform: "capitalize", color: "var(--muted)" }}>{storeName(e.store_id)}</td>
                <td><span className={`af-pill ${e.status === "active" ? "ok" : "off"}`}>{e.status === "active" ? t(UI.af_active, lang) : t(UI.af_inactive, lang)}</span></td>
                <td style={{ textAlign: "right" }}>
                  {isAdmin ? (
                    <button type="button" className="btn-link" disabled={busy === e.employee_id} onClick={() => toggleStatus(e)}>
                      {e.status === "active" ? t(UI.ppl_deactivate, lang) : t(UI.ppl_activate, lang)}
                    </button>
                  ) : <span style={{ color: "var(--line)" }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AddEmployeeForm({ lang, stores, onSaved, onCancel, token }: {
  lang: Lang; stores: Store[]; onSaved: () => void; onCancel: () => void; token: string | null;
}): JSX.Element {
  const [employeeId, setEmployeeId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState<Role>("salesperson");
  const [store, setStore] = useState("");
  const [saving, setSaving] = useState(false);

  const valid = employeeId.trim() !== "" && name.trim() !== "";

  async function save() {
    if (!valid) return;
    setSaving(true);
    await saveEmployee({
      employee_id: employeeId.trim(), name: name.trim(),
      email: email.trim() || null, phone: phone.trim() || null,
      role, store_id: store || null, title: title.trim() || null, status: "active",
    }, token);
    setSaving(false);
    onSaved();
  }

  return (
    <div className="af-form ed-card">
      <div className="af-grid">
        <label className="ed-field"><span>{t(UI.ppl_emp_id, lang)}</span>
          <input type="text" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="e.g. u-s4-zk" />
        </label>
        <label className="ed-field"><span>{t(UI.af_name, lang)}</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="ed-field"><span>{t(UI.ppl_email, lang)}</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="ed-field"><span>{t(UI.ppl_phone, lang)}</span>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className="ed-field"><span>{t(UI.af_role, lang)}</span>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r, lang)}</option>)}
          </select>
        </label>
        <label className="ed-field"><span>{t(UI.af_store, lang)}</span>
          <select value={store} onChange={(e) => setStore(e.target.value)}>
            <option value="">{t(UI.af_all_stores, lang)}</option>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="ed-field"><span>{t(UI.ppl_title_field, lang)}</span>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Salesperson" />
        </label>
      </div>
      <div className="ed-actions">
        <button type="button" className="btn btn-amber btn-sm" disabled={!valid || saving} onClick={save}>{saving ? t(UI.af_saving, lang) : t(UI.af_save, lang)}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>{t(UI.af_cancel, lang)}</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Attendance tab
// ---------------------------------------------------------------------------
function AttendanceTab({ lang, token, stores, defaultStoreId }: {
  lang: Lang; token: string | null; stores: Store[]; defaultStoreId: string;
}): JSX.Element {
  const [store, setStore] = useState(defaultStoreId);
  const [date, setDate] = useState(todayISO());
  const [emps, setEmps] = useState<Employee[]>([]);
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [summary, setSummary] = useState<AttendanceSummary>({ present: 0, absent: 0, half_day: 0, leave: 0, total: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (!store && stores[0]) setStore(stores[0].id); }, [stores, store]);

  const reload = useCallback(async () => {
    if (!store || !date) return;
    setLoading(true);
    const [employees, attendance, sum] = await Promise.all([
      listEmployees({ storeId: store }, token),
      listAttendance({ storeId: store, date }, token),
      getAttendanceSummary({ storeId: store, date }, token),
    ]);
    const byId: Record<string, AttendanceStatus> = {};
    for (const a of attendance) byId[a.employee_id] = a.status;
    setEmps(employees.filter((e) => e.status === "active"));
    setMarks(byId);
    setSummary(sum);
    setLoading(false);
  }, [store, date, token]);

  useEffect(() => { reload(); }, [reload]);

  async function mark(emp: Employee, status: AttendanceStatus) {
    setMarks((m) => ({ ...m, [emp.employee_id]: status }));
    await markAttendance({ employee_id: emp.employee_id, store_id: store, date, status, marked_by: "admin" }, token);
    getAttendanceSummary({ storeId: store, date }, token).then(setSummary).catch(() => {});
  }

  return (
    <section className="af-section">
      <div className="af-controls">
        <label className="ed-field"><span>{t(UI.af_store, lang)}</span>
          <select value={store} onChange={(e) => setStore(e.target.value)}>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="ed-field"><span>{t(UI.af_date, lang)}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>

      <div className="af-summary">
        <div className="af-stat ok"><b>{summary.present}</b><span>{t(UI.ppl_present, lang)}</span></div>
        <div className="af-stat off"><b>{summary.absent}</b><span>{t(UI.ppl_absent, lang)}</span></div>
        <div className="af-stat"><b>{summary.half_day}</b><span>{t(UI.ppl_half_day, lang)}</span></div>
        <div className="af-stat"><b>{summary.leave}</b><span>{t(UI.ppl_leave, lang)}</span></div>
      </div>

      {loading ? <div className="loading">{t(UI.af_loading, lang)}</div> : !store ? (
        <p className="af-empty-cell">{t(UI.ppl_pick_store_date, lang)}</p>
      ) : (
        <div className="af-att-list">
          {emps.length === 0 ? <p className="af-empty-cell">{t(UI.af_none, lang)}</p> : emps.map((e) => (
            <div className="af-att-row" key={e.employee_id}>
              <span className="af-emp"><b>{e.name}</b><small>{e.title}</small></span>
              <div className="af-att-btns">
                {ATT_OPTS.map((opt) => (
                  <button key={opt} type="button" className={`af-att-opt${marks[e.employee_id] === opt ? " on" : ""}`} onClick={() => mark(e, opt)}>
                    {attLabel(opt, lang)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Leaves tab
// ---------------------------------------------------------------------------
function Leaves({ lang, token }: {
  lang: Lang; token: string | null;
}): JSX.Element {
  const [pending, setPending] = useState<Leave[] | null>(null);
  const [emps, setEmps] = useState<Employee[]>([]);
  const [busy, setBusy] = useState<number | null>(null);

  const empName = useMemo(() => {
    const m = new Map(emps.map((e) => [e.employee_id, e.name]));
    return (id: string) => m.get(id) ?? id;
  }, [emps]);

  const reload = useCallback(() => {
    listLeaves({ status: "pending" }, token).then(setPending).catch(() => setPending([]));
    listEmployees(undefined, token).then(setEmps).catch(() => {});
  }, [token]);
  useEffect(() => { reload(); }, [reload]);

  async function decide(l: Leave, status: "approved" | "rejected") {
    setBusy(l.id);
    await decideLeave(l.id, status, "admin", token);
    reload();
    setBusy(null);
  }

  return (
    <section className="af-section">
      <RequestLeaveForm lang={lang} emps={emps} onSaved={reload} token={token} />

      <h3 className="af-h">{t(UI.ppl_pending, lang)}</h3>
      {!pending ? <div className="loading">{t(UI.af_loading, lang)}</div> : pending.length === 0 ? (
        <p className="af-empty-cell">{t(UI.ppl_no_pending, lang)}</p>
      ) : (
        <div className="tbl-scroll">
          <table className="lb-table">
            <thead>
              <tr>
                <th>{t(UI.ppl_employee, lang)}</th>
                <th>{t(UI.ppl_type, lang)}</th>
                <th>{t(UI.ppl_from, lang)} → {t(UI.ppl_to, lang)}</th>
                <th>{t(UI.ppl_days, lang)}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pending.map((l) => (
                <tr key={l.id}>
                  <td><b>{empName(l.employee_id)}</b>{l.reason && <small style={{ display: "block", color: "var(--muted)" }}>{l.reason}</small>}</td>
                  <td><span className="tag-pill">{leaveTypeLabel(l.type, lang)}</span></td>
                  <td style={{ color: "var(--muted)" }}>{l.from_date} → {l.to_date}</td>
                  <td>{l.days}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button type="button" className="btn-link ok" disabled={busy === l.id} onClick={() => decide(l, "approved")}>{t(UI.ppl_approve, lang)}</button>
                    <button type="button" className="btn-link danger" disabled={busy === l.id} onClick={() => decide(l, "rejected")}>{t(UI.ppl_reject, lang)}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RequestLeaveForm({ lang, emps, onSaved, token }: {
  lang: Lang; emps: Employee[]; onSaved: () => void; token: string | null;
}): JSX.Element {
  const [employeeId, setEmployeeId] = useState("");
  const [type, setType] = useState<LeaveType>("casual");
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!employeeId && emps[0]) setEmployeeId(emps[0].employee_id); }, [emps, employeeId]);
  const days = leaveDays(from, to);
  const valid = employeeId !== "" && to >= from;

  async function save() {
    if (!valid) return;
    setSaving(true);
    await createLeave({ employee_id: employeeId, type, from_date: from, to_date: to, days, reason: reason.trim() || null }, token);
    setSaving(false);
    setReason("");
    onSaved();
  }

  return (
    <div className="af-form ed-card">
      <h3 className="af-h" style={{ marginTop: 0 }}>{t(UI.ppl_request_leave, lang)}</h3>
      <div className="af-grid">
        <label className="ed-field"><span>{t(UI.ppl_employee, lang)}</span>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            {emps.map((e) => <option key={e.employee_id} value={e.employee_id}>{e.name}</option>)}
          </select>
        </label>
        <label className="ed-field"><span>{t(UI.ppl_type, lang)}</span>
          <select value={type} onChange={(e) => setType(e.target.value as LeaveType)}>
            {LEAVE_TYPES.map((ty) => <option key={ty} value={ty}>{leaveTypeLabel(ty, lang)}</option>)}
          </select>
        </label>
        <label className="ed-field"><span>{t(UI.ppl_from, lang)}</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="ed-field"><span>{t(UI.ppl_to, lang)}</span>
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      <label className="ed-field"><span>{t(UI.ppl_reason, lang)}</span>
        <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <div className="ed-actions">
        <button type="button" className="btn btn-amber btn-sm" disabled={!valid || saving} onClick={save}>{saving ? t(UI.af_saving, lang) : `${t(UI.ppl_request_leave, lang)} (${days} ${t(UI.ppl_days, lang).toLowerCase()})`}</button>
      </div>
    </div>
  );
}
