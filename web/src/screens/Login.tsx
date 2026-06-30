/** Role-based sign-in with one-tap demo accounts (Admin/CXO · Manager · Salesperson). */
import { useEffect, useState } from "react";
import type { FormEvent, JSX } from "react";
import { useAuth } from "../lib/auth";
import { getDemoUsers } from "../lib/api";
import type { AuthUser, Lang } from "../lib/api";
import { IS_REMOTE } from "../lib/api";
import { UI, t } from "../lib/i18n";
import { Bolt } from "../components/NavIcons";

export default function Login({ lang, onToggleLang }: { lang: Lang; onToggleLang: () => void }): JSX.Element {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [demoPw, setDemoPw] = useState("");
  const [reps, setReps] = useState<AuthUser[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (IS_REMOTE) return; // demo accounts are offline-only; never load them on a live deploy
    getDemoUsers()
      .then((d) => {
        setDemoPw(d.demoPassword);
        const order: AuthUser["role"][] = ["admin", "manager", "salesperson"];
        setReps(order.map((r) => d.users.find((u) => u.role === r)).filter((u): u is AuthUser => !!u));
      })
      .catch(() => {});
  }, []);

  async function submit(em: string, pw: string, e?: FormEvent) {
    e?.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(em, pw);
    } catch (ex) {
      setErr((ex as Error).message || "Sign-in failed");
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap" lang={lang}>
      <div className="login-hero">
        <div className="brand">
          <span className="mark"><Bolt /></span>
          <span className="name">LIQO<small>Retail Intelligence</small></span>
        </div>
        <h1>{t(UI.tagline, lang)}</h1>
        <p className="blurb">{t(UI.login_blurb, lang)}</p>
        <div className="login-stats">
          <div className="s"><b>2,000+</b><span>{t(UI.stat_skus, lang)}</span></div>
          <div className="s"><b>11</b><span>{t(UI.stat_stores, lang)}</span></div>
          <div className="s"><b>4</b><span>{t(UI.stat_categories, lang)}</span></div>
        </div>
      </div>

      <div className="login-form-col">
        <div className="login-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>{t(UI.sign_in, lang)}</h2>
            <button type="button" className="lang-pill" aria-pressed={lang === "hi"} onClick={onToggleLang}>
              {lang === "en" ? <><b>EN</b> | हिं</> : <>EN | <b>हिं</b></>}
            </button>
          </div>
          <p className="sub">{t(UI.use_work_email, lang)}</p>

          <form onSubmit={(e) => submit(email, password, e)}>
            <div className="field">
              <label htmlFor="email">{t(UI.email_or_phone, lang)}</label>
              <input id="email" type="text" autoComplete="username" placeholder="you@liqo.in"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pw">{t(UI.password, lang)}</label>
              <input id="pw" type="password" autoComplete="current-password" placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {err && <div className="login-err">{err}</div>}
            <button type="submit" className="btn btn-indigo btn-block" disabled={busy}>
              {busy ? t(UI.signing_in, lang) : t(UI.sign_in, lang)}
            </button>
          </form>

          {/* One-tap demo accounts are ONLY for the offline/demo build (no Worker).
              They never appear on a live deployment, where real staff sign in with
              their phone/email. */}
          {!IS_REMOTE && reps.length > 0 && (
            <div className="demo-list">
              <div className="lbl">{t(UI.demo_accounts, lang)}</div>
              {reps.map((u) => (
                <button key={u.id} type="button" className="demo-row" disabled={busy}
                  onClick={() => { setEmail(u.email); setPassword(demoPw); void submit(u.email, demoPw); }}>
                  <span><b>{t(roleKey(u.role), lang)}</b><br /><small>{u.email}</small></span>
                  <span aria-hidden="true">→</span>
                </button>
              ))}
              <p className="sub" style={{ marginTop: 10 }}>{t(UI.offline_badge, lang)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function roleKey(role: AuthUser["role"]) {
  return role === "admin" ? UI.role_admin : role === "manager" ? UI.role_manager : UI.role_salesperson;
}
