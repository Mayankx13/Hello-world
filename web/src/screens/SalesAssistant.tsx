/**
 * Sales Assistant section — the guided welcome→…→summary journey, embedded in
 * the role-based shell. Language and store come from the shell; this component
 * owns only the flow state machine, wake-lock, and session logging.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { getConfig, getQuestionnaire, logSession, upsertCustomer, logCustomerEvent, IS_REMOTE } from "../lib/api";
import type {
  CustomerInfo,
  EngineConfig,
  Lang,
  Questionnaire,
  RecommendRequest,
  RecommendResult,
  SessionLog,
  Store,
} from "../lib/api";
import type { AttachItem, RecommendationCard } from "@engine";
import { UI, t } from "../lib/i18n";
import { initialState } from "../state";
import type { AppState, BandName, Category, Step } from "../state";
import ProgressBar from "../components/ProgressBar";
import Welcome from "./Welcome";
import CategoryScreen from "./Category";
import Profiler from "./Profiler";
import Budget from "./Budget";
import Analysing from "./Analysing";
import Results from "./Results";
import Attach from "./Attach";
import Summary from "./Summary";
import type { Outcome } from "./Summary";

interface ResolvedData {
  questionnaire: Questionnaire;
  config: EngineConfig;
}

const KIOSK_STEPS: ReadonlySet<Step> = new Set<Step>([
  "category", "profiler", "budget", "analysing", "results", "attach",
]);

/** Premiumness from a single bill value (matches the ETL spend bands). */
type PremiumTier = "value" | "mainstream" | "premium" | "luxury";
const TIER_RANK: Record<string, number> = { value: 0, mainstream: 1, premium: 2, luxury: 3 };
function tierFromAmount(amount: number): PremiumTier {
  return amount >= 200000 ? "luxury" : amount >= 100000 ? "premium" : amount >= 40000 ? "mainstream" : "value";
}
/** Never downgrade a customer's known premiumness on a single smaller purchase. */
function bestTier(known: string | null | undefined, derived: PremiumTier): PremiumTier {
  return known && TIER_RANK[known] != null && TIER_RANK[known] >= TIER_RANK[derived] ? (known as PremiumTier) : derived;
}

