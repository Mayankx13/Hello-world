#!/usr/bin/env node
/**
 * LIQO ↔ BUSY connector.
 *
 * Runs on the Windows machine that hosts (or can reach) the BUSY / Microsoft
 * SQL Server inventory DB. It:
 *   1. connects to SQL Server on the LAN,
 *   2. runs your SELECT (aliasing BUSY columns to the LIQO field names),
 *   3. POSTs the rows to the LIQO Sync Worker's /push endpoint (outbound HTTPS).
 *
 * The Worker transforms + upserts into D1; the API then serves them. SQL Server
 * is never exposed to the internet — only this agent talks to it, locally.
 *
 * Usage (PowerShell / cmd):
 *   node index.mjs --discover            list tables/views to find your data
 *   node index.mjs --discover dbo.Items  list a table's columns
 *   node index.mjs --dry-run             query + map, print sample, DO NOT push
 *   node index.mjs                       query + push to the Worker
 *
 * Secrets: put the SQL password and admin token in env vars rather than the
 * config file when you can:
 *   set LIQO_SQL_PASSWORD=...     set LIQO_ADMIN_TOKEN=...
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import sql from "mssql";

const __dir = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const DISCOVER = has("--discover");
const DRY_RUN = has("--dry-run");
const discoverTarget = args[args.indexOf("--discover") + 1];

function loadConfig() {
  const path = process.env.LIQO_CONFIG || resolve(__dir, "config.json");
  let cfg;
  try {
    cfg = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    fail(`Could not read config at ${path}. Copy config.example.json -> config.json and fill it in.`);
  }
  // Env overrides (preferred for secrets).
  cfg.sql.password = process.env.LIQO_SQL_PASSWORD || cfg.sql.password;
  cfg.push.adminToken = process.env.LIQO_ADMIN_TOKEN || cfg.push.adminToken;
  return cfg;
}

function fail(msg) {
  console.error(`\n[liqo-connector] ERROR: ${msg}\n`);
  process.exit(1);
}

function sqlConfig(c) {
  return {
    server: c.sql.server,
    port: c.sql.port || 1433,
    user: c.sql.user,
    password: c.sql.password,
    database: c.sql.database,
    options: {
      encrypt: c.sql.options?.encrypt ?? false,
      trustServerCertificate: c.sql.options?.trustServerCertificate ?? true,
      ...(c.sql.options?.instanceName ? { instanceName: c.sql.options.instanceName } : {}),
    },
    connectionTimeout: 15000,
    requestTimeout: 60000,
  };
}

async function discover(pool, target) {
  if (target) {
    const t = target.includes(".") ? target.split(".").pop() : target;
    const r = await pool.request().input("t", sql.NVarChar, t).query(
      `SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
       FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @t ORDER BY ORDINAL_POSITION`,
    );
    console.log(`\nColumns in ${target}:`);
    for (const c of r.recordset) console.log(`  ${c.COLUMN_NAME}  (${c.DATA_TYPE})`);
  } else {
    const r = await pool.request().query(
      `SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES
       ORDER BY TABLE_TYPE, TABLE_SCHEMA, TABLE_NAME`,
    );
    console.log("\nTables & views (look for your item / stock master):");
    for (const t of r.recordset) console.log(`  [${t.TABLE_TYPE}] ${t.TABLE_SCHEMA}.${t.TABLE_NAME}`);
    console.log("\nNext: node index.mjs --discover <schema.table>  to see its columns.");
  }
}

async function pushRows(cfg, rows) {
  if (!cfg.push?.url) fail("push.url is not set in config.json");
  const res = await fetch(cfg.push.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.push.adminToken || ""}`,
    },
    body: JSON.stringify({ rows }),
  });
  const text = await res.text();
  if (!res.ok) fail(`push failed: HTTP ${res.status} ${text}`);
  return text;
}

async function main() {
  const cfg = loadConfig();
  console.log(`[liqo-connector] connecting to ${cfg.sql.server} / ${cfg.sql.database} ...`);
  let pool;
  try {
    pool = await sql.connect(sqlConfig(cfg));
  } catch (e) {
    fail(`SQL connect failed: ${e.message}\n  • Check server/instance, that SQL Server allows TCP/IP, and the login.`);
  }

  if (DISCOVER) {
    await discover(pool, discoverTarget);
    await pool.close();
    return;
  }

  if (!cfg.query || /YourInventory/i.test(cfg.query)) {
    fail("Set `query` in config.json to a SELECT that aliases your BUSY columns to LIQO field names (see README).");
  }

  console.log("[liqo-connector] running inventory query ...");
  const result = await pool.request().query(cfg.query);
  const rows = result.recordset || [];
  await pool.close();
  console.log(`[liqo-connector] got ${rows.length} rows from SQL Server.`);

  if (rows.length) {
    const r0 = rows[0];
    const keys = Object.keys(r0);
    const required = ["sku", "store", "category", "brand", "name"];
    const missing = required.filter((k) => !keys.includes(k));
    if (missing.length) console.warn(`  ⚠ rows are missing recommended columns: ${missing.join(", ")}`);
    if (DRY_RUN) console.log("  sample row:", JSON.stringify(r0, null, 2));
  }

  if (DRY_RUN) {
    console.log("\n[dry-run] not pushing. Remove --dry-run to send to the Worker.");
    return;
  }
  if (!rows.length) fail("query returned 0 rows — nothing to push.");

  console.log(`[liqo-connector] pushing ${rows.length} rows to ${cfg.push.url} ...`);
  const out = await pushRows(cfg, rows);
  console.log(`[liqo-connector] done: ${out}`);
}

main().catch((e) => fail(e?.message ?? String(e)));
