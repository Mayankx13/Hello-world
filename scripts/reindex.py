#!/usr/bin/env python3
"""Rebuild data/index.sqlite from the markdown corpus."""
from __future__ import annotations

import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "src"))

from life_os import config  # noqa: E402
from life_os.storage import sqlite as sqlite_mod  # noqa: E402


def main() -> int:
    paths = config.load_paths()
    conn = sqlite_mod.connect(paths.sqlite_path)
    sqlite_mod.init_db(conn, paths.schema_sql)
    sqlite_mod.reset_db(conn)
    sqlite_mod.init_db(conn, paths.schema_sql)
    counts = sqlite_mod.reindex_all(conn, paths)
    print(f"reindex complete: {counts}")
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
