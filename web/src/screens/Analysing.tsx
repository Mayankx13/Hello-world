/**
 * Analysing interstitial. Fires the recommendation request on mount and, once
 * both the result and a short minimum delay (skipped under reduced-motion) are
 * ready, hands the result back so App can advance to Results. A failed request
 * resolves to null so Results can show its friendly empty state.
 */
import { useEffect, useRef } from "react";
import type { JSX } from "react";
import { postRecommend } from "../lib/api";
import type { Lang, RecommendRequest, RecommendResult } from "../lib/api";
import { UI, t } from "../lib/i18n";
import { SpinnerFan } from "../components/Icons";

export interface AnalysingProps {
  lang: Lang;
  request: RecommendRequest;
  onComplete: (result: RecommendResult | null) => void;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function Analysing({ lang, request, onComplete }: AnalysingProps): JSX.Element {
  // Run the request + timed advance exactly once. We guard completion with a
  // ref (rather than cancelling on cleanup) so neither a live language toggle
  // mid-spinner nor StrictMode's mount/unmount/mount can strand the spinner.
  const started = useRef(false);
  const done = useRef(false);
  const requestRef = useRef(request);
  requestRef.current = request;
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const delay = prefersReducedMotion() ? 0 : 1200;
    const startedAt = Date.now();

    postRecommend(requestRef.current)
      .catch(() => null)
      .then((result) => {
        const wait = Math.max(0, delay - (Date.now() - startedAt));
        window.setTimeout(() => {
          if (done.current) return; // advance only once
          done.current = true;
          completeRef.current(result);
        }, wait);
      });
  }, []);

  return (
    <div className="analyse" role="status" aria-live="polite">
      <div className="fan">
        <SpinnerFan />
      </div>
      <h2>{t(UI.analysing, lang)}</h2>
      <p className="hint">{t(UI.analysing_sub, lang)}</p>
    </div>
  );
}
