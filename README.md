# Hello-world
First repository
 
 Hello! Github
 
 I'm Mayank.I love programming and am greatly inspired.Computer systems and their develpment is my core passion.
 Currently i am a student pursuing B.Tech in computer science.
 I'm always keen to explore new technologies and learning them.
 Hopefully i will have a great time on Github learning them and start using to build my own projects.

---

## Life OS

A local-first, single-user system that pairs a phased life roadmap with an interactive journal.
Markdown is the source of truth; SQLite is a regenerable index. The only external dependency is the Anthropic API for `journal ask`.

### What it does

- **Roadmap** — six domain tracks (Body, PerfectGhar venture, Career, Finance, Social, Growth) with dated milestones and definition-of-done. See [`ROADMAP.md`](./ROADMAP.md).
- **Journal CLI** — evening reflection, Sunday weekly review, structured per-domain logs, and an Anthropic-API chat that reasons over the entire corpus.
- **Privacy** — sensitive entries (dating, finances, family) live in a separately `age`-encrypted bucket.
- **Awareness rules** — surfaces drift (skipped domains, repeated avoidance, low-energy streaks) without streak-shaming.

### Quick start

```bash
# 1. Clone and install
git clone https://github.com/Mayankx13/Hello-world.git life-os
cd life-os
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux
pip install -e ".[dev]"

# 2. Verify environment
python scripts/preflight.py

# 3. Set the Anthropic API key (stored in OS keychain)
journal config set-key

# 4. Use it
journal evening                 # ~3-min reflection
journal log body                # structured workout/meal/etc. log
journal weekly                  # Sunday review
journal ask                     # talk to Claude with your full corpus
status                          # phase per domain + this week's commitments
```

### Repo layout

```
ROADMAP.md                  master plan, links to per-domain files
roadmap/                    per-domain markdown (body, perfectghar, career, finance, social, growth)
journal/                    your entries (gitignored), private bucket (age-encrypted), prompt templates
data/                       sqlite index (gitignored, regenerable)
src/life_os/                Python source
scripts/                    setup, reindex, preflight
tests/                      pytest smoke tests
```

### Principles

- Local-first, plain text, portable. Clone to a new machine and everything works.
- Markdown is canonical. SQLite is rebuilt from markdown via `python scripts/reindex.py`.
- No vendor lock-in beyond Anthropic.
- Prompts under 60 seconds. No streak guilt.
- Every roadmap item has a date, an owner (you), and a definition-of-done.
