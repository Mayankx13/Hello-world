# LIQO — Inventory Data Sources & Cloud DBMS Cutover

LIQO never reads BUSY (or any DBMS) on the customer-facing path. The **Sync
Worker** refreshes a Cloudflare **D1 snapshot** every hour; the **API Worker**
and the engine read *only* that snapshot. Swapping the source of truth (bundled
seed → cloud DBMS) therefore changes **one file** and **a few env vars** —
nothing downstream moves.

```
 source of truth ──▶ Sync Worker (hourly) ──▶ D1 snapshot ──▶ API Worker ──▶ PWA
 (seed | URL | push | cloud DBMS)            transform+replace   reads D1     engine
```

The active source is reported at `GET /` on the Sync Worker:
`{ "service": "liqo-sync", "source": "seed", "rows": 812, "lastSyncedAt": "…" }`.

---

## The four sources

Selected by `sourceKind(env)` in `worker-sync/src/source.ts`
(`INVENTORY_SOURCE` forces it; otherwise `url` if `INVENTORY_URL` is set, else
`seed`).

| Kind | When | How to enable |
|------|------|---------------|
| `seed` | Demo / first boot | default — bundled `data/liqo_inventory.json` |
| `url` | Cloud DBMS with an HTTP export, or a presigned R2/S3/Blob URL, or the BUSY exporter | set `INVENTORY_URL` (+ optional `INVENTORY_FORMAT`, `INVENTORY_AUTH`) |
| `push` | On-prem / LAN DB with no inbound exposure | the local connector POSTs rows to `POST /push` (Bearer `ADMIN_TOKEN`) |
| `hyperdrive` | Live reads from a managed cloud SQL DB | add a Hyperdrive binding + driver (below) |

### A. `url` — cloud DBMS HTTP export (recommended cutover)

Most managed DBs (or a thin exporter Lambda/Worker/Function in front of one) can
expose the inventory as a JSON array or CSV. Then:

```toml
# worker-sync/wrangler.toml
[vars]
INVENTORY_URL = "https://data.yourdbms.example/liqo/inventory.json"
INVENTORY_FORMAT = "json"   # or "csv"
```
```bash
wrangler secret put INVENTORY_AUTH   # optional Bearer token for the feed
```

The hourly cron picks it up automatically. Force a one-off refresh with
`POST /sync` (Bearer `ADMIN_TOKEN`).

### B. `push` — on-prem connector (no inbound firewall change)

The LAN connector (e.g. the BUSY / SQL Server agent) reads locally and pushes
out over HTTPS:

```bash
curl -X POST https://liqo-sync.<acct>.workers.dev/push \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -H "content-type: application/json" \
  --data @rows.json          # { "rows": [ …RawInventoryRow… ] } or a bare array
```

### C. `hyperdrive` — managed cloud SQL (live reads)

When a cloud Postgres/MySQL is live and you want the sync to query it directly
(Cloudflare **Hyperdrive** pools the connection at the edge):

```bash
wrangler hyperdrive create liqo-db --connection-string="postgres://user:pass@host/db"
```
```toml
# worker-sync/wrangler.toml
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "<hyperdrive-id>"
```
Then add the binding to `SyncEnv`, install a driver (`postgres`), and add a
branch to `getRawInventory` in `worker-sync/src/source.ts`:

```ts
// case "hyperdrive":
import postgres from "postgres";
const sql = postgres(env.HYPERDRIVE.connectionString);
const rows = await sql`SELECT … FROM inventory_view`;  // map columns to RawInventoryRow
return { rows, source: "hyperdrive" };
```

No other file changes — the transform + D1 replace + API stay identical.

---

## Column contract (`RawInventoryRow`)

The transform (`src/engine/mapper.ts`) is tolerant: it accepts several aliases,
normalises stars / inverter / channel, derives fit tags, assigns price bands and
synthesises a per-SKU margin when the feed lacks one. Provide what you have.

| Field (aliases) | Type | Notes |
|---|---|---|
| `sku` / `itemCode` | string | stable id; combined with store as the D1 key |
| `store` | string | display name; slugged to `storeId` for routing |
| `channel` | string | `retail` is customer-facing; others are kept but not recommended |
| `category` | string | normalised to `ac` / `tv` / `fridge` / `wm` |
| `brand`, `model`, `name` / `itemName` | string | |
| `subCategory` | string? | |
| `capacityValue`, `capacityUnit`, `capacityText` | number/string? | e.g. 1.5 / "Ton" |
| `starRating` / `star` | number\|string? | "5Star", "3 star", 4 → 1..5 |
| `inverter` | bool\|string? | |
| `price` / `valueWithGst` | number | unit price, GST-inclusive (₹) |
| `mrp` | number? | |
| `skuMargin` / `marginAmount` / `marginPct` | number? | synthesised if absent |
| `marginBand` | string? | |
| `stockQty` / `qty` | number | units on hand |
| `ageingSlab` | string? | drives ageing rank 1 (new) … 6 (old) |
| `image`, `emiEligible`, `exchangeEligible`, `tags` | …? | optional |

Minimal viable row: `sku`, `store`, `category`, `brand`, `price`, `stockQty`.

---

## Verifying a cutover

```bash
# what source is active + snapshot freshness
curl https://liqo-sync.<acct>.workers.dev/

# force a refresh, then confirm row counts per category
curl -X POST https://liqo-sync.<acct>.workers.dev/sync -H "authorization: Bearer $ADMIN_TOKEN"
curl https://liqo-api.<acct>.workers.dev/catalog/health
```
