/**
 * LIQO Sales Assistant — root component. Owns the welcome→…→summary state
 * machine, the top bar (wordmark, language toggle, store pill + picker, Start
 * over), the progress bar, app-shell data loading, and a best-effort screen
 * wake-lock for kiosk use. Screens are pure and data-driven.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import {
  getConfig,
  getQuestionnaire,
  getStores,
  logSession,
  IS_REMOTE,
} from "./lib/api";
import type {
  EngineConfig,
  Questionnaire,
  RecommendRequest,
  RecommendResult,
  SessionLog,
  Store,
} from "./lib/api";
import type { AttachItem, RecommendationCard } from "@engine";
import { UI, t } from "./lib/i18n";
import { initialState } from "./state";
import type { AppState, BandName, Category, Step } from "./state";
import ProgressBar from "./components/ProgressBar";
import Welcome from "./screens/Welcome";
import CategoryScreen from "./screens/Category";
import Profiler from "./screens/Profiler";
import Budget from "./screens/Budget";
import Analysing from "./screens/Analysing";
import Results from "./screens/Results";
import Attach from "./screens/Attach";
import Summary from "./screens/Summary";
import type { Outcome } from "./screens/Summary";

interface ResolvedData {
  questionnaire: Questionnaire;
  stores: Store[];
  config: EngineConfig;
}

/** First pilot store, else the first store in the list. */
function defaultStoreId(stores: Store[]): string {
  return (stores.find((s) => s.pilot) ?? stores[0])?.id ?? "";
}

const KIOSK_STEPS: ReadonlySet<Step> = new Set<Step>([
  "category",
  "profiler",
  "budget",
  "analysing",
  "results",
  "attach",
]);

