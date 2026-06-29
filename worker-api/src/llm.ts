/**
 * LIQO rationale LLM (Phase 5) — the deterministic engine still RANKS; the LLM
 * only AUTHORS the "why this fits you" line, and only from the engine's matched
 * fit reasons. It can never invent specs, change the ranking, or pick products.
 *
 * Gated by env (LLM_RATIONALE="on" + ANTHROPIC_API_KEY). Any failure, timeout or
 * malformed reply falls back to the deterministic fitLine — the journey never
 * breaks and never blocks on the model.
 */
import Anthropic from "@anthropic-ai/sdk";

export interface ExplainCard {
  tier: string;        // good | better | best | stretch
  brand: string;
  model: string;
  category: string;    // ac | tv | fridge | wm
  price: number;
  /** Human fit reasons derived by the engine — the ONLY facts the LLM may use. */
  fitReasons: string[];
  /** Deterministic line used as the fallback. */
  fitLine: string;
}

export interface ExplainInput {
  cards: ExplainCard[];
  answers: string[];
  lang: "en" | "hi";
}

export interface LlmEnv {
  ANTHROPIC_API_KEY?: string;
  LLM_MODEL?: string;
  LLM_RATIONALE?: string; // "on" to enable
}

const DEFAULT_MODEL = "claude-haiku-4-5";
const TIMEOUT_MS = 4000;

export function llmEnabled(env: LlmEnv): boolean {
  return env.LLM_RATIONALE === "on" && !!env.ANTHROPIC_API_KEY;
}

function systemPrompt(lang: "en" | "hi"): string {
  const language = lang === "hi" ? "Hindi (Devanagari)" : "English";
  return [
    "You are LIQO's in-store sales copywriter for a North-India electronics retailer (AC, TV, refrigerator, washing machine).",
    "For each product card you are given, write ONE warm, honest sentence telling the shopper why this model fits THEIR stated needs.",
    "STRICT RULES:",
    "- Use ONLY the facts listed in that card's `fitReasons`. Never invent or imply capacities, star ratings, features, prices, or comparative claims.",
    "- Max 22 words. No hype words you can't justify from fitReasons. No emojis.",
    `- Write in ${language}. Address the shopper directly ("you" / "आपके").`,
    "- If a card has no fitReasons, give a neutral one-liner about it being a solid in-stock pick.",
    'Return ONLY compact JSON: an object mapping each card\'s `tier` to its sentence. No markdown, no preamble.',
  ].join("\n");
}

function extractJson(text: string): string {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  return a >= 0 && b > a ? text.slice(a, b + 1) : "{}";
}

function clampLine(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > 180 ? t.slice(0, 177) + "…" : t;
}

/**
 * Returns a map of tier -> rationale. Always returns a usable line for every
 * input card (LLM-authored when enabled and successful, deterministic otherwise).
 */
export async function authorRationales(env: LlmEnv, input: ExplainInput): Promise<Record<string, string>> {
  const fallback: Record<string, string> = {};
  for (const c of input.cards) fallback[c.tier] = c.fitLine;
  if (!llmEnabled(env) || input.cards.length === 0) return fallback;

  try {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const userPayload = {
      lang: input.lang,
      cards: input.cards.map((c) => ({
        tier: c.tier,
        product: `${c.brand} ${c.model}`.trim(),
        category: c.category,
        fitReasons: c.fitReasons,
      })),
    };
    const resp = await client.messages.create(
      {
        model: env.LLM_MODEL || DEFAULT_MODEL,
        max_tokens: 400,
        temperature: 0.4,
        system: systemPrompt(input.lang),
        messages: [{ role: "user", content: JSON.stringify(userPayload) }],
      },
      { timeout: TIMEOUT_MS },
    );
    const text = resp.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
    const parsed = JSON.parse(extractJson(text)) as Record<string, unknown>;
    const out: Record<string, string> = { ...fallback };
    for (const c of input.cards) {
      const line = parsed[c.tier];
      if (typeof line === "string" && line.trim()) out[c.tier] = clampLine(line);
    }
    return out;
  } catch {
    return fallback; // never break the journey on an LLM error
  }
}

// ---------------------------------------------------------------------------
// Phase D.3 — LLM-suggested questionnaire improvements.
// Analyses aggregate session stats + the current questionnaire and proposes
// concrete question/option changes that help the shopper make an EDUCATED
// purchase. Admin reviews + approves in the questionnaire editor; nothing is
// applied automatically. Returns [] when the LLM is disabled or fails.
// ---------------------------------------------------------------------------
export interface QuestionStat {
  category: string;
  sessions: number;
  boughtRate: number;  // 0..1 closed-sale rate
  dropRate: number;    // 0..1 sessions with no pick
  topTags: { tag: string; count: number }[];
}
export interface SuggestInput {
  questionnaire: unknown;
  stats: QuestionStat[];
  lang: "en" | "hi";
}
export interface QuestionSuggestion {
  category: string;
  action: "add" | "reword" | "improve_options";
  questionId?: string;
  prompt: { en: string; hi: string };
  options: { label: { en: string; hi: string }; tags: string[] }[];
  rationale: string;
}

export async function suggestQuestions(env: LlmEnv, input: SuggestInput): Promise<QuestionSuggestion[]> {
  if (!llmEnabled(env)) return [];
  try {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const system = [
      "You are LIQO's in-store questionnaire designer for a North-India electronics retailer (AC, TV, refrigerator, washing machine).",
      "GOAL: help the SHOPPER make an educated purchase. Good questions surface the few attributes that actually change which model fits — room size & sun exposure (AC), family size & usage (fridge/washer), viewing distance & light (TV), and honest budget — in plain, warm language.",
      "You are given the current questionnaire (with each option's engine tags) and aggregate session stats (which categories convert vs drop off, and the most-picked answer tags).",
      "Propose AT MOST 4 concrete, high-value improvements: a new question, a reworded prompt, or better/clearer options. REUSE existing engine tags from the questionnaire wherever possible (new tags only if truly needed, lowercase_snake).",
      "Each suggestion: { category, action: 'add'|'reword'|'improve_options', questionId?, prompt:{en,hi}, options:[{label:{en,hi}, tags:[]}], rationale }. Hindi must be natural Devanagari, sentence case.",
      'Return ONLY JSON: {"suggestions":[ ... ]}. No preamble.',
    ].join("\n");
    const resp = await client.messages.create(
      {
        model: env.LLM_MODEL || DEFAULT_MODEL,
        max_tokens: 1600,
        temperature: 0.5,
        system,
        messages: [{ role: "user", content: JSON.stringify({ lang: input.lang, stats: input.stats, questionnaire: input.questionnaire }) }],
      },
      { timeout: 12000 },
    );
    const text = resp.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
    const parsed = JSON.parse(extractJson(text)) as { suggestions?: unknown };
    const list = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    return list.filter((s): s is QuestionSuggestion => !!s && typeof s === "object" && typeof (s as QuestionSuggestion).category === "string").slice(0, 4);
  } catch {
    return [];
  }
}
