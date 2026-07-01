/** Admin — platform activity log: the audit trail of every state-changing action
 *  (who did what, when, and the outcome). Backed by GET /audit (D1 audit_log). */
import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { getAuditLog } from "../lib/api";
import type { AuditLogRow, Lang } from "../lib/api";
import { UI, t } from "../lib/i18n";

export default function Audit({ lang, token }: { lang: Lang; token: string | null }): JSX.Element {
  const [rows, setRows] = useState<AuditLogRow[] | null>(null);
  const [resource, setResource] = useState("");

  useEffect(() => {
    getAuditLog({ limit: 300, resource: resource || undefined }, token).then(setRows).catch(() => setRows([]));
  }, [token, resource]);

  // Distinct areas seen, for the filter (derived from the unfiltered first load).
  const [areas, setAreas] = useState<string[]>([]);
  useEffect(() => {
    getAuditLog({ limit: 500 }, token)
      .then((all) => setAreas([...new Set(all.map((r) => r.resource).filter((r): r is string => !!r))].sort()))
      .catch(() => {});
  }, [token]);

  const shortTs = useMemo(() => (ts: string) => ts.replace("T", " ").replace(/\.\d+Z?$/, "").replace("Z", ""), []);

  return (
    <div className="content-narrow af-screen" lang={lang}>
      <div className="page-head">
        <h1>{t(UI.audit_title, lang)}</h1>
        <p>{t(UI.audit_sub, lang)}</p>
      </div>

      <div className="af-ledger-head">
        <span style={{ flex: 1 }} />
        <label className="af-inline-field">
          <span>{t(UI.audit_resource, lang)}</span>
          <select value={resource} onChange={(e) => setResource(e.target.value)}>
            <option value="">{t(UI.af_all_stores, lang)}</option>
            {areas.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
      </div>

      {!rows ? <div className="loading">{t(UI.af_loading, lang)}</div> : rows.length === 0 ? (
        <p className="af-empty-cell">{t(UI.audit_empty, lang)}</p>
      ) : (
        <div className="tbl-scroll">
          <table className="lb-table">
            <thead>
              <tr>
                <th>{t(UI.audit_when, lang)}</th>
                <th>{t(UI.audit_actor, lang)}</th>
                <th>{t(UI.audit_action, lang)}</th>
                <th>{t(UI.audit_target, lang)}</th>
                <th>{t(UI.af_status, lang)}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ color: "var(--muted)", whiteSpace: "nowrap", fontSize: 12.5 }}>{shortTs(r.ts)}</td>
                  <td>
                    {r.actor_id ?? "—"}
                    {r.actor_role ? <small style={{ display: "block", color: "var(--muted)" }}>{r.actor_role}</small> : null}
                  </td>
                  <td>
                    <span className="tag-pill">{r.method}</span>{" "}
                    <span style={{ fontFamily: "monospace", fontSize: 12 }}>{r.path}</span>
                  </td>
                  <td>
                    {r.resource ?? "—"}
                    {r.resource_id ? <small style={{ display: "block", color: "var(--muted)" }}>{r.resource_id}</small> : null}
                  </td>
                  <td>
                    <span className={`af-pill ${r.outcome === "ok" ? "ok" : r.outcome === "denied" ? "off" : ""}`}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
