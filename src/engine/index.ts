/** Public surface of the pure LIQO engine. */
export * from "./types";
export * from "./tags";
export { recommend } from "./recommend";
export {
  computeLeaderboard,
  mergeLeaderboard,
  pointsForSession,
  isBill,
  type SessionRecord,
  type RosterEntry,
} from "./points";
export {
  transformInventory,
  transformRow,
  deriveTags,
  normalizeStar,
  stripSourceCodes,
  classifyChannel,
  assignBand,
  slugStore,
  type RawInventoryRow,
} from "./mapper";

import type { EngineConfig } from "./types";

/** Narrow a parsed JSON blob to EngineConfig (no validation lib at the edge). */
export function asEngineConfig(json: unknown): EngineConfig {
  return json as EngineConfig;
}