export default function SalesAssistant({
  lang,
  storeId,
  stores,
}: {
  lang: Lang;
  storeId: string;
  stores: Store[];
}): JSX.Element {
  const [data, setData] = useState<ResolvedData | null>(null);
  const [state, setState] = useState<AppState>({ ...initialState, lang, storeId });
  const [loggedOutcome, setLoggedOutcome] = useState(false);
  // Recalled customer (by phone) — their owned/liked brands tilt the picks.
  const [recalled, setRecalled] = useState<CustomerInfo | null>(null);

  // app-shell data
  useEffect(() => {
    let alive = true;
    Promise.all([getQuestionnaire(), getConfig()])
      .then(([questionnaire, config]) => {
        if (alive) setData({ questionnaire, config });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // keep lang/store in sync with the shell
  useEffect(() => { setState((s) => ({ ...s, lang })); }, [lang]);
  useEffect(() => { setState((s) => ({ ...s, storeId })); }, [storeId]);

  const patch = useCallback((next: Partial<AppState>) => setState((s) => ({ ...s, ...next })), []);
  const restart = useCallback(() => {
    setLoggedOutcome(false);
    setState((s) => ({ ...initialState, lang: s.lang, storeId: s.storeId }));
  }, []);

  // wake-lock during the kiosk flow
  const wakeRef = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    const inKiosk = KIOSK_STEPS.has(state.step);
    async function acquire() {
      try {
        if (inKiosk && !wakeRef.current && navigator.wakeLock?.request) {
          wakeRef.current = await navigator.wakeLock.request("screen");
        }
      } catch { /* unsupported */ }
    }
    async function release() {
      try {
        const s = wakeRef.current;
        wakeRef.current = null;
        await s?.release();
      } catch { /* ignore */ }
    }
    if (inKiosk) void acquire(); else void release();
    return () => { if (!inKiosk) void release(); };
  }, [state.step]);
  useEffect(() => () => { void wakeRef.current?.release().catch(() => {}); wakeRef.current = null; }, []);

  const currentStore = useMemo(() => stores.find((s) => s.id === storeId), [stores, storeId]);

  // profiler selection (option ids)
  const toggleOption = useCallback((optionId: string) => {
    setState((s) => {
      if (!data || !s.category) return s;
      const q = data.questionnaire.categories[s.category].questions[s.qIndex];
      const isMulti = q.kind === "multi";
      const max = q.max ?? 1;
      const opt = q.options.find((o) => o.id === optionId);
      const prev = s.answers[s.qIndex] ?? [];
      let nextSel: string[];
      if (isMulti) {
        if (prev.includes(optionId)) nextSel = prev.filter((id) => id !== optionId);
        else if (prev.length < max || opt?.notSure) nextSel = [...prev, optionId];
        else nextSel = prev;
      } else nextSel = [optionId];
      const answers = s.answers.slice();
      answers[s.qIndex] = nextSel;
      return { ...s, answers };
    });
  }, [data]);

  // flatten option ids -> engine tags
  const flatTags = useMemo(() => {
    if (!data || !state.category) return [];
    const questions = data.questionnaire.categories[state.category].questions;
    const tags: string[] = [];
    questions.forEach((q, qi) => {
      (state.answers[qi] ?? []).forEach((id) => {
        const opt = q.options.find((o) => o.id === id);
        if (opt) tags.push(...opt.tags);
      });
    });
    return tags;
  }, [data, state.category, state.answers]);

  // Brands the recalled customer owns/likes, as engine brand tags (`b:<Brand>`).
  // The engine treats these as preferred brands (tie-break + brandPreferenceWeight),
  // so recall genuinely tailors the picks — not just the welcome card.
  const recalledBrandTags = useMemo(
    () => (recalled ? [...new Set(recalled.prefs.filter((p) => p.affinity !== "avoid").map((p) => `b:${p.brand}`))] : []),
    [recalled],
  );

  const recommendRequest = useMemo<RecommendRequest | null>(() => {
    if (!state.category || !state.budgetBand) return null;
    return {
      storeId: state.storeId,
      category: state.category,
      answers: [...new Set([...flatTags, ...recalledBrandTags])],
      budgetBand: state.budgetBand,
      stretch: state.stretch,
      exchange: state.exchange,
      lang: state.lang,
    };
  }, [state.category, state.budgetBand, state.storeId, state.stretch, state.exchange, state.lang, flatTags, recalledBrandTags]);

  const handleAnalysisComplete = useCallback((result: RecommendResult | null) => {
    setState((s) => ({ ...s, result, step: "results" }));
  }, []);

  const attachItems: AttachItem[] = useMemo(() => {
    const all = state.result?.attach ?? [];
    return state.attach.map((id) => all.find((a) => a.id === id)).filter((a): a is AttachItem => Boolean(a));
  }, [state.result, state.attach]);

  const logOutcome = useCallback((outcome: Outcome) => {
    if (!state.picked || !state.category || !state.budgetBand) return;
    const total = state.picked.price + attachItems.reduce((sum, a) => sum + a.price, 0);
    const r = state.result;
    const shownCards = [r?.good?.sku, r?.better?.sku, r?.best?.sku, r?.stretch?.sku].filter((sku): sku is string => Boolean(sku));
    const log: SessionLog = {
      sessionId: crypto.randomUUID(),
      storeId: state.storeId,
      category: state.category,
      lang: state.lang,
      answers: flatTags,
      budgetBand: state.budgetBand,
      stretch: state.stretch,
      exchange: state.exchange,
      shownCards,
      chosen: { sku: state.picked.sku, tier: state.picked.tier },
      attach: state.attach,
      outcome,
      total,
      itemsPerBill: 1 + attachItems.length,
      ts: new Date().toISOString(),
    };
    void logSession(log);
    // Recall: remember this touchpoint against the phone so the next visit is
    // tailored — but ONLY with the customer's consent (DPDP). The anonymous
    // session log above is always written; PII (phone-keyed) writes are gated.
    if (/^\d{10}$/.test(state.mobile) && state.picked && state.consent) {
      const sold = outcome === "bought_recommended" || outcome === "bought_different";
      const tier = bestTier(recalled?.customer.premium_tier, tierFromAmount(total));
      void upsertCustomer({
        phone: state.mobile, consent: true, home_store_id: state.storeId,
        premium_tier: tier, preferred_payment: state.exchange ? "exchange" : null,
      });
      void logCustomerEvent(state.mobile, {
        type: sold ? "purchase" : "intent",
        category: state.category, brand: state.picked.brand, budget_band: state.budgetBand,
        sku: state.picked.sku, store_id: state.storeId, amount: sold ? total : null,
      });
    }
    setLoggedOutcome(true);
  }, [state, attachItems, flatTags, recalled]);

  if (!data) return <div className="loading">Loading…</div>;

  const qCount = state.category ? data.questionnaire.categories[state.category].questions.length : 0;
  const showProgress = state.step === "profiler" || state.step === "budget";
  const progressTotal = qCount + 1;
  const progressCurrent = state.step === "budget" ? qCount : state.qIndex;

  const onPickCategory = (category: Category) => {
    const n = data.questionnaire.categories[category].questions.length;
    patch({ category, qIndex: 0, answers: Array.from({ length: n }, () => []), budgetBand: null, result: null, picked: null, attach: [], step: "profiler" });
  };
  const profilerBack = () => { if (state.qIndex > 0) patch({ qIndex: state.qIndex - 1 }); else patch({ step: "category" }); };
  const profilerNext = () => { if (state.qIndex < qCount - 1) patch({ qIndex: state.qIndex + 1 }); else patch({ step: "budget" }); };
  const chooseCard = (card: RecommendationCard) => patch({ picked: card, attach: [], step: "attach" });
  const toggleAttach = (id: string) => setState((s) => ({ ...s, attach: s.attach.includes(id) ? s.attach.filter((x) => x !== id) : [...s.attach, id] }));

  let screen: JSX.Element | null = null;
  switch (state.step) {
    case "welcome":
      screen = <Welcome lang={lang} mobile={state.mobile} consent={state.consent} onMobileChange={(mobile) => patch({ mobile })} onConsentChange={(consent) => patch({ consent })} onStart={() => patch({ step: "category" })} onRecall={setRecalled} />;
      break;
    case "category":
      screen = <CategoryScreen lang={lang} questionnaire={data.questionnaire} onPick={onPickCategory} onBack={() => patch({ step: "welcome" })} />;
      break;
    case "profiler":
      if (state.category) {
        const cat = data.questionnaire.categories[state.category];
        screen = <Profiler lang={lang} category={cat} categoryLabel={t(cat.label, lang)} qIndex={state.qIndex} selected={state.answers[state.qIndex] ?? []} onToggle={toggleOption} onBack={profilerBack} onNext={profilerNext} />;
      }
      break;
    case "budget":
      if (state.category) {
        const cat = data.questionnaire.categories[state.category];
        screen = <Budget lang={lang} categoryLabel={t(cat.label, lang)} bands={data.config.priceBands[state.category]} budgetBand={state.budgetBand} stretch={state.stretch} exchange={state.exchange} onPickBand={(band: BandName) => patch({ budgetBand: band })} onSetStretch={(stretch) => patch({ stretch })} onSetExchange={(exchange) => patch({ exchange })} onBack={() => patch({ step: "profiler", qIndex: qCount - 1 })} onSubmit={() => patch({ step: "analysing" })} />;
      }
      break;
    case "analysing":
      if (recommendRequest) screen = <Analysing lang={lang} request={recommendRequest} onComplete={handleAnalysisComplete} />;
      break;
    case "results":
      if (state.result) screen = <Results lang={lang} result={state.result} exchange={state.exchange} onChoose={chooseCard} onAdjustBudget={() => patch({ step: "budget" })} />;
      else screen = <div className="empty"><p>{lang === "hi" ? "अभी सुझाव लोड नहीं हो सके।" : "Couldn't load recommendations."}</p><div className="navrow"><span /><button type="button" className="btn btn-amber" onClick={() => patch({ step: "budget" })}>{t(UI.adjust_budget, lang)} →</button></div></div>;
      break;
    case "attach":
      if (state.picked && state.result) screen = <Attach lang={lang} items={state.result.attach} selected={state.attach} onToggle={toggleAttach} onBack={() => patch({ step: "results" })} onContinue={() => patch({ step: "summary" })} />;
      break;
    case "summary":
      if (state.picked) screen = <Summary lang={lang} picked={state.picked} attachItems={attachItems} exchange={state.exchange} logged={loggedOutcome} onLogOutcome={logOutcome} onBack={() => patch({ step: "attach" })} onRestart={restart} />;
      break;
  }

  return (
    <div className="assistant-wrap" lang={lang}>
      <div className="assistant-bar">
        {!IS_REMOTE && <span className="offline-chip" style={{ marginRight: "auto" }}>{t(UI.offline_badge, lang)}</span>}
        <button type="button" className="restart" onClick={restart}>{t(UI.start_over, lang)}</button>
      </div>
      {showProgress && <ProgressBar total={progressTotal} current={progressCurrent} label={t(UI.results_eyebrow, lang)} />}
      <div className="stage">{screen}</div>
      <div className="footer-note">
        LIQO · {currentStore?.label ?? ""} · {data.questionnaire.version} — {lang === "hi" ? "सुझाव इन-स्टॉक मॉडलों पर आधारित हैं" : "recommendations reflect in-stock models"}
      </div>
    </div>
  );
}
