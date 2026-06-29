/** Account modal — shows the signed-in user + a self-service change-password form. */
import { useState } from "react";
import type { JSX } from "react";
import { changePassword, IS_REMOTE } from "../lib/api";
import type { AuthUser, Lang } from "../lib/api";
import { UI, t } from "../lib/i18n";

export default function AccountModal({
  lang, user, token, onClose,
}: { lang: Lang; user: AuthUser; token: string | null; onClose: () => void }): JSX.Element {
  const [oldP, setOldP] = useState("");
  const [newP, setNewP] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (newP.length < 4) { setErr(t(UI.acc_min, lang)); setStatus("error"); return; }
    if (newP !== confirm) { setErr(t(UI.acc_mismatch, lang)); setStatus("error"); return; }
    setStatus("saving");
    try {
      await changePassword(oldP, newP, token);
      setStatus("saved"); setOldP(""); setNewP(""); setConfirm("");
    } catch (e2) { setErr((e2 as Error).message); setStatus("error"); }
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-card" lang={lang} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t(UI.acc_title, lang)}</h3>
          <button type="button" className="modal-x" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <div className="acc-id">
          <div className="acc-av">{user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</div>
          <div><b>{user.name}</b><br /><small>{user.email}</small></div>
        </div>

        {!IS_REMOTE ? (
          <p className="acc-note">{t(UI.acc_offline, lang)}</p>
        ) : (
          <form onSubmit={save} className="acc-form">
            <h4>{t(UI.acc_change, lang)}</h4>
            <label className="ed-field"><span>{t(UI.acc_current, lang)}</span>
              <input type="password" autoComplete="current-password" value={oldP} onChange={(e) => setOldP(e.target.value)} />
            </label>
            <label className="ed-field"><span>{t(UI.acc_new, lang)}</span>
              <input type="password" autoComplete="new-password" value={newP} onChange={(e) => setNewP(e.target.value)} />
            </label>
            <label className="ed-field"><span>{t(UI.acc_confirm, lang)}</span>
              <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </label>
            <div className="ed-actions">
              <button type="submit" className="btn btn-indigo" disabled={status === "saving"}>
                {status === "saving" ? t(UI.ed_saving, lang) : t(UI.acc_update, lang)}
              </button>
              {status === "saved" && <span className="ed-ok">{t(UI.acc_done, lang)}</span>}
              {status === "error" && err && <span className="login-err">{err}</span>}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
