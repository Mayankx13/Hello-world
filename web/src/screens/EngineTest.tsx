/** Admin engine-testing console — run the recommendation model with any inputs
 *  and inspect the ranked cards, internal scores, eligible set and fit gates. */
import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { engineTest, getQuestionnaire, getStores } from "../lib/api";
import type { EngineTestResult, Lang, Questionnaire, RecommendRequest, Store } from "../lib/api";
import { UI, t } from "../lib/i18n";

const CATS: { id: "ac" | "tv" | "fridge" | "wm"; label: string }[] = [
  { id: "ac", label: "AC" }, { id: "tv", label: "TV" }, { id: "fridge", label: "Fridge" }, { id: "wm", label: "Washing" },
];
const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

export default function EngineTest({ lang, token }: { lang: Lang; token: string | null }): JSX.Element {
  const [stores, setStores] = useState<Store[]>([]);
  const [q, setQ] = useState<Questionnaire | null>(null);
  const [storeId, setStoreId] = useState("");
  const [cat, setCat] = useState<"ac" | "tv" | "fridge" | "wm">("ac");
  const [budgetBand, setBudgetBand] = useState<"good" | "better" | "best">("better");
  const [stretch, setStretch] = useState(true);
  const [exchange, setExchange] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [res, setRes] = useState<EngineTestResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getStores().then((s) => { setStores(s); setStoreId((cur) => cur || s[0]?.id || ""); }).catch(() => {});
    getQuestionnaire().then(setQ).catch(() => {});
  }, []);

  const questions = useMemo(() => q?.categories[cat]?.questions ?? [], [q, cat]);
  const toggle = (tag: string) => setPicked((p) => { const n = new Set(p); n.has(tag) ? n.delete(tag) : n.add(tag); return n; });

  async function run() {
    if (!storeId) { setErr("Pick a store"); return; }
    setBusy(true); setErr(null);
    const req: RecommendRequest = { storeId, category: cat, answers: [...picked], budgetBand, stretch, exchange, lang };
    try { setRes(await engineTest(req, token)); }
    catch (e) { setErr((e as Error).message); setRes(null); }
    finally { setBusy(false); }
  }

  const cards = res ? [res.result.good, res.result.better, res.result.best, res.result.stretch].filter(Boolean) : [];

  return (
    <div className="content-narrow" lang={lang}>
      <div className="page-head">
        <h1>{t(UI.et_title, lang)}</h1>
        <p>{t(UI.et_sub, lang)}</p>
      </div>

      <section className="et-controls">
        <div className="et-row">
          <label className="et-field"><span>{t(UI.lb_store, lang)}</span>
            <select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="et-field"><span>{t(UI.et_budget, lang)}</span>
            <select value={budgetBand} onChange={(e) => setBudgetBand(e.target.value as "good" | "better" | "best")}>
              <option value="good">{t(UI.good, lang)}</option>
              <option value="better">{t(UI.better, lang)}</option>
              <option value="best">{t(UI.best, lang)}</option>
            </select>
          </label>
          <label className="et-check"><input type="checkbox" checked={stretch} onChange={(e) => setStretch(e.target.checked)} /> {t(UI.et_stretch, lang)}</label>
          <label className="et-check"><input type="checkbox" checked={exchange} onChange={(e) => setExchange(e.target.checked)} /> {t(UI.et_exchange, lang)}</label>
        </div>

        <div className="ed-cattabs">
          {CATS.map((c) => <button key={c.id} type="button" className={`lb-tab${cat === c.id ? " on" : ""}`} onClick={() => { setCat(c.id); setPicked(new Set()); setRes(null); }}>{c.label}</button>)}
        </div>

        <div className="et-questions">
          {questions.map((qq) => (
            <div className="et-q" key={qq.id}>
              <div className="et-q-prompt">{t(qq.prompt, lang)} <span className="et-gate">{qq.gate}</span></div>
              <div className="et-chips">
                {qq.options.map((o) => {
                  const on = o.tags.some((tg) => picked.has(tg));
                  return <button key={o.id} type="button" className={`et-chip${on ? " on" : ""}`}
                    onClick={() => o.tags.forEach(toggle)}>{t(o.label, lang)}</button>;
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="et-actions">
          <button type="button" className="btn btn-amber" onClick={run} disabled={busy}>{busy ? t(UI.analysing, lang) : t(UI.et_run, lang)}</button>
          {picked.size > 0 && <span className="et-tags">tags: {[...picked].join(", ")}</span>}
          {err && <span className="login-err">{err}</span>}
        </div>
      </section>

      {res && (
        <section className="et-results">
          <div className="et-meta">
            <span className="et-pill"><b>{res.eligibleCount}</b> {t(UI.et_eligible, lang)}</span>
            <span className="et-pill">{t(UI.et_band, lang)}: {inr(res.meta.bandRange[0])}–{inr(res.meta.bandRange[1])}</span>
            {res.meta.requiredCapacityClass != null && <span className="et-pill">cap≥ {res.meta.requiredCapacityClass}</span>}
            {res.meta.requiredForms.length > 0 && <span className="et-pill">forms: {res.meta.requiredForms.join(",")}</span>}
            {res.meta.fallbackUsed && <span className="et-pill warn">fallback: {res.meta.fallbackUsed}</span>}
            {res.boostsApplied > 0 && <span className="et-pill boost">⚡ {res.boostsApplied} {t(UI.et_boosts, lang)}</span>}
          </div>

          {cards.length === 0 ? <p className="et-empty">{t(UI.et_none, lang)}</p> : (
            <div className="et-cards">
              {cards.map((c) => c && (
                <div key={c.tier} className={`et-card${c.tier === "stretch" ? " stretch" : ""}`}>
                  <div className="et-tier">{c.tier.toUpperCase()}</div>
                  <div className="et-name">{c.brand} {c.model}</div>
                  <div className="et-price">{inr(c.price)} <small className="et-score">score {c._score.toFixed(3)}</small></div>
                  <div className="et-fit">{c.fitLine}</div>
                  <ul className="et-pros">{c.pros.map((p, i) => <li key={i}>{p}</li>)}</ul>
                  {c.con && <div className="et-con">– {c.con}</div>}
                  <div className="et-stock">stock {c.stockQty} · {c.sku}</div>
                </div>
              ))}
            </div>
          )}

          <h3 className="et-h">{t(UI.et_scores, lang)}</h3>
          <div className="tbl-scroll">
            <table className="lb-table">
              <thead><tr><th>{t(UI.et_tier, lang)}</th><th>SKU</th><th>{t(UI.lb_rep, lang).slice(0,0)}Brand</th><th>{t(UI.et_price, lang)}</th><th>{t(UI.et_score, lang)}</th></tr></thead>
              <tbody>
                {res.scores.map((s) => (
                  <tr key={s.tier + s.sku}>
                    <td><span className="tag-pill">{s.tier}</span></td>
                    <td style={{ fontFamily: "monospace", fontSize: 12.5 }}>{s.sku}</td>
                    <td>{s.brand}</td>
                    <td>{inr(s.price)}</td>
                    <td className="pts-cell"><b>{s._score.toFixed(4)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
