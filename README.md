# Hello-world
First repository
 
 Hello! Github
 
 I'm Mayank.I love programming and am greatly inspired.Computer systems and their develpment is my core passion.
 Currently i am a student pursuing B.Tech in computer science.
 I'm always keen to explore new technologies and learning them.
 Hopefully i will have a great time on Github learning them and start using to build my own projects.

---

## Survey.html — Behavioral Feedback Survey (v2)

A single-file static HTML survey for warm-audience research on an AI-clone-for-Reels concept. Replaces an earlier sales-shaped survey that produced compliance bias. Aesthetic matches the AiEZ "Voice Study" handoff (cream paper, Fraunces serif, brass accent, page-turn navigation); content is reorganised around behavioral measurement (no price anchoring, Van Westendorp PSM, forced-choice trade-offs, specificity tests, refundable-deposit signal) per the v2 spec.

### Files

| File | Purpose |
|---|---|
| `Survey.html` | The survey. Self-contained HTML with inline CSS+JS. Open directly in a browser or host as a static file (Vercel, Netlify, GitHub Pages). |
| `apps-script.gs` | Google Apps Script backend. Receives `partial` and `submit` POSTs, upserts rows in a Google Sheet keyed by `session_id`. |
| `analysis-template.md` | One-page guide for analysing responses (VW PSM curves, drop-off heatmap, specificity rubric for Q15, Q18 critical-question themes). |

### Local preview

```sh
# any static server works — pick one
python3 -m http.server 8080
# then open http://localhost:8080/Survey.html
```

Or just double-click `Survey.html` to open via `file://`. Submissions log to the browser console while `__APPS_SCRIPT_URL__` is still the placeholder.

### Wiring up the backend (Google Apps Script + Sheets)

1. **Create a Google Sheet.** Note its ID from the URL — the part between `/d/` and `/edit`.
2. **Open Apps Script:** in the sheet, choose `Extensions → Apps Script`. Replace the auto-generated `Code.gs` content with the contents of `apps-script.gs`. Set `SHEET_ID` near the top to the ID from step 1.
3. **Run `setupSheet()` once** from the Apps Script editor. Approve the permissions prompt. This creates a `responses` tab and writes the header row.
4. **Deploy:** `Deploy → New deployment → Type: Web app`. Set:
   - **Execute as:** `Me`
   - **Who has access:** `Anyone` (required so the survey can POST without authentication; the URL is a hard-to-guess `/exec` endpoint, not a secret, but keep it out of public repos).
5. Copy the deployment's `/exec` URL.
6. **Wire the URL:** open `Survey.html`, find the line near the top of `<script>`:
   ```js
   const APPS_SCRIPT_URL = '__APPS_SCRIPT_URL__';
   ```
   Replace `__APPS_SCRIPT_URL__` with the URL from step 5. Re-deploy your static host.

### Behavioral telemetry schema

Every advance fires a `partial` POST; entering the final screen fires a `submit` POST with `is_complete: true`. The Apps Script upserts by `session_id`, so abandoned responses keep their last partial state and completed responses overwrite that with their final values.

| Column | Source |
|---|---|
| `session_id` | `crypto.randomUUID()` minted on landing |
| `started_at_iso`, `submitted_at_iso`, `updated_at_iso` | timestamps |
| `is_complete`, `current_screen` | flow state |
| `q1`, `q3`, `q4` (multi-select JSON + `q4_other`), `q5`, `q_trust` (1–5), `q6` (1–7 gut slider), `q7`–`q18`, `q8b` (post-pricing worry), `q21`, `q19` (deposit), `q20_whatsapp`, `q20_email` | survey answers across 12 plates |
| `total_session_ms` | `performance.now()` since landing |
| `back_count` | times the Back button was clicked |
| `screen_times_json` | per-screen dwell in ms |
| `answer_changed_json` | per-question boolean — true if the value was edited after first input (second-guessing signal) |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` | parsed from `location.search` |
| `referrer`, `device`, `viewport_w` | navigator/window |

Abandoned sessions still send their last state via `navigator.sendBeacon` on `pagehide` and `visibilitychange:hidden`, so you don't lose data when respondents close the tab mid-flow.

### Customising the wordmark

The brand chrome currently reads "A short · *study*". To change it, search for the `<div class="brand">` block in `Survey.html`. The footer imprint is in `<div class="imprint">` near the bottom of the markup.
