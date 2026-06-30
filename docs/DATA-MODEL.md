# LIQO data model (Cloudflare D1 / SQLite)

`schema.sql` is the single source of truth — 18 tables + 4 analytics views,
foreign-key enforced. `seed.sql` loads only real reference data (stores +
default milestones) and is applied idempotently on every deploy, so a live
deploy never re-injects fake rows over your actual DBMS data. Fictional demo
accounts and sample offers live in `seed-demo.sql`, which is applied **only**
when building the offline/demo environment (`DEV_DEMO_MODE=true`).

## Domains

| # | Domain | Tables |
|---|--------|--------|
| 0 | Reference | `stores`, `config` |
| 1 | Inventory | `inventory` (hourly snapshot) |
| 2 | People | `employees`, `attendance`, `leaves`, `milestones`, `incentives`, `feedback` |
| 3 | Customers | `customers`, `customer_brand_prefs`, `customer_events` |
| 4 | Commerce | `sessions`, `suggested_products`, `sales`, `sale_items`, `offers`, `demand_requests` |
| 5 | Analytics | `v_store_daily`, `v_demand_category`, `v_employee_month`, `v_customer_360` (views) |

## Key relationships

```
stores 1───* employees 1───* attendance
                 │      └──* leaves
                 │      └──* incentives *───1 milestones
                 │      └──* feedback        (anonymous → employee_id NULL)
customers 1──* customer_brand_prefs
          1──* customer_events
          1──* sales 1──* sale_items
sessions 1──* suggested_products
sessions  *──1 employees (who served)   *──1 customers (who was served)
sales     *──1 sessions / employees / customers / stores
offers    *──1 stores (NULL = all stores)   *──1 employees (created_by)
```

## Principles applied

- **3NF** — every non-key fact depends on the whole key and nothing but the key.
  Store/employee/customer/brand facts live once; bills are split into a header
  (`sales`) and lines (`sale_items`).
- **Derive, don't duplicate** — store summaries, demand, employee-month and
  customer-360 are **views**, computed on read, never stored redundantly.
- **Referential integrity** — `PRAGMA foreign_keys=ON`; every FK has an explicit
  `ON DELETE` (CASCADE for owned children, SET NULL for references).
- **Domain integrity** — `CHECK` constraints encode every enum (roles, statuses,
  tiers, payment methods, tiers), rating 1–5, date ordering, and the
  "anonymous feedback carries no employee id" rule.
- **Identity** — natural TEXT keys for slugs (`store_id`, `employee_id`,
  `customer_id`), surrogate INTEGER keys for high-churn rows.
- **Access paths** — indexes on every FK and on real query/sort predicates.
- **Auditability** — `created_at` everywhere; `updated_at` where rows mutate.
- **Privacy (DPDP)** — `customers.consent` gates storage; `customer_events` and
  brand prefs cascade-delete on erase by phone.

## Read paths the app uses

- Recall a customer → `v_customer_360` + last N `customer_events` by phone.
- Leaderboard / incentives → `v_employee_month` + `incentives`.
- Command centre → `v_store_daily`, `v_demand_category`.
- Engine offer-boost → live rows in `offers` (active, within `starts_at`/`ends_at`, `boost_weight > 0`).
