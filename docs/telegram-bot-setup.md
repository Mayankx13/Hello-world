# Telegram bot — setup walkthrough

The bot captures your daily journal from a Telegram chat, fires evening + Sunday-evening nudges, and answers `/ask` with your full journal corpus prompt-cached. It runs on your VPS so it's always on; your laptop only `git pull`s the entries when you want them.

## What the bot does

| You send | What happens |
|---|---|
| Free text (any non-command message) | Saved as today's evening entry. Awareness rules run; bot replies with file path + any drift signals. |
| `/evening <text>` | Same as free text but explicit. |
| `/weekly <text>` | Saved as Sunday review. |
| `/log <domain> [type] <body>` | Saved as a domain log. Domains: body, perfectghar, career, finance, social, growth. |
| `/ask <question>` | Calls Claude with your roadmap + entire journal corpus prompt-cached. Replies in chat. |
| `/status` | Active phase per domain + overdue items. |
| `/help` | Command list. |

Plus scheduled, unprompted:

- **Evening nudge** at 20:00 local time (override with `LIFE_OS_EVENING_NUDGE=HH:MM`).
- **Sunday review nudge** at 20:30 (override with `LIFE_OS_WEEKLY_NUDGE=HH:MM`).

After every save, the bot `git pull --rebase`s, commits the new file, and pushes to the private GitHub repo. Your laptop pulls those down when you next sit at it.

## One-time setup

### 1. Create the bot in Telegram

1. Open Telegram, message [@BotFather](https://t.me/BotFather).
2. `/newbot` → pick a name, pick a username (must end in `bot`).
3. Copy the **HTTP API token** BotFather gives you. Treat it like a password.
4. (Optional) `/setprivacy` → Disable. This lets the bot see all messages in groups, not just commands. For a 1:1 chat (recommended), default is fine.

### 2. Bootstrap the VPS

SSH in as the user that should own the bot, then:

```bash
# Either run the setup script (clones repo, creates venv, installs deps):
curl -fsSL https://raw.githubusercontent.com/Mayankx13/Hello-world/claude/life-os-roadmap-journal-wWQMI/scripts/setup-vps.sh | bash

# Or, if you already cloned the repo:
cd ~/life-os
python3 -m venv .venv
. .venv/bin/activate
pip install -e ".[bot]"
```

### 3. Set the token and Anthropic key

Two options.

**Option A — env vars (simpler for a headless VPS):**

```bash
mkdir -p ~/.life-os
cat > ~/.life-os/env <<'EOF'
LIFE_OS_TELEGRAM_TOKEN=<paste-bot-token>
ANTHROPIC_API_KEY=<paste-anthropic-key>
EOF
chmod 600 ~/.life-os/env
```

Then in the systemd unit (`scripts/life-os-bot.service`), uncomment:

```ini
EnvironmentFile=/home/mayank/.life-os/env
```

**Option B — OS keychain on the VPS** (only works if libsecret/`secret-tool` is set up):

```bash
. ~/life-os/.venv/bin/activate
journal config set-key            # Anthropic
journal config set-tg-token       # Telegram
```

### 4. Discover and authorize your chat_id

Run the bot in the foreground first time:

```bash
cd ~/life-os
. .venv/bin/activate
python -m life_os.bots.telegram_bot
```

In Telegram, message your bot `/start`. It replies:

```
Life OS bot ready.
Your chat_id is `123456789`.
...
```

Authorize that chat (one of):

```bash
echo "chat_id=123456789" > ~/.life-os/bot.conf
# or
journal config set-tg-chat-id 123456789
# or
echo "LIFE_OS_TELEGRAM_CHAT_ID=123456789" >> ~/.life-os/env
```

`Ctrl-C` to stop the foreground run.

### 5. Configure git push

The bot `git push`es after every save. Pick one:

- **SSH key** (preferred): `ssh-keygen -t ed25519`, copy `~/.ssh/id_ed25519.pub` into GitHub → Settings → SSH keys, then set the remote: `git -C ~/life-os remote set-url origin git@github.com:Mayankx13/Hello-world.git`.
- **Personal access token**: create a GitHub PAT with `repo` scope, configure git credential helper, or store in `~/.git-credentials`.

Test it:

```bash
cd ~/life-os
git pull --rebase
git commit --allow-empty -m "smoke: from VPS"
git push
```

### 6. Install the systemd unit

```bash
# Edit User= and WorkingDirectory= and (optionally) EnvironmentFile= in:
nano ~/life-os/scripts/life-os-bot.service

sudo cp ~/life-os/scripts/life-os-bot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now life-os-bot

# Watch:
journalctl -u life-os-bot -f
```

### 7. Verify

In Telegram, send any text. You should get back something like:

```
saved journal/entries/2026/05/2026-05-09-evening.md
```

On your laptop, `git pull` and the file appears.

## Daily flow

- 20:00: bot pings you with the evening prompt.
- You reply with whatever you've got — one line is fine.
- Bot saves it, commits, pushes.
- Sunday 20:30: bot pings with the weekly prompt.
- Anytime: `/ask` with a question that needs your full context. The bot uses Anthropic prompt caching so consecutive asks in a session reuse the cached corpus and stay cheap.

## Operational notes

- **Single source of truth on git.** Both your laptop and the VPS write to the same branch. The bot does `git pull --rebase --autostash` before every push to absorb laptop changes. If a push fails it retries with backoff (3 tries).
- **Time zone**: the JobQueue uses the system timezone of the VPS. Set it via `sudo timedatectl set-timezone Asia/Kolkata` (or whatever applies).
- **Privacy**: free-text and `/log` entries are *not* encrypted — they go to your private GitHub repo as plain markdown. Use the existing `journal/private/` (`age`-encrypted) bucket via the laptop CLI for sensitive entries; the bot deliberately doesn't have access to write there.
- **Rate limits**: Telegram is generous. Anthropic API charges per call; `/ask` defaults to `claude-opus-4-7` (best reasoning), use the underlying CLI with `--fast` for cheaper Haiku via the laptop.
- **Stopping**: `sudo systemctl stop life-os-bot`. Disable autostart with `sudo systemctl disable life-os-bot`.

## Migration to WhatsApp later

If you outgrow Telegram, the bot's command surface and storage layer are channel-agnostic. A WhatsApp adapter would replace `src/life_os/bots/telegram_bot.py` with a webhook handler (Vercel / Cloudflare Workers) that calls the same `evening_mod.run`, `log_mod.run`, `git_sync.commit_and_push`. The journal storage and roadmap don't change.
