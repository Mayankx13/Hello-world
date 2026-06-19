/**
 * Engine config persistence. The live config lives in the D1 `config` table
 * (key = 'engine'); editing it changes behaviour with NO redeploy. The bundled
 * data/config.json is the seed/fallback when the row is absent.
 */
import type { EngineConfig } from "../engine/types";
import type { D1Like } from "./d1";
import defaultConfig from "../../data/config.json";

export const DEFAULT_CONFIG = defaultConfig as unknown as EngineConfig;

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
  const value = JSON.stringify(cfg);
  await db
    .prepare(
      `INSERT INTO config (key, value, version, updated_at)
       VALUES ('engine', ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, version = excluded.version, updated_at = excluded.updated_at`,
    )
    .bind(value, cfg.version ?? "0", new Date().toISOString())
    .run();
}
