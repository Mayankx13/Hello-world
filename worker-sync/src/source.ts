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
}

export async function getRawInventory(env: SyncEnv): Promise<{ rows: RawInventoryRow[]; source: string }> {
  if (env.INVENTORY_URL) {
    const headers: Record<string, string> = { accept: "application/json, text/csv" };
    if (env.INVENTORY_AUTH) headers.authorization = `Bearer ${env.INVENTORY_AUTH}`;
    const res = await fetch(env.INVENTORY_URL, { headers });
    if (!res.ok) throw new Error(`INVENTORY_URL ${res.status}`);
    const isCsv =
      env.INVENTORY_FORMAT === "csv" ||
      env.INVENTORY_URL.endsWith(".csv") ||
      (res.headers.get("content-type") ?? "").includes("csv");
    const text = await res.text();
    const rows = isCsv ? parseCSV(text) : (JSON.parse(text) as RawInventoryRow[]);
    return { rows, source: `url:${env.INVENTORY_URL}` };
  }
  // Default: the bundled seed JSON (already matches the target schema).
  return { rows: seed as unknown as RawInventoryRow[], source: "seed:liqo_inventory.json" };
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
