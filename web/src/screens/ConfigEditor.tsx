/** Admin editor for the recommendation engine parameters — live, no redeploy. */
import { useEffect, useState } from "react";
import type { JSX } from "react";
import { getConfig, saveConfigLive, resetConfigLive, hasConfigOverride } from "../lib/api";
import type { EngineConfig, Lang } from "../lib/api";
import { UI, t } from "../lib/i18n";

const CATS: { id: "ac" | "tv" | "fridge" | "wm"; label: string }[] = [
  { id: "ac", label: "AC" },
  { id: "tv", label: "TV" },
  { id: "fridge", label: "Fridge" },
  { id: "wm", label: "Washing" },
];
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export default function ConfigEditor({ lang, token, onChanged }: { lang: Lang; token: string | null; onChanged?: () => void }): JSX.Element {
  const [draft, setDraft] = useState<EngineConfig | null>(null);
  const [cat, setCat] = useState<"ac" | "tv" | "fridge" | "wm">("ac");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [edited, setEdited] = useState(false);

  useEffect(() => { getConfig().then((c) => { setDraft(clone(c)); setEdited(hasConfigOverride()); }); }, []);

  if (!draft) return <div className="loading">…</div>;
  const patch = (fn: (d: EngineConfig) => void) => { setDraft((d) => { const n = clone(d!); fn(n); return n; }); setStatus("idle"); };

  async function save() {
    if (!draft) return;
    setStatus("saving"); setErr(null);
    try {
      draft.updatedAt = new Date().toISOString();
      await saveConfigLive(draft, token);
      setStatus("saved"); setEdited(true); onChanged?.();
    } catch (e) { setErr((e as Error).message); setStatus("error"); }
  }
  async function reset() {
    setStatus("saving");
    try { await resetConfigLive(token); const c = await getConfig(); setDraft(clone(c)); setEdited(false); setStatus("idle"); onChanged?.(); }
    catch (e) { setErr((e as Error).message); setStatus("error"); }
  }

  const bands = draft.priceBands[cat];
  const blend = draft.rankingBlend;
  const moveBrand = (i: number, dir: -1 | 1) => patch((d) => {
    const arr = d.brandPreference[cat]; const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  });

  return (
    <div className="editor">
      <section className="ed-card">
        <h3>{t(UI.ed_bands, lang)}</h3>
        <div className="ed-cattabs">
          {CATS.map((c) => <button key={c.id} type="button" className={`lb-tab${cat === c.id ? " on" : ""}`} onClick={() => setCat(c.id)}>{c.label}</button>)}
        </div>
        {(["good", "better", "best"] as const).map((tier) => (
          <div key={tier} className="ed-row">
            <span className="ed-tier">{t(UI[tier], lang)}</span>
            <input type="number" aria-label={`${tier} min`} value={bands[tier][0]}
              onChange={(e) => patch((d) => { d.priceBands[cat][tier][0] = Number(e.target.value); })} />
            <span className="ed-dash">–</span>
            <input type="number" aria-label={`${tier} max`} value={bands[tier][1]}
              onChange={(e) => patch((d) => { d.priceBands[cat][tier][1] = Number(e.target.value); })} />
          </div>
        ))}
      </section>

      <section className="ed-card">
        <h3>{t(UI.ed_blend, lang)}</h3>
        <label className="ed-field">
          <span>{t(UI.ed_volw, lang)}: <b>{blend.volumeWeight.toFixed(2)}</b></span>
          <input type="range" min={0} max={1} step={0.05} value={blend.volumeWeight}
            onChange={(e) => patch((d) => { d.rankingBlend.volumeWeight = Number(e.target.value); })} />
          <small>{t(UI.ed_volw_h, lang)}</small>
        </label>
        <label className="ed-field">
          <span>{t(UI.ed_marginbasis, lang)}</span>
          <select value={blend.marginBasis} onChange={(e) => patch((d) => { d.rankingBlend.marginBasis = e.target.value as "amount" | "percent"; })}>
            <option value="amount">{t(UI.ed_amount, lang)}</option>
            <option value="percent">{t(UI.ed_percent, lang)}</option>
          </select>
        </label>
        <label className="ed-field">
          <span>{t(UI.ed_fitw, lang)}: <b>{blend.fitWeight.toFixed(2)}</b></span>
          <input type="range" min={0} max={1} step={0.05} value={blend.fitWeight}
            onChange={(e) => patch((d) => { d.rankingBlend.fitWeight = Number(e.target.value); })} />
          <small>{t(UI.ed_fitw_h, lang)}</small>
        </label>
        <label className="ed-check">
          <input type="checkbox" checked={blend.ageingWeighted} onChange={(e) => patch((d) => { d.rankingBlend.ageingWeighted = e.target.checked; })} />
          {t(UI.ed_ageing, lang)}
        </label>
        <label className="ed-field">
          <span>{t(UI.ed_stretch, lang)}: <b>{Math.round(draft.stretchThreshold * 100)}%</b></span>
          <input type="range" min={0} max={0.3} step={0.01} value={draft.stretchThreshold}
            onChange={(e) => patch((d) => { d.stretchThreshold = Number(e.target.value); })} />
        </label>
      </section>

      <section className="ed-card">
        <h3>{t(UI.ed_brands, lang)} — {CATS.find((c) => c.id === cat)?.label}</h3>
        <div className="ed-cattabs">
          {CATS.map((c) => <button key={c.id} type="button" className={`lb-tab${cat === c.id ? " on" : ""}`} onClick={() => setCat(c.id)}>{c.label}</button>)}
        </div>
        <div className="ed-sub">{t(UI.ed_brand_pri, lang)}</div>
        <ol className="ed-brands">
          {draft.brandPreference[cat].map((b, i) => (
            <li key={b + i}>
              <span>{b}</span>
              <span className="ed-bbtns">
                <button type="button" aria-label="up" onClick={() => moveBrand(i, -1)} disabled={i === 0}>↑</button>
                <button type="button" aria-label="down" onClick={() => moveBrand(i, 1)} disabled={i === draft.brandPreference[cat].length - 1}>↓</button>
                <button type="button" aria-label="remove" onClick={() => patch((d) => { d.brandPreference[cat].splice(i, 1); })}>✕</button>
              </span>
            </li>
          ))}
        </ol>
        <AddBrand onAdd={(b) => patch((d) => { if (b && !d.brandPreference[cat].includes(b)) d.brandPreference[cat].push(b); })} />
        <div className="ed-sub" style={{ marginTop: 12 }}>{t(UI.ed_brand_exc, lang)}</div>
        <input type="text" className="ed-text" value={draft.brandExclusions[cat].join(", ")}
          onChange={(e) => patch((d) => { d.brandExclusions[cat] = e.target.value.split(",").map((s) => s.trim()).filter(Boolean); })} />
      </section>

      <div className="ed-actions">
        <button type="button" className="btn btn-indigo" onClick={save} disabled={status === "saving"}>
          {status === "saving" ? t(UI.ed_saving, lang) : t(UI.ed_save, lang)}
        </button>
        <button type="button" className="btn btn-ghost" onClick={reset} disabled={status === "saving"}>{t(UI.ed_reset, lang)}</button>
        {status === "saved" && <span className="ed-ok">{t(UI.ed_saved, lang)}</span>}
        {status === "error" && <span className="login-err">{err}</span>}
        {edited && status !== "saved" && <span className="tag-pill" style={{ background: "var(--amber-soft)", color: "var(--amber-deep)" }}>{t(UI.ed_override, lang)}</span>}
      </div>
    </div>
  );
}

function AddBrand({ onAdd }: { onAdd: (b: string) => void }): JSX.Element {
  const [v, setV] = useState("");
  return (
    <div className="ed-addrow">
      <input type="text" placeholder="Add brand…" value={v} onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { onAdd(v.trim()); setV(""); } }} />
      <button type="button" className="btn btn-ghost" onClick={() => { onAdd(v.trim()); setV(""); }}>+ Add</button>
    </div>
  );
}
