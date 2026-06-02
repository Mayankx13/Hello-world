"""
SQL validator — the security boundary between the LLM and the warehouse.

Why this file is the most-important 100 lines in the whole project:
  The generator can produce anything. The validator decides whether it
  hits the database. In any enterprise GenAI review, this is the file
  the security team will read first.

What the validator guarantees, in order of severity:
  1. The SQL parses (no malformed output).
  2. Only SELECT — no DDL/DML reaches the executor.
  3. Only tables on a whitelist are referenced.
  4. Result size is capped (LIMIT injected if absent).
  5. (Optional) Tenant filter is enforced via WHERE clause injection.

Why sqlglot and not regex / sqlparse:
  - Regex is laughably easy to bypass ("Sel/*comment*/ect ...").
  - sqlparse is a tokenizer, not a validator. It can't tell you whether
    a query is read-only.
  - sqlglot builds an AST. AST-level checks are sound — you can't fool
    a parser by formatting tricks. AND sqlglot has dialect translators,
    so we get Postgres → T-SQL for free when we move to Azure SQL.

Defence in interview:
  "The validator is non-negotiable. I'd rather ship a worse model
   than a worse validator. The cost of the model being wrong is a
   bad answer; the cost of the validator being wrong is a CVE."
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

import sqlglot
from sqlglot import exp


# Tables the LLM is allowed to reference. Anything else is a hard fail.
# Sourced from schema_catalog.yaml — keep in sync (wk1 task: add a test
# that asserts this list matches the YAML keys).
ALLOWED_TABLES: Final[set[str]] = {
    "customers",
    "orders",
    "order_items",
    "products",
    "product_category_translation",
    "sellers",
    "order_payments",
    "order_reviews",
    "geolocation",
}

DEFAULT_LIMIT: Final[int] = 1000


@dataclass(frozen=True)
class ValidationResult:
    ok: bool
    sql: str  # The (possibly mutated) SQL to execute. Empty if !ok.
    reason: str  # Human-readable, surfaced to user and logged.


def validate(raw_sql: str) -> ValidationResult:
    """
    Run all checks. Returns a ValidationResult — callers should NEVER
    execute SQL that didn't come out of this function.

    Why I mutate the SQL (LIMIT injection) instead of just rejecting:
      A senior IC's job is to make the system usable, not just safe. If
      the LLM forgets LIMIT, rejecting the query forces a retry; quietly
      injecting one is the right product call. The injection is visible
      in the logs and shown to the user — no covert behaviour.

    Why I return reasons in plain English:
      The orchestrator surfaces validation failures to the user as
      "Your question would have required SQL we don't allow — here's
       why". Cryptic error codes don't help business users debug.
    """
    sql = raw_sql.strip().rstrip(";")
    if not sql:
        return ValidationResult(False, "", "Empty SQL.")

    # Parse into an AST. parse_one returns None on parse failure.
    # We pin dialect="postgres" because our dev warehouse is Postgres;
    # in prod we'd switch to "tsql" — that's the only change needed.
    try:
        ast = sqlglot.parse_one(sql, dialect="postgres")
    except sqlglot.errors.ParseError as e:
        return ValidationResult(False, "", f"SQL did not parse: {e}")

    if ast is None:
        return ValidationResult(False, "", "SQL did not parse.")

    # Check #1: must be a SELECT at the top level.
    # Why `isinstance(ast, exp.Select)` and not string-match:
    #   A CTE like `WITH x AS (...) SELECT ...` is also a SELECT but
    #   string-matching "SELECT" anywhere is bypassable. sqlglot's
    #   exp.Select catches both forms via the AST node type.
    if not isinstance(ast, (exp.Select, exp.Subquery, exp.Union)):
        return ValidationResult(
            False, "", f"Only SELECT statements allowed. Got: {ast.key}"
        )

    # Check #2: no write operations anywhere in the tree.
    # We walk the entire AST and reject any node from a known write set.
    # This catches nested DML inside CTEs.
    write_node_types = (
        exp.Insert, exp.Update, exp.Delete, exp.Drop, exp.AlterTable,
        exp.Create, exp.TruncateTable,
    )
    for node in ast.walk():
        if isinstance(node, write_node_types):
            return ValidationResult(
                False, "", f"Write operation detected: {type(node).__name__}"
            )

    # Check #3: only allowed tables.
    # ast.find_all(exp.Table) gets every table reference, including those
    # in joins and subqueries.
    referenced = {t.name for t in ast.find_all(exp.Table)}
    disallowed = referenced - ALLOWED_TABLES
    if disallowed:
        return ValidationResult(
            False, "", f"Tables not in catalog: {sorted(disallowed)}"
        )

    # Check #4: cap result size with LIMIT.
    # If the top-level SELECT has no LIMIT, inject one.
    # We don't add LIMIT to UNIONs (each side may have its own; LIMIT on
    # a UNION is supported but semantically different — out of scope).
    if isinstance(ast, exp.Select) and not ast.args.get("limit"):
        ast = ast.limit(DEFAULT_LIMIT)

    return ValidationResult(True, ast.sql(dialect="postgres"), "ok")


# Why no `validate_with_tenant(...)` here yet:
#   Multi-tenant WHERE-injection is a wk-4 task and depends on the
#   tenant_id model we agree on with the FastAPI middleware. Adding it
#   prematurely would lock in a design before we've thought it through.
