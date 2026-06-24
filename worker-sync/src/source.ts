/**
 * getRawInventory() — the single seam in front of the source of truth.
 *
 * Two implementations behind one function:
 *   (i)  HTTP/DBMS endpoint   — set INVENTORY_URL (JSON array, or .csv).
 *   (ii) bundled JSON/CSV     — the attached liqo_inventory.json seed (default).
 *
 * The source of truth is a DBMS synced hourly from BUSY ERP; the API never
 * reads BUSY live. If live reads are ever needed, put Cloudflare Hyperdrive in
 * front of a real DB connection inside the INVENTORY_URL branch.
 */
import type { RawInventoryRow } from "../../src/engine/mapper";
import seed from "../../data/liqo_inventory.json";

export interface SyncEnv {
  DB: unknown;
  INVENTORY_URL?: string;
  INVENTORY_FORMAT?: "json" | "csv";
  INVENTORY_AUTH?: string; // optional bearer for the feed
  /** Force a specific source; otherwise it's inferred (url if set, else seed). */
  INVENTORY_SOURCE?: SourceKind;
}

/**
 * Where the hourly snapshot is pulled from. Add a cloud DBMS by introducing a
 * new kind here + a branch in getRawInventory — nothing else in the system
 * changes, because everything downstream reads the D1 snapshot, not the source.
 *
 *   seed         bundled JSON (default; demo / first boot)
 *   url          an HTTP(S) export — a cloud DBMS REST/data API, a presigned
 *                R2/S3/Blob URL, or the BUSY exporter. JSON array or CSV.
 *   push         the LAN connector POSTs rows to the Sync Worker /push endpoint
 *                (handled in index.ts, not here — listed for completeness).
 *
 * CLOUD DBMS CUTOVER (Cloudflare Hyperdrive — when live reads are needed):
 *   1. `wrangler hyperdrive create liqo-db --connection-string=...`
 *   2. add a [[hyperdrive]] binding (binding = "HYPERDRIVE") to wrangler.toml
 *   3. add a driver (e.g. `postgres`) and a `case "hyperdrive"` branch below
 *      that runs the inventory query and maps columns to RawInventoryRow.
 * See docs/DATA-SOURCES.md for the full runbook and the column contract.
 */
export type SourceKind = "seed" | "url" | "push" | "hyperdrive";

export function sourceKind(env: SyncEnv): SourceKind {
  if (env.INVENTORY_SOURCE) return env.INVENTORY_SOURCE;
  return env.INVENTORY_URL ? "url" : "seed";
}

export async function getRawInventory(env: SyncEnv): Promise<{ rows: RawInventoryRow[]; source: string }> {
  const kind = sourceKind(env);
  if (kind === "url") {
    if (!env.INVENTORY_URL) throw new Error("INVENTORY_SOURCE=url but INVENTORY_URL is unset");
    return loadFromUrl(env);
  }
  // Default: the bundled seed JSON (already matches the target schema).
  return { rows: seed as unknown as RawInventoryRow[], source: "seed:liqo_inventory.json" };
}

async function loadFromUrl(env: SyncEnv): Promise<{ rows: RawInventoryRow[]; source: string }> {
  const headers: Record<string, string> = { accept: "application/json, text/csv" };
  if (env.INVENTORY_AUTH) headers.authorization = `Bearer ${env.INVENTORY_AUTH}`;
  const res = await fetch(env.INVENTORY_URL!, { headers });
  if (!res.ok) throw new Error(`INVENTORY_URL ${res.status}`);
  const isCsv =
    env.INVENTORY_FORMAT === "csv" ||
    env.INVENTORY_URL!.endsWith(".csv") ||
    (res.headers.get("content-type") ?? "").includes("csv");
  const text = await res.text();
  const rows = isCsv ? parseCSV(text) : (JSON.parse(text) as RawInventoryRow[]);
  return { rows, source: `url:${env.INVENTORY_URL}` };
}

/**
 * Minimal RFC-4180-ish CSV parser -> typed rows. Numeric/boolean coercion is
 * left to the transform; values arrive as strings and the mapper normalises.
 */
export function parseCSV(text: string): RawInventoryRow[] {
  const rows = splitCSV(text);
  if (rows.length < 2) return [];
  const header = rows[0];
  const out: RawInventoryRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    if (cells.length === 1 && cells[0] === "") continue;
    const obj: Record<string, unknown> = {};
    header.forEach((key, j) => {
      const raw = cells[j];
      if (raw === undefined || raw === "") return;
      obj[key] = coerce(raw);
    });
    out.push(obj as RawInventoryRow);
  }
  return out;
}

function coerce(s: string): unknown {
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (s === "true") return true;
  if (s === "false") return false;
  return s;
}

/** Split CSV text into rows of cells, honouring quotes and escaped quotes. */
function splitCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += c;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
