"""
Loads the Brazilian Olist e-commerce dataset into Postgres.

Why this file exists:
  Loading data is the first thing every reviewer will run. If this is
  hand-wavy or assumes a kaggle CLI auth you don't have, the project
  fails the "10 minutes from clone to first query" promise.

Why Olist and not Adventure Works / Northwind:
  Olist is 99k real orders across 8 normalised tables. Adventure Works
  is synthetic and screams "I followed a Microsoft tutorial". Defending
  Olist in interviews is easy: it's the de-facto benchmark dataset for
  retail-analytics demos and is multi-table enough to exercise non-
  trivial joins.

Why CSV → Postgres COPY rather than pandas to_sql:
  COPY is ~50x faster on bulk loads. pandas to_sql is convenient but
  every row becomes a separate INSERT. On 99k orders the difference is
  noticeable; on the order_items table (113k rows) it's painful.

What's scaffolded vs left for week 1:
  - The function signatures, the schema, the load order (FK-respecting)
    are all here.
  - The actual COPY calls are stubbed with TODO markers. Filling them
    in is the Day-2 task in the spec.
"""

from __future__ import annotations

import logging
from pathlib import Path

import psycopg
from psycopg import sql

from src.config import settings

logger = logging.getLogger(__name__)

# Load order matters: parents before children, otherwise FK constraints fail.
# Why I enumerate this explicitly instead of inspecting FKs at runtime:
#   - Olist's schema is small and stable. Reading it from code is faster
#     to review than introspecting `information_schema.referential_constraints`.
#   - This list IS the schema documentation. A reviewer can read it in 5s.
LOAD_ORDER: list[tuple[str, str]] = [
    ("olist_customers_dataset", "customers"),
    ("olist_sellers_dataset", "sellers"),
    ("olist_products_dataset", "products"),
    ("product_category_name_translation", "product_category_translation"),
    ("olist_geolocation_dataset", "geolocation"),
    ("olist_orders_dataset", "orders"),
    ("olist_order_items_dataset", "order_items"),
    ("olist_order_payments_dataset", "order_payments"),
    ("olist_order_reviews_dataset", "order_reviews"),
]

DATA_DIR = Path("./data/raw/olist")


def ensure_schema(conn: psycopg.Connection) -> None:
    """
    Create the 9 Olist tables with proper types and FKs.

    Why I write the DDL by hand and don't use SQLAlchemy ORM:
      - Reviewers reading the schema in `init.sql` or here can see what
        the warehouse looks like without running the code.
      - ORM models tempt you to add Python-side defaults and validation
        that don't exist in the actual database. The NL2SQL chain hits
        SQL, not ORM. The schema must be SQL-truth.
      - Trade-off accepted: schema changes need code edits in two places
        (here + schema_catalog.yaml). The clarity is worth the duplication
        for a project this size.

    TODO (wk1, day 2): paste the CREATE TABLE statements here, or read
    them from db/schema.sql. Olist's column types are well documented
    on Kaggle.
    """
    raise NotImplementedError(
        "Implement in wk1 day 2. See spec §4 Week-1 plan."
    )


def copy_csv_to_table(
    conn: psycopg.Connection,
    csv_path: Path,
    table_name: str,
) -> int:
    """
    Bulk-load a CSV into a table using COPY.

    Why COPY and not INSERT:
      COPY streams binary-encoded rows through a single socket call.
      INSERT serialises each row as text + parse + plan + execute. On
      113k order_items rows the difference is roughly 4s vs 90s.

    Why I take an open Connection rather than a URL:
      Connection ownership stays in the caller, which means tests can
      pass a transaction that gets rolled back at the end. Open-the-
      connection-here would force tests to use real persistence.

    Why I return the row count:
      Loud feedback. Every load logs `n=99441 → orders` so you can spot
      a partial load immediately. Quiet success is debt.
    """
    if not csv_path.exists():
        raise FileNotFoundError(
            f"Missing {csv_path}. Run: kaggle datasets download "
            f"-d olistbr/brazilian-ecommerce -p ./data/raw/olist --unzip"
        )

    with conn.cursor() as cur, csv_path.open("rb") as f:
        # Why CSV HEADER and not CSV: the Olist files have header rows.
        # If you forget HEADER, the first row becomes data, which fails
        # FK or type checks later. This bug is silent on small samples,
        # so I'm being explicit.
        copy_sql = sql.SQL("COPY {table} FROM STDIN WITH (FORMAT CSV, HEADER TRUE)").format(
            table=sql.Identifier(table_name),
        )
        with cur.copy(copy_sql) as copy:
            while data := f.read(65536):  # 64KB chunks — psycopg's sweet spot.
                copy.write(data)
        row_count = cur.rowcount

    logger.info("Loaded %d rows into %s", row_count, table_name)
    return row_count


def main() -> None:
    """
    Entry point. `python -m src.data_loader` runs this.

    Why a single-purpose `main()` and not click/typer:
      One command, no flags. Adding a CLI framework is premature.
      Resist the urge until you have at least three sub-commands.
    """
    logging.basicConfig(level=settings.log_level)

    if not DATA_DIR.exists():
        raise FileNotFoundError(
            f"{DATA_DIR} does not exist. Download Olist first:\n"
            f"  kaggle datasets download -d olistbr/brazilian-ecommerce "
            f"-p {DATA_DIR} --unzip"
        )

    with psycopg.connect(str(settings.database_url)) as conn:
        ensure_schema(conn)
        for csv_stem, table_name in LOAD_ORDER:
            csv_path = DATA_DIR / f"{csv_stem}.csv"
            copy_csv_to_table(conn, csv_path, table_name)
        conn.commit()

    logger.info("All Olist tables loaded successfully.")


if __name__ == "__main__":
    main()
