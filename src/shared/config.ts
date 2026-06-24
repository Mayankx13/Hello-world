/**
 * Engine config persistence. The live config lives in the D1 `config` table
 * (key = 'engine'); editing it changes behaviour with NO redeploy. The bundled
 * data/config.json is the seed/fallback when the row is absent.
 */
import type { EngineConfig } from "../engine/types";
import type { D1Like } from "./d1";
import defaultConfig from "../../data/config.json";
import defaultQuestionnaire from "../../data/questionnaire.json";

export const DEFAULT_CONFIG = defaultConfig as unknown as EngineConfig;
export const DEFAULT_QUESTIONNAIRE = defaultQuestionnaire as unknown;

export async function loadConfig(db: D1Like): Promise<EngineConfig> {
  const row = await db
    .prepare("SELECT value FROM config WHERE key = 'engine'")
    .first<{ value: string }>();
  if (row?.value) {
    try {
      return JSON.parse(row.value) as EngineConfig;
    } catch {
      /* fall through to default */
    }
  }
  return DEFAULT_CONFIG;
}

export async function saveConfig(db: D1Like, cfg: EngineConfig): Promise<void> {
  await upsert(db, "engine", JSON.stringify(cfg), cfg.version ?? "0");
}

/** Questionnaire lives in the same key/value config table (key = 'questionnaire'),
 *  so admins can edit questions live with no redeploy. */
export async function loadQuestionnaire(db: D1Like): Promise<unknown> {
  const row = await db
    .prepare("SELECT value FROM config WHERE key = 'questionnaire'")
    .first<{ value: string }>();
  if (row?.value) {
    try {
      return JSON.parse(row.value);
    } catch {
      /* fall through */
    }
  }
  return DEFAULT_QUESTIONNAIRE;
}

export async function saveQuestionnaire(db: D1Like, q: unknown): Promise<void> {
  const version = (q as { version?: string }).version ?? "0";
  await upsert(db, "questionnaire", JSON.stringify(q), version);
}

async function upsert(db: D1Like, key: string, value: string, version: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO config (key, value, version, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, version = excluded.version, updated_at = excluded.updated_at`,
    )
    .bind(key, value, version, new Date().toISOString())
    .run();
}
