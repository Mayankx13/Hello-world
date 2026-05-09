#!/usr/bin/env python3
"""Verify the local environment can run Life OS.

Checks: Python version, key Python deps, age binary on PATH, OS keychain
backend, outbound HTTPS to api.anthropic.com and github.com. Prints a
clear PASS/WARN/FAIL line for each. Never makes API calls.
"""
from __future__ import annotations

import importlib
import importlib.metadata as md
import os
import shutil
import socket
import sys
import urllib.request
from pathlib import Path

CHECKS_OK = 0
CHECKS_WARN = 0
CHECKS_FAIL = 0


def _row(label: str, status: str, detail: str = "") -> None:
    global CHECKS_OK, CHECKS_WARN, CHECKS_FAIL
    if status == "PASS":
        marker = "[ok]   "
        CHECKS_OK += 1
    elif status == "WARN":
        marker = "[warn] "
        CHECKS_WARN += 1
    else:
        marker = "[FAIL] "
        CHECKS_FAIL += 1
    line = f"{marker}{label}"
    if detail:
        line += f"  — {detail}"
    print(line)


def check_python() -> None:
    v = sys.version_info
    if v >= (3, 11):
        _row("Python ≥ 3.11", "PASS", f"{v.major}.{v.minor}.{v.micro}")
    else:
        _row("Python ≥ 3.11", "FAIL", f"found {v.major}.{v.minor}.{v.micro}")


def check_deps() -> None:
    required = [
        "typer", "rich", "anthropic", "keyring", "python-frontmatter",
        "PyYAML", "python-dateutil",
    ]
    for name in required:
        try:
            ver = md.version(name)
            _row(f"package: {name}", "PASS", ver)
        except md.PackageNotFoundError:
            _row(f"package: {name}", "FAIL", "not installed")


def check_age() -> None:
    bin_path = shutil.which(os.environ.get("LIFE_OS_AGE_BIN", "age"))
    if not bin_path:
        _row("age binary on PATH", "WARN", "private bucket disabled until installed")
        return
    _row("age binary on PATH", "PASS", bin_path)


def check_keyring() -> None:
    # BaseException because some keyring backends (libsecret via PyO3) can
    # raise rust panics that aren't Exception subclasses.
    try:
        import keyring

        backend = keyring.get_keyring()
        cls = backend.__class__.__name__
        if "fail" in cls.lower() or "null" in cls.lower():
            _row("OS keychain backend", "WARN", f"{cls}; API key will fall back to env var")
        else:
            _row("OS keychain backend", "PASS", cls)
    except BaseException as exc:  # noqa: BLE001
        _row("OS keychain backend", "WARN", f"backend probe failed: {type(exc).__name__}")


def check_network(host: str) -> None:
    try:
        socket.create_connection((host, 443), timeout=5).close()
        _row(f"network: {host}:443 reachable", "PASS")
    except OSError as exc:
        _row(f"network: {host}:443 reachable", "WARN", str(exc))


def check_repo_layout() -> None:
    repo = Path(__file__).resolve().parents[1]
    expected = ["ROADMAP.md", "roadmap", "journal/prompts", "data/schema.sql", "src/life_os/cli.py"]
    for rel in expected:
        path = repo / rel
        if path.exists():
            _row(f"repo layout: {rel}", "PASS")
        else:
            _row(f"repo layout: {rel}", "FAIL", f"missing {path}")


def main() -> int:
    print("Life OS — preflight\n")
    check_python()
    check_deps()
    check_age()
    check_keyring()
    check_network("api.anthropic.com")
    check_network("github.com")
    check_repo_layout()
    print()
    print(f"summary: {CHECKS_OK} ok / {CHECKS_WARN} warn / {CHECKS_FAIL} fail")
    if CHECKS_FAIL:
        return 2
    if CHECKS_WARN:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
