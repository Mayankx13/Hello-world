/** Admin editor for the questionnaire — add/edit/remove questions, options & tags, live. */
import { useEffect, useState } from "react";
import type { JSX } from "react";
import {
  getQuestionnaire,
  saveQuestionnaireLive,
  resetQuestionnaireLive,
  hasQuestionnaireOverride,
} from "../lib/api";
import type { Lang, Loc, Questionnaire, QQuestion, QOption } from "../lib/api";
import { UI, t } from "../lib/i18n";

const CAT_ORDER: { id: string; label: string }[] = [
  { id: "ac", label: "AC" },
  { id: "tv", label: "TV" },
  { id: "fridge", label: "Fridge" },
  { id: "wm", label: "Washing" },
];
const GATES: QQuestion["gate"][] = ["capacity", "form", "feature", "eco", "modifier", "brand"];
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const emptyLoc: Loc = { en: "", hi: "" };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "tag";

export default function QuestionnaireEditor({ lang, token, onChanged }: { lang: Lang; token: string | null; onChanged?: () => void }): JSX.Element {
  const [draft, setDraft] = useState<Questionnaire | null>(null);
  const [cat, setCat] = useState<string>("ac");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [edited, setEdited] = useState(false);

  useEffect(() => { getQuestionnaire().then((q) => { setDraft(clone(q)); setEdited(hasQuestionnaireOverride()); }); }, []);

  if (!draft) return <div className="loading">…</div>;
  const cats = Object.keys(draft.categories);
  const activeCat = draft.categories[cat] ? cat : cats[0];
  const questions = draft.categories[activeCat]?.questions ?? [];

  const patch = (fn: (q: Questionnaire) => void) => { setDraft((d) => { const n = clone(d!); fn(n); return n; }); setStatus("idle"); };

  async function save() {
    if (!draft) return;
    setStatus("saving"); setErr(null);
    try {
      await saveQuestionnaireLive(draft, token);
      setStatus("saved"); setEdited(true); onChanged?.();
    } catch (e) { setErr((e as Error).message); setStatus("error"); }
  }
  async function reset() {
    setStatus("saving");
    try { await resetQuestionnaireLive(token); const q = await getQuestionnaire(); setDraft(clone(q)); setEdited(false); setStatus("idle"); onChanged?.(); }
    catch (e) { setErr((e as Error).message); setStatus("error"); }
  }

  const setQ = (qi: number, fn: (q: QQuestion) => void) => patch((d) => fn(d.categories[activeCat].questions[qi]));
  const setO = (qi: number, oi: number, fn: (o: QOption) => void) => patch((d) => fn(d.categories[activeCat].questions[qi].options[oi]));

  function addQuestion() {
    patch((d) => {
      const qs = d.categories[activeCat].questions;
      qs.push({
        id: `q_${qs.length + 1}_${Math.round(draft!.version.length * 7 + qs.length)}`,
        gate: "feature", kind: "single",
        prompt: clone(emptyLoc),
        options: [{ id: "opt_1", label: clone(emptyLoc), tags: [] }],
      });
    });
  }

  return (
    <div className="editor">
      <div className="ed-cattabs">
        {CAT_ORDER.filter((c) => cats.includes(c.id)).map((c) => (
          <button key={c.id} type="button" className={`lb-tab${activeCat === c.id ? " on" : ""}`} onClick={() => setCat(c.id)}>
            {t(draft.categories[c.id]?.label, lang) || c.label}
          </button>
        ))}
      </div>

      {questions.map((q, qi) => (
        <section className="ed-card" key={q.id}>
          <div className="ed-qhead">
            <span className="ed-gate">{q.gate}</span>
            <select className="ed-kindsel" value={q.kind} onChange={(e) => setQ(qi, (x) => { x.kind = e.target.value as "single" | "multi"; })}>
              <option value="single">{t(UI.q_single, lang)}</option>
              <option value="multi">{t(UI.q_multi, lang)}</option>
            </select>
            <select className="ed-kindsel" aria-label="gate" value={q.gate} onChange={(e) => setQ(qi, (x) => { x.gate = e.target.value as QQuestion["gate"]; })}>
              {GATES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            {q.kind === "multi" && (
              <label className="ed-maxinl">{t(UI.q_max, lang)}
                <input type="number" min={1} value={q.max ?? 2} onChange={(e) => setQ(qi, (x) => { x.max = Number(e.target.value); })} />
              </label>
            )}
            <button type="button" className="ed-del" onClick={() => patch((d) => { d.categories[activeCat].questions.splice(qi, 1); })}>{t(UI.q_del, lang)}</button>
          </div>

          <label className="ed-field"><span>{t(UI.q_prompt, lang)} · EN</span>
            <input type="text" value={q.prompt.en} onChange={(e) => setQ(qi, (x) => { x.prompt.en = e.target.value; })} />
          </label>
          <label className="ed-field"><span>{t(UI.q_prompt, lang)} · हिं</span>
            <input type="text" value={q.prompt.hi} onChange={(e) => setQ(qi, (x) => { x.prompt.hi = e.target.value; })} />
          </label>

          <div className="ed-sub" style={{ marginTop: 10 }}>{t(UI.q_option, lang)}s</div>
          <table className="ed-opts">
            <thead><tr><th>EN</th><th>हिं</th><th>{t(UI.q_tags, lang)}</th><th /></tr></thead>
            <tbody>
              {q.options.map((o, oi) => (
                <tr key={o.id}>
                  <td><input type="text" value={o.label.en} onChange={(e) => setO(qi, oi, (x) => { x.label.en = e.target.value; })} /></td>
                  <td><input type="text" value={o.label.hi} onChange={(e) => setO(qi, oi, (x) => { x.label.hi = e.target.value; })} /></td>
                  <td><input type="text" className="ed-tagcell" value={o.tags.join(", ")}
                    onChange={(e) => setO(qi, oi, (x) => { x.tags = e.target.value.split(",").map((s) => slug(s.trim())).filter(Boolean); })} /></td>
                  <td><button type="button" className="ed-x" aria-label="remove option" disabled={q.options.length <= 1}
                    onClick={() => setQ(qi, (x) => { x.options.splice(oi, 1); })}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQ(qi, (x) => { x.options.push({ id: `opt_${x.options.length + 1}`, label: clone(emptyLoc), tags: [] }); })}>
            {t(UI.q_add_opt, lang)}
          </button>
        </section>
      ))}

      <button type="button" className="btn btn-ghost" onClick={addQuestion}>{t(UI.q_add_q, lang)}</button>

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
