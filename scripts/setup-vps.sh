#!/usr/bin/env bash
# Life OS — VPS setup for the Telegram bot. Run once on a fresh VPS as the
# user that will own the bot. Idempotent.
set -euo pipefail

REPO_URL="${LIFE_OS_REPO:-git@github.com:Mayankx13/Hello-world.git}"
REPO_DIR="${LIFE_OS_DIR:-$HOME/life-os}"
BRANCH="${LIFE_OS_BRANCH:-claude/life-os-roadmap-journal-wWQMI}"

echo "==> Cloning $REPO_URL into $REPO_DIR (branch $BRANCH)"
if [ ! -d "$REPO_DIR" ]; then
    git clone --branch "$BRANCH" "$REPO_URL" "$REPO_DIR"
else
    git -C "$REPO_DIR" fetch origin "$BRANCH"
    git -C "$REPO_DIR" checkout "$BRANCH"
    git -C "$REPO_DIR" pull --rebase origin "$BRANCH"
fi

cd "$REPO_DIR"

echo "==> Creating venv"
[ -d .venv ] || python3 -m venv .venv
# shellcheck disable=SC1091
. .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e ".[bot]"

echo "==> Configure git identity (so the bot can commit back)"
git config user.name "${LIFE_OS_GIT_NAME:-Life OS Bot}"
git config user.email "${LIFE_OS_GIT_EMAIL:-life-os-bot@$(hostname)}"

echo "==> Bootstrap config dir"
mkdir -p "$HOME/.life-os"

cat <<EOF

Next:

1. Create a bot via @BotFather, copy the token, then either:
     export LIFE_OS_TELEGRAM_TOKEN=<token>             # ad-hoc
   or append to ~/.life-os/env (loaded by systemd unit) — see life-os-bot.service.

2. Get the Anthropic key onto this VPS:
     export ANTHROPIC_API_KEY=<key>
   (Or use OS keychain if libsecret is set up.)

3. First run, foreground, to discover your chat_id:
     . .venv/bin/activate
     python -m life_os.bots.telegram_bot
   Then in Telegram, /start the bot — it will reply with your chat_id.
   Set it:
     echo "chat_id=<your_chat_id>" > ~/.life-os/bot.conf
   Or set LIFE_OS_TELEGRAM_CHAT_ID in the environment.

4. Install the systemd unit (root):
     sudo cp $REPO_DIR/scripts/life-os-bot.service /etc/systemd/system/
     # edit User= and WorkingDirectory= in the service file
     sudo systemctl daemon-reload
     sudo systemctl enable --now life-os-bot

5. Tail logs:
     journalctl -u life-os-bot -f
EOF
