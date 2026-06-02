-- ─────────────────────────────────────────────────────────────────────
-- Read-only role for the NL2SQL executor.
--
-- Defence in interview:
--   "An LLM emitting SQL is a security boundary. Even with my sqlglot
--    validator, defence-in-depth means the DB role itself can't write.
--    If validation is ever bypassed — and security 101 says one day it
--    will be — the worst case is a slow SELECT, not data loss."
--
-- Why a separate role and not a separate database:
--   Same warehouse means the LLM sees real schema. Splitting the DB
--   forces synchronisation work and erodes the "we put GenAI on top
--   of the warehouse" narrative.
-- ─────────────────────────────────────────────────────────────────────

CREATE ROLE retail_readonly LOGIN PASSWORD 'retail_readonly';

-- Grant connect + usage on the public schema only.
GRANT CONNECT ON DATABASE olist TO retail_readonly;
GRANT USAGE ON SCHEMA public TO retail_readonly;

-- SELECT only. No INSERT/UPDATE/DELETE/TRUNCATE/CREATE.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO retail_readonly;

-- Default privileges so newly-created tables also auto-grant SELECT.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO retail_readonly;

-- Statement-level timeout. Defends against an LLM emitting a Cartesian
-- product or a missing-index full scan that locks up the warehouse.
ALTER ROLE retail_readonly SET statement_timeout = '10s';
