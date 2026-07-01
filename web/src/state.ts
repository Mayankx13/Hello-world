/** App-wide state machine types, shared by App.tsx and the screens. */
import type { RecommendResult } from "./lib/api";
import type { Lang } from "./lib/api";
import type { RecommendationCard } from "@engine";

/** Engine category id (matches RecommendRequest.category). */
export type Category = "ac" | "tv" | "fridge" | "wm";
/** Budget band tier (matches RecommendRequest.budgetBand). */
export type BandName = "good" | "better" | "best";

export type Step =
  | "welcome"
  | "category"
  | "profiler"
  | "budget"
  | "analysing"
  | "results"
  | "attach"
  | "summary";

export interface AppState {
  step: Step;
  lang: Lang;
  storeId: string;
  mobile: string;
  consent: boolean;
  category: Category | null;
  /** 0-based index of the current profiler question. */
  qIndex: number;
  /** Per-question selected option ids (used to restore chip selection). */
  answers: string[][];
  budgetBand: BandName | null;
  stretch: boolean;
  exchange: boolean;
  result: RecommendResult | null;
  picked: RecommendationCard | null;
  /** Selected attach-item ids. */
  attach: string[];
}

export const initialState: AppState = {
  step: "welcome",
  lang: "en",
  storeId: "",
  mobile: "",
  consent: false,
  category: null,
  qIndex: 0,
  answers: [],
  budgetBand: null,
  // Default ON so the guided flow shows the SAME full ladder as the admin Engine
  // Test — including the premium "worth the stretch" card and the wider price
  // ceiling. The customer can still say "No" on the Budget screen.
  stretch: true,
  exchange: false,
  result: null,
  picked: null,
  attach: [],
};
