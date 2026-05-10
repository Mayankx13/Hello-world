"""Telegram bot for Life OS — capture, nudges, and in-chat ask-mode.

Run on a VPS (or any always-on machine) via systemd:

    sudo systemctl enable --now life-os-bot

The bot listens for messages from the authorized chat_id only. Free text
becomes an evening journal entry; slash commands handle structured logs,
weekly review, ask-mode, and status.
"""
from __future__ import annotations

import asyncio
import logging
import shlex
from datetime import date, datetime, time as dt_time
from pathlib import Path

from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from .. import config
from .. import digest as digest_mod
from ..journal import evening as evening_mod
from ..journal import log as log_mod
from ..journal import weekly as weekly_mod
from ..llm import anthropic_client
from ..dashboards import status as status_mod
from ..storage import sqlite as sqlite_mod
from . import git_sync

log = logging.getLogger("life_os.bot")

HELP_TEXT = (
    "Life OS bot. Free text = evening journal entry. Commands:\n"
    "  /evening <text>      — save evening reflection\n"
    "  /weekly <text>       — Sunday review\n"
    "  /log <domain> <text> — domain log (body, perfectghar, career, finance, social, growth)\n"
    "  /ask <question>      — ask Claude with your full corpus\n"
    "  /digest [7d|30d]     — synthesized roll-up, saved to digests/\n"
    "  /status              — dashboard\n"
    "  /help                — this message"
)


def _is_authorized(update: Update, allowed_chat_id: int | None) -> bool:
    if allowed_chat_id is None:
        return True
    chat = update.effective_chat
    return chat is not None and chat.id == allowed_chat_id


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat = update.effective_chat
    chat_id = chat.id if chat else "?"
    await update.message.reply_text(
        f"Life OS bot ready.\nYour chat_id is `{chat_id}`.\n\n"
        f"Authorize this chat by setting LIFE_OS_TELEGRAM_CHAT_ID={chat_id} (env) "
        f"or running `journal config set-tg-chat-id {chat_id}` on the host.\n\n"
        f"{HELP_TEXT}",
        parse_mode=ParseMode.MARKDOWN,
    )


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(HELP_TEXT)


def _entry_text_from_message(text: str) -> str:
    """Wrap raw text into a single-section markdown body."""
    text = text.strip()
    if not text:
        return ""
    if text.startswith("##"):
        return text + "\n"
    return f"## Capture\n\n{text}\n"


async def _save_evening(update: Update, paths: config.Paths, body: str) -> None:
    if not body.strip():
        await update.message.reply_text("empty message — nothing saved.")
        return
    out, suggestions = evening_mod.run(
        paths,
        use_editor=False,
        text_override=_entry_text_from_message(body),
    )
    _try_sync(paths, out, f"telegram: evening {out.name}")
    msg = f"saved {out.relative_to(paths.home)}"
    if suggestions:
        msg += "\n\nawareness:\n" + "\n".join(f"• {s}" for s in suggestions)
    await update.message.reply_text(msg)


