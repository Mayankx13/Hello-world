# liqo-ig-concierge

AI concierge for LIQO's Instagram DMs (@liqo_discounted_electronics) — Amaflip India Pvt. Ltd.

The DM message loop runs in **n8n** (built separately). This monorepo owns everything around it:

| Path | What | Status |
|---|---|---|
| `schema/` | D1 schema (`liqo_concierge`), migrations, seeds | ✅ Phase 1 |
| `worker/` | Hono Worker — Meta webhook verifier + dashboard API | Phase 2 |
| `dashboard/` | React 18 + Vite dashboard → `command.amaflip.in` | Phase 3 |
| `scripts/` | BUSY-ERP attribution importer (Python) | Phase 4 |

## Database quickstart

```bash
npm install                 # installs wrangler
npm run db:create           # once — creates D1 db "liqo_concierge"; paste the
                            # printed database_id into worker/wrangler.toml
npm run db:apply            # local dev db: schema + seeds (idempotent)
npm run db:apply:remote     # production D1: schema + seeds (idempotent)
```

`npm run db:migrate` / `db:migrate:remote` run the same DDL through wrangler's
migration tracker (`schema/migrations/`) — use that flow for all future schema
changes: add a new numbered file, keep `schema/schema.sql` in sync.

**Schema stability:** the n8n workflow writes to these tables via the Cloudflare
API. Treat column names, types, and CHECK enums as a contract.

Seeded data: 11 material-centre placeholder rows in `stores` (rows marked
`EDIT:` are for ops to fill in) and one sample row in `offers`.

Full setup, secrets, Meta webhook pointing, importer schedule, and the go-live
checklist land in Phase 5.

---
Internal tool of Amaflip India Pvt. Ltd. · consumer brand: LIQO