export default function App(): JSX.Element {
  const [data, setData] = useState<ResolvedData | null>(null);
  const [state, setState] = useState<AppState>(initialState);
  const [pickingStore, setPickingStore] = useState(false);
  const [loggedOutcome, setLoggedOutcome] = useState(false);

  // ---- app-shell data load ----
  useEffect(() => {
    let alive = true;
    Promise.all([getQuestionnaire(), getStores(), getConfig()])
      .then(([questionnaire, stores, config]) => {
        if (!alive) return;
        setData({ questionnaire, stores, config });
        setState((s) => ({
          ...s,
          lang: questionnaire.default,
          storeId: defaultStoreId(stores),
        }));
      })
      .catch(() => {
        /* loading view stays; nothing else to do at the edge */
      });
    return () => {
      alive = false;
    };
  }, []);

  const patch = useCallback((next: Partial<AppState>) => {
    setState((s) => ({ ...s, ...next }));
  }, []);

  const restart = useCallback(() => {
    setLoggedOutcome(false);
    setPickingStore(false);
    setState((s) => ({
      ...initialState,
      // keep operator-level context across customers
      lang: s.lang,
      storeId: s.storeId,
    }));
  }, []);

  const toggleLang = useCallback(() => {
    setState((s) => ({ ...s, lang: s.lang === "en" ? "hi" : "en" }));
  }, []);

  // ---- best-effort screen wake-lock during the kiosk flow ----
  const wakeRef = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    const inKiosk = KIOSK_STEPS.has(state.step);
    let released = false;

    async function acquire() {
      try {
        if (inKiosk && !wakeRef.current && navigator.wakeLock?.request) {
          wakeRef.current = await navigator.wakeLock.request("screen");
        }
      } catch {
        /* not supported / denied — non-fatal */
      }
    }
    async function release() {
      try {
        if (wakeRef.current) {
          const sentinel = wakeRef.current;
          wakeRef.current = null;
          await sentinel.release();
        }
      } catch {
        /* ignore */
      }
    }

    if (inKiosk) void acquire();
    else void release();

    return () => {
      if (!inKiosk && !released) {
        released = true;
        void release();
      }
    };
  }, [state.step]);

  // release the lock entirely on unmount
  useEffect(() => {
    return () => {
      void wakeRef.current?.release().catch(() => {});
      wakeRef.current = null;
    };
  }, []);

  const lang = state.lang;
  const stores = data?.stores ?? [];
  const currentStore = useMemo(
    () => stores.find((s) => s.id === state.storeId) ?? stores[0],
    [stores, state.storeId],
  );

  // ---- progress (profiler + budget only) ----
  const qCount =
    data && state.category ? data.questionnaire.categories[state.category].questions.length : 0;
  const showProgress = state.step === "profiler" || state.step === "budget";
  const progressTotal = qCount + 1;
  const progressCurrent = state.step === "budget" ? qCount : state.qIndex;

  // ---- profiler answer helpers (selection stored as option ids) ----
  const toggleOption = useCallback(
    (optionId: string) => {
      setState((s) => {
        if (!data || !s.category) return s;
        const q = data.questionnaire.categories[s.category].questions[s.qIndex];
        const isMulti = q.kind === "multi";
        const max = q.max ?? 1;
        const opt = q.options.find((o) => o.id === optionId);
        const prev = s.answers[s.qIndex] ?? [];
        let nextSel: string[];
        if (isMulti) {
          if (prev.includes(optionId)) {
            nextSel = prev.filter((id) => id !== optionId);
          } else if (prev.length < max || opt?.notSure) {
            nextSel = [...prev, optionId];
          } else {
            nextSel = prev;
          }
        } else {
          nextSel = [optionId];
        }
        const answers = s.answers.slice();
        answers[s.qIndex] = nextSel;
        return { ...s, answers };
      });
    },
    [data],
  );

  // ---- flatten selected option ids -> engine tags ----
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

  const recommendRequest = useMemo<RecommendRequest | null>(() => {
    if (!state.category || !state.budgetBand) return null;
    return {
      storeId: state.storeId,
      category: state.category,
      answers: flatTags,
      budgetBand: state.budgetBand,
      stretch: state.stretch,
      exchange: state.exchange,
      lang,
    };
  }, [
    state.category,
    state.budgetBand,
    state.storeId,
    state.stretch,
    state.exchange,
    flatTags,
    lang,
  ]);

  const handleAnalysisComplete = useCallback((result: RecommendResult | null) => {
    setState((s) => ({ ...s, result, step: "results" }));
  }, []);

  // ---- attach lookup + outcome logging ----
  const attachItems: AttachItem[] = useMemo(() => {
    const all = state.result?.attach ?? [];
    return state.attach
      .map((id) => all.find((a) => a.id === id))
      .filter((a): a is AttachItem => Boolean(a));
  }, [state.result, state.attach]);

  const logOutcome = useCallback(
    (outcome: Outcome) => {
      if (!state.picked || !state.category || !state.budgetBand) return;
      const total = state.picked.price + attachItems.reduce((sum, a) => sum + a.price, 0);
      const r = state.result;
      const shownCards = [r?.good?.sku, r?.better?.sku, r?.best?.sku, r?.stretch?.sku].filter(
        (sku): sku is string => Boolean(sku),
      );
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
      setLoggedOutcome(true);
    },
    [state, attachItems, flatTags],
  );

  // ---- render ----
  if (!data || !currentStore) {
    return (
      <div className="app" lang={lang}>
        <div className="loading">Loading…</div>
      </div>
    );
  }

  const onPickCategory = (category: Category) => {
    const n = data.questionnaire.categories[category].questions.length;
    patch({
      category,
      qIndex: 0,
      answers: Array.from({ length: n }, () => []),
      budgetBand: null,
      result: null,
      picked: null,
      attach: [],
      step: "profiler",
    });
  };

  const profilerBack = () => {
    if (state.qIndex > 0) patch({ qIndex: state.qIndex - 1 });
    else patch({ step: "category" });
  };
  const profilerNext = () => {
    if (state.qIndex < qCount - 1) patch({ qIndex: state.qIndex + 1 });
    else patch({ step: "budget" });
  };

  const chooseCard = (card: RecommendationCard) => {
    patch({ picked: card, attach: [], step: "attach" });
  };

  const toggleAttach = (id: string) => {
    setState((s) => ({
      ...s,
      attach: s.attach.includes(id)
        ? s.attach.filter((x) => x !== id)
        : [...s.attach, id],
    }));
  };

  let screen: JSX.Element | null = null;
  switch (state.step) {
    case "welcome":
      screen = (
        <Welcome
          lang={lang}
          mobile={state.mobile}
          onMobileChange={(mobile) => patch({ mobile })}
          onStart={() => patch({ step: "category" })}
        />
      );
      break;
    case "category":
      screen = (
        <CategoryScreen
          lang={lang}
          questionnaire={data.questionnaire}
          onPick={onPickCategory}
          onBack={() => patch({ step: "welcome" })}
        />
      );
      break;
    case "profiler":
      if (state.category) {
        const cat = data.questionnaire.categories[state.category];
        screen = (
          <Profiler
            lang={lang}
            category={cat}
            categoryLabel={t(cat.label, lang)}
            qIndex={state.qIndex}
            selected={state.answers[state.qIndex] ?? []}
            onToggle={toggleOption}
            onBack={profilerBack}
            onNext={profilerNext}
          />
        );
      }
      break;
    case "budget":
      if (state.category) {
        const cat = data.questionnaire.categories[state.category];
        screen = (
          <Budget
            lang={lang}
            categoryLabel={t(cat.label, lang)}
            bands={data.config.priceBands[state.category]}
            budgetBand={state.budgetBand}
            stretch={state.stretch}
            exchange={state.exchange}
            onPickBand={(band: BandName) => patch({ budgetBand: band })}
            onSetStretch={(stretch) => patch({ stretch })}
            onSetExchange={(exchange) => patch({ exchange })}
            onBack={() => patch({ step: "profiler", qIndex: qCount - 1 })}
            onSubmit={() => patch({ step: "analysing" })}
          />
        );
      }
      break;
    case "analysing":
      if (recommendRequest) {
        screen = (
          <Analysing lang={lang} request={recommendRequest} onComplete={handleAnalysisComplete} />
        );
      }
      break;
    case "results":
      if (state.result) {
        screen = (
          <Results
            lang={lang}
            result={state.result}
            exchange={state.exchange}
            onChoose={chooseCard}
            onAdjustBudget={() => patch({ step: "budget" })}
          />
        );
      } else {
        // recommendation failed entirely — offer a path back to budget
        screen = (
          <div className="empty">
            <p>
              {lang === "hi"
                ? "अभी सुझाव लोड नहीं हो सके। कृपया दोबारा प्रयास करें।"
                : "Couldn't load recommendations. Please try again."}
            </p>
            <div className="navrow">
              <span />
              <button type="button" className="btn btn-amber" onClick={() => patch({ step: "budget" })}>
                {t(UI.adjust_budget, lang)} →
              </button>
            </div>
          </div>
        );
      }
      break;
    case "attach":
      if (state.picked && state.result) {
        screen = (
          <Attach
            lang={lang}
            items={state.result.attach}
            selected={state.attach}
            onToggle={toggleAttach}
            onBack={() => patch({ step: "results" })}
            onContinue={() => patch({ step: "summary" })}
          />
        );
      }
      break;
    case "summary":
      if (state.picked) {
        screen = (
          <Summary
            lang={lang}
            picked={state.picked}
            attachItems={attachItems}
            exchange={state.exchange}
            logged={loggedOutcome}
            onLogOutcome={logOutcome}
            onBack={() => patch({ step: "attach" })}
            onRestart={restart}
          />
        );
      }
      break;
  }

  return (
    <div className="app" lang={lang}>
      <header className="bar">
        <div className="wordmark">
          <span>
            LIQO<span className="dot" />
          </span>
          <small>{t(UI.brand_sub, lang)}</small>
        </div>
        <div className="bar-right">
          {!IS_REMOTE && <span className="offline-chip">{t(UI.offline_badge, lang)}</span>}
          <button
            type="button"
            className="lang"
            aria-pressed={lang === "hi"}
            aria-label={lang === "en" ? "Switch to Hindi" : "अंग्रेज़ी में बदलें"}
            onClick={toggleLang}
          >
            {lang === "en" ? (
              <>
                <b>EN</b> | हिं
              </>
            ) : (
              <>
                EN | <b>हिं</b>
              </>
            )}
          </button>
          <span className="store-pill">
            <span className="pin" aria-hidden="true">
              ◉
            </span>
            <span>
              {t(UI.store_label, lang)}: {currentStore.label}
            </span>
            <button
              type="button"
              onClick={() => setPickingStore((v) => !v)}
              aria-expanded={pickingStore}
            >
              {t(UI.change_store, lang)}
            </button>
          </span>
          <button type="button" className="restart" onClick={restart}>
            {t(UI.start_over, lang)}
          </button>
        </div>
      </header>

      {showProgress && (
        <ProgressBar
          total={progressTotal}
          current={progressCurrent}
          label={t(UI.results_eyebrow, lang)}
        />
      )}

      <main className="stage">
        {pickingStore ? (
          <section aria-label={t(UI.store_label, lang)}>
            <div className="eyebrow">{t(UI.change_store, lang)}</div>
            <h2>{t(UI.store_label, lang)}</h2>
            <div className="store-grid">
              {stores.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`chip${s.id === state.storeId ? " sel" : ""}`}
                  aria-pressed={s.id === state.storeId}
                  onClick={() => {
                    patch({ storeId: s.id });
                    setPickingStore(false);
                  }}
                >
                  {s.label}
                  {s.pilot ? <small>{lang === "hi" ? "पायलट स्टोर" : "Pilot store"}</small> : null}
                </button>
              ))}
            </div>
            <div className="navrow">
              <button type="button" className="btn btn-ghost" onClick={() => setPickingStore(false)}>
                ← {t(UI.back, lang)}
              </button>
              <span />
            </div>
          </section>
        ) : (
          screen
        )}
      </main>

      <div className="footer-note">
        LIQO · {currentStore.label} · {data.questionnaire.version} —{" "}
        {lang === "hi"
          ? "सुझाव इन-स्टॉक मॉडलों पर आधारित हैं"
          : "recommendations reflect in-stock models"}
      </div>
    </div>
  );
}