async def cmd_evening(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = " ".join(context.args) if context.args else ""
    if not text and update.message.reply_to_message:
        text = update.message.reply_to_message.text or ""
    paths = _paths_from_context(context)
    await _save_evening(update, paths, text)


async def cmd_weekly(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = " ".join(context.args) if context.args else ""
    if not text:
        await update.message.reply_text("usage: /weekly <body of your sunday review>")
        return
    paths = _paths_from_context(context)
    out, _ = weekly_mod.run(paths, use_editor=False, text_override=_entry_text_from_message(text))
    _try_sync(paths, out, f"telegram: weekly {out.name}")
    await update.message.reply_text(f"saved {out.relative_to(paths.home)}")


async def cmd_log(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not context.args:
        await update.message.reply_text(
            "usage: /log <domain> [type] <body>\n"
            f"domains: {', '.join(config.DOMAINS)}"
        )
        return
    domain = context.args[0].lower()
    if domain not in config.DOMAINS:
        await update.message.reply_text(
            f"unknown domain. valid: {', '.join(config.DOMAINS)}"
        )
        return

    paths = _paths_from_context(context)
    rest = context.args[1:]
    log_type = None
    if rest and not any(c.isspace() for c in rest[0]) and "_" not in rest[0] and len(rest[0]) <= 20:
        log_type = rest[0]
        body = " ".join(rest[1:])
    else:
        body = " ".join(rest)

    if not body.strip():
        await update.message.reply_text("missing body — include the log content after the domain.")
        return

    try:
        out = log_mod.run(
            paths,
            domain,
            log_type=log_type,
            use_editor=False,
            text_override=_entry_text_from_message(body),
        )
    except (ValueError, RuntimeError) as exc:
        await update.message.reply_text(f"log failed: {exc}")
        return
    _try_sync(paths, out, f"telegram: {domain} log {out.name}")
    await update.message.reply_text(f"saved {out.relative_to(paths.home)}")


async def cmd_ask(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not context.args:
        await update.message.reply_text("usage: /ask <question>")
        return
    question = " ".join(context.args)
    paths = _paths_from_context(context)
    typing = update.message.chat.send_action("typing")
    try:
        prompt = anthropic_client.build_prompt(paths, window="all")
        client = anthropic_client.make_client()
    except RuntimeError as exc:
        await update.message.reply_text(f"ask unavailable: {exc}")
        return
    model = config.get_model()
    chunks = []
    try:
        for chunk in anthropic_client.stream_reply(
            client, model, prompt, [{"role": "user", "content": question}], max_tokens=1024
        ):
            chunks.append(chunk)
    except Exception as exc:  # noqa: BLE001
        await update.message.reply_text(f"ask error: {exc}")
        return
    reply = "".join(chunks).strip() or "(empty reply)"
    # Telegram caps at 4096 chars per message.
    for i in range(0, len(reply), 4000):
        await update.message.reply_text(reply[i : i + 4000])


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    paths = _paths_from_context(context)
    conn = sqlite_mod.connect(paths.sqlite_path)
    sqlite_mod.init_db(conn, paths.schema_sql)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) AS c FROM roadmap_items")
    if cur.fetchone()["c"] == 0:
        sqlite_mod.reindex_all(conn, paths)

    active = sqlite_mod.fetch_active_phases(conn)
    overdue = sqlite_mod.fetch_overdue_items(conn)
    lines = ["*Active phases:*"]
    by_domain: dict[str, str] = {}
    for row in active:
        if row["domain"] in by_domain:
            continue
        by_domain[row["domain"]] = row["title"]
    for domain, title in sorted(by_domain.items()):
        lines.append(f"  • _{domain}_: {title}")
    if overdue:
        lines.append("")
        lines.append("*Overdue:*")
        for row in overdue[:5]:
            lines.append(f"  • {row['domain']}: {row['title']} (due {row['due_date']})")
    conn.close()
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN)


async def cmd_digest(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    window = (context.args[0] if context.args else "7d").lower()
    if window not in {"7d", "30d", "all"} and not (window.endswith("d") and window[:-1].isdigit()):
        await update.message.reply_text("usage: /digest [7d|30d|all]")
        return
    paths = _paths_from_context(context)
    await update.message.chat.send_action("typing")
    try:
        out_path, text, _ = digest_mod.generate(paths, window=window)
    except Exception as exc:  # noqa: BLE001
        await update.message.reply_text(f"digest failed: {exc}")
        return
    _try_sync(paths, out_path, f"telegram: digest {out_path.name}")
    await update.message.reply_text(f"saved {out_path.relative_to(paths.home)}")
    for i in range(0, len(text), 4000):
        await update.message.reply_text(text[i : i + 4000])
    paths = _paths_from_context(context)
    conn = sqlite_mod.connect(paths.sqlite_path)
    sqlite_mod.init_db(conn, paths.schema_sql)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) AS c FROM roadmap_items")
    if cur.fetchone()["c"] == 0:
        sqlite_mod.reindex_all(conn, paths)

    active = sqlite_mod.fetch_active_phases(conn)
    overdue = sqlite_mod.fetch_overdue_items(conn)
    lines = ["*Active phases:*"]
    by_domain: dict[str, str] = {}
    for row in active:
        # Show the first active/planned per domain — keep it short.
        if row["domain"] in by_domain:
            continue
        by_domain[row["domain"]] = row["title"]
    for domain, title in sorted(by_domain.items()):
        lines.append(f"  • _{domain}_: {title}")
    if overdue:
        lines.append("")
        lines.append("*Overdue:*")
        for row in overdue[:5]:
            lines.append(f"  • {row['domain']}: {row['title']} (due {row['due_date']})")
    conn.close()
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN)


async def free_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Free text outside a slash command becomes an evening journal entry."""
    paths = _paths_from_context(context)
    text = update.message.text or ""
    await _save_evening(update, paths, text)


# --- Scheduled nudges ------------------------------------------------------

async def evening_nudge(context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = context.job.data["chat_id"]
    await context.bot.send_message(
        chat_id=chat_id,
        text=(
            "Evening check-in 🌙\n\n"
            "Reply with your reflection (or use /evening <text>):\n"
            "  Wins / Friction / Avoided / Who with / Lesson"
        ),
    )


async def weekly_nudge(context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = context.job.data["chat_id"]
    await context.bot.send_message(
        chat_id=chat_id,
        text=(
            "Sunday review 🗓\n\n"
            "Roadmap pulse → drift check → top 3 wins / friction → next week's commitments → honesty pass.\n"
            "Reply with /weekly <text>."
        ),
    )


async def sunday_digest_job(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Auto-generate Sunday digest 30 min before the weekly-review nudge."""
    chat_id = context.job.data["chat_id"]
    paths = context.application.bot_data.get("paths") or config.load_paths()
    try:
        out_path, text, _ = digest_mod.generate(paths, window="7d")
    except Exception as exc:  # noqa: BLE001
        log.exception("Sunday digest failed: %s", exc)
        await context.bot.send_message(chat_id=chat_id, text=f"digest failed: {exc}")
        return
    _try_sync(paths, out_path, f"telegram: sunday digest {out_path.name}")
    await context.bot.send_message(chat_id=chat_id, text=f"📊 weekly digest — {out_path.relative_to(paths.home)}")
    for i in range(0, len(text), 4000):
        await context.bot.send_message(chat_id=chat_id, text=text[i : i + 4000])


# --- Wiring ---------------------------------------------------------------

def _paths_from_context(context: ContextTypes.DEFAULT_TYPE) -> config.Paths:
    paths = context.application.bot_data.get("paths")
    if paths is None:
        paths = config.load_paths()
        context.application.bot_data["paths"] = paths
    return paths


def _try_sync(paths: config.Paths, written: Path, message: str) -> None:
    if not git_sync.is_git_repo(paths.home):
        return
    try:
        git_sync.commit_and_push(paths.home, [written], message)
    except git_sync.GitSyncError as exc:
        log.warning("git sync failed for %s: %s", written, exc)


def _parse_hhmm(value: str) -> dt_time:
    h, m = value.split(":")
    return dt_time(hour=int(h), minute=int(m))


def build_application(token: str, allowed_chat_id: int | None) -> Application:
    app = Application.builder().token(token).build()

    auth_filter: filters.BaseFilter
    if allowed_chat_id is None:
        auth_filter = filters.ALL
    else:
        auth_filter = filters.Chat(chat_id=int(allowed_chat_id))

    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("evening", cmd_evening, filters=auth_filter))
    app.add_handler(CommandHandler("weekly", cmd_weekly, filters=auth_filter))
    app.add_handler(CommandHandler("log", cmd_log, filters=auth_filter))
    app.add_handler(CommandHandler("ask", cmd_ask, filters=auth_filter))
    app.add_handler(CommandHandler("digest", cmd_digest, filters=auth_filter))
    app.add_handler(CommandHandler("status", cmd_status, filters=auth_filter))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND & auth_filter, free_text))

    if allowed_chat_id is not None and app.job_queue is not None:
        evening_t = _parse_hhmm(config.get_evening_nudge_time())
        weekly_t = _parse_hhmm(config.get_weekly_nudge_time())
        # Sunday digest fires 30 minutes before the weekly-review nudge.
        digest_minutes = max(0, weekly_t.hour * 60 + weekly_t.minute - 30)
        digest_t = dt_time(hour=digest_minutes // 60, minute=digest_minutes % 60)
        app.job_queue.run_daily(
            evening_nudge,
            time=evening_t,
            data={"chat_id": int(allowed_chat_id)},
            name="evening_nudge",
        )
        app.job_queue.run_daily(
            sunday_digest_job,
            time=digest_t,
            days=(config.DEFAULT_WEEKLY_NUDGE_DOW,),
            data={"chat_id": int(allowed_chat_id)},
            name="sunday_digest",
        )
        app.job_queue.run_daily(
            weekly_nudge,
            time=weekly_t,
            days=(config.DEFAULT_WEEKLY_NUDGE_DOW,),
            data={"chat_id": int(allowed_chat_id)},
            name="weekly_nudge",
        )

    return app


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    token = config.get_telegram_token()
    if not token:
        log.error(
            "no Telegram token. Set LIFE_OS_TELEGRAM_TOKEN env var "
            "or run `journal config set-tg-token` on this machine."
        )
        return 2
    chat_id = config.get_telegram_chat_id()
    if chat_id is None:
        log.warning(
            "no chat_id authorized. Bot will accept /start from anyone, "
            "then refuse all other commands. Run /start in your chat to discover your chat_id, "
            "then set LIFE_OS_TELEGRAM_CHAT_ID=<id> (or `journal config set-tg-chat-id <id>`)."
        )
    app = build_application(token, chat_id)
    log.info("starting bot (chat_id=%s)", chat_id)
    app.run_polling(allowed_updates=Update.ALL_TYPES)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
