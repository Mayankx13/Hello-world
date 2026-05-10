from __future__ import annotations

import pytest

pytest.importorskip("telegram", reason="python-telegram-bot extras not installed")

from life_os.bots import telegram_bot as tb  # noqa: E402


def test_entry_text_from_message_wraps_plain_text():
    out = tb._entry_text_from_message("just a quick note")
    assert out.startswith("## Capture\n\n")
    assert "just a quick note" in out


def test_entry_text_from_message_preserves_markdown_headers():
    raw = "## Wins\n\nshipped\n\n## Friction\n\ntests broke"
    out = tb._entry_text_from_message(raw)
    assert out.startswith("## Wins")
    assert "## Friction" in out


def test_entry_text_from_message_empty():
    assert tb._entry_text_from_message("") == ""
    assert tb._entry_text_from_message("   ") == ""


def test_build_application_with_chat_id_schedules_jobs():
    app = tb.build_application("123:fake_token", allowed_chat_id=42)
    job_names = {j.name for j in app.job_queue.jobs()}
    assert {"evening_nudge", "weekly_nudge"}.issubset(job_names)


def test_build_application_without_chat_id_skips_jobs():
    app = tb.build_application("123:fake_token", allowed_chat_id=None)
    assert app.job_queue.jobs() == ()


def test_build_application_registers_command_handlers():
    app = tb.build_application("123:fake_token", allowed_chat_id=42)
    # python-telegram-bot stores handlers per group; group 0 is the default.
    handlers = app.handlers.get(0, [])
    cmds = set()
    for h in handlers:
        cmd_attr = getattr(h, "commands", None)
        if cmd_attr:
            cmds.update(cmd_attr)
    for required in ("start", "help", "evening", "weekly", "log", "ask", "status"):
        assert required in cmds, f"missing /{required}"
