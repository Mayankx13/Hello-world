# Project #1 — `retail-genai-copilot`

A GenAI overlay on a real enterprise retail analytics warehouse. Scoped to be defensible in a senior-consulting interview, not a demo.

---

## 1. The 5-line spec

1. **Persona:** a regional category manager at a Brazilian e-commerce retailer who lives in dashboards but waits days for ad-hoc answers.
2. **Promise:** ask any question in English — about returns, revenue, customers, or the company's own policy PDFs — and get a cited, chart-backed answer in under 10 seconds.
3. **Stack:** Azure SQL (warehouse) + Azure Blob (docs) + Azure OpenAI (GPT-4o + `text-embedding-3-small`) + Azure AI Search (hybrid retrieval) + FastAPI orchestrator + Streamlit UI; local dev runs Postgres + Chroma.
4. **GenAI surface:** an intent-routed orchestrator that calls (a) a guarded NL2SQL chain over the warehouse, (b) a RAG pipeline over policy/marketing PDFs, or (c) both, fused into one answer.
5. **Proof:** a 50-question gold set with RAGAS faithfulness + answer-relevance + an exact-match SQL check, published in the README with a public dashboard.

---

## 2. Architecture sketch

```
                          ┌─────────────────────────────┐
                          │     Streamlit chat UI       │
                          │  (charts + cited answers)   │
                          └──────────────┬──────────────┘
                                         │ HTTPS
                          ┌──────────────▼──────────────┐
                          │   FastAPI orchestrator      │
                          │   /ask  →  router(intent)   │
                          └─┬───────────────────────────┘
                            │
        ┌───────────────────┼────────────────────┐
        │                   │                    │
┌───────▼────────┐  ┌───────▼────────┐  ┌────────▼─────────┐
│   RAG chain    │  │  NL2SQL chain  │  │  Fusion answerer │
│ ─────────────  │  │ ────────────── │  │ ──────────────── │
│ retriever      │  │ schema_prompt  │  │ takes both       │
│ → reranker     │  │ → GPT-4o       │  │ contexts and     │
│ → GPT-4o       │  │ → sqlglot      │  │ synthesises ONE  │
│ (with cites)   │  │   validator    │  │ cited answer     │
└───────┬────────┘  │ → executor     │  └──────────────────┘
        │           │ → result→NL    │
        │           └───────┬────────┘
        │                   │
┌───────▼────────┐  ┌───────▼────────┐
│ Azure AI Search│  │   Azure SQL    │
│  (vector +     │  │  (Olist data,  │
│   BM25 hybrid) │  │   8 tables)    │
└───────┬────────┘  └────────────────┘
        │
┌───────▼────────┐
│  Azure Blob    │
│  (policy PDFs, │
│   marketing)   │
└────────────────┘

Cross-cutting:
- Eval harness  →  50-question gold set  →  RAGAS + SQL exact-match  →  CSV + Streamlit dashboard
- Observability  →  structured logs (JSON)  →  prompt/response/latency to a local SQLite
- Auth boundary →  FastAPI dependency that fakes a user-tenant header in dev, RBAC-ready in prod
```

---

## 3. Why every box is in that box (interview defence cheat-sheet)

This is the section recruiters will probe in a 60-min loop. Memorise the *trade-off* version of each answer, not the choice.

### 3.1 Data choice — Brazilian Olist
- **What:** Real e-commerce dataset, ~100K orders, 8 normalised tables (orders, order_items, customers, products, payments, reviews, sellers, geolocation). Public on Kaggle, free, no NDA risk.
- **Why this and not Northwind / Adventure Works:** Olist is multi-table, has real geographic distribution, has actual review text (so RAG isn't synthetic), and is bigger than toy datasets. Saying "I used Adventure Works" reads as a tutorial-follower; saying "I used Olist" reads as someone who picked a dataset on purpose.
- **Why not synthetic:** Synthetic data fails the "would a real recruiter trust this?" sniff test. Olist transactions are real consumer behaviour, which makes the NL2SQL results actually interesting.

### 3.2 Warehouse — Azure SQL DB (not Synapse / Fabric for v1)
- **What:** A single Azure SQL DB instance, S2 tier (~$30/month) for the project.
- **Why not Synapse:** Synapse is for petabyte-scale; Olist is 100MB. Using Synapse for a 100MB dataset is the "I'm trying to impress" smell that experienced architects spot instantly.
- **Why not Fabric:** Fabric is the future-state Microsoft is pushing, but it's still maturing and adds a complexity layer for no v1 win. Note in the README: "Fabric is a one-week migration once stable."
- **Defence line:** *"Azure SQL right-sizes the data; the architecture stays portable to Synapse/Fabric because I built against SQL, not against Synapse-specific syntax."*

### 3.3 Unstructured corpus — synthetic policy + marketing PDFs
- **What:** ~20 PDFs we generate ourselves: return policies by category, marketing campaign briefs, seller onboarding docs.
- **Why generate them:** Olist has no native PDFs. Marketing/policy docs are what every real enterprise RAG project is about — generating them is faithful to the use case, not a shortcut.
- **Honesty in the writeup:** README explicitly says "synthetic PDFs, generated to mirror real retail-industry docs", with the generation prompts checked in. Lies of omission are worse than synthetic data.

### 3.4 Embeddings — `text-embedding-3-small`
- **What:** OpenAI's small embedding model, 1536 dims, $0.02 per 1M tokens.
- **Why not `-large`:** Large is 3x cost for ~5% retrieval quality on short documents. For retail policy text (avg 500 tokens), small is the right Pareto point.
- **Why not open-source (e.g. `bge-small-en`):** Open-source is genuinely competitive, but for an Azure-OpenAI-first project, using Azure embeddings keeps the deployment story one-cloud. Defensible alt: "in prod we'd benchmark `bge-large-en-v1.5` against `text-embedding-3-large` on our own data."

### 3.5 Vector store — Chroma local, Azure AI Search prod
- **Chroma local because:** in-process, zero infra, hash-on-disk, ideal for dev. Lets us iterate retrieval logic without billing.
- **Azure AI Search prod because:** hybrid retrieval (BM25 + vector) out of the box, RBAC via tenant filtering, indexer auto-pulls from Blob. Enterprise customers want hybrid + RBAC — pure vector loses on policy questions like "what's the SLA?" because BM25 catches the keyword cleanly while vectors don't.
- **Defence line:** *"Vector-only loses on keyword-exact retrieval. Hybrid is the enterprise default for a reason."*

### 3.6 Retrieval — top-k=8, then rerank to top-4
- **Why two-stage:** Embedding similarity is good but noisy. A reranker (we use `cross-encoder/ms-marco-MiniLM-L-6-v2` locally; Cohere Rerank in prod) re-scores the 8 candidates by direct query-document attention. Empirically this lifts answer faithfulness by ~10-15 points.
- **Why not top-20:** Diminishing returns; GPT-4o context cost goes up linearly; reranker latency goes up.
- **Defence line:** *"Retrieval is the bottleneck of every RAG system. Two-stage is cheap insurance."*

### 3.7 NL2SQL — GPT-4o + `sqlglot` validator
- **Why not Vanna / DataHerald / SQLCoder:** Those are great, but using them = "I used a library." Building the chain ourselves with a serialised schema prompt + few-shot bank + validator = "I understand the failure modes."
- **`sqlglot` validator does three things:**
  1. Parses the generated SQL — catches malformed output.
  2. Whitelists allowed tables — prevents prompt-injection ("ignore previous instructions and DROP TABLE...").
  3. Caps result size with `LIMIT 1000` if absent — protects warehouse from runaway queries.
- **Defence line:** *"An LLM emitting SQL is a security boundary. The validator is non-negotiable."*

### 3.8 Schema serialisation — YAML catalog, not raw `INFORMATION_SCHEMA` dump
- **What:** A hand-curated `schema_catalog.yaml` with table descriptions, column descriptions, sample values, and notable joins.
- **Why:** Raw schema dumps don't tell the LLM that `order_status='delivered'` means "completed" or that `customer_state` uses 2-letter codes. Curated schema doubles SQL accuracy on our gold set.
- **Defence line:** *"The schema catalog is the single highest-leverage thing in NL2SQL. Without it, the LLM has to guess your business semantics."*

### 3.9 Orchestration — LangGraph (not LangChain LCEL agents)
- **Why LangGraph:** Explicit state graph. You can see the nodes and edges. Debuggable. Streams intermediate states to the UI.
- **Why not LangChain `AgentExecutor`:** It hides the control flow inside the agent loop, which makes failures hard to triage. LangGraph is the same team's answer to that.
- **Defence line:** *"Agents that you can't introspect are agents you can't ship to an enterprise."*

### 3.10 Intent router — small LLM call, not classifier model
- **Why:** Training a classifier is 20× the work for a v1 win that GPT-4o-mini gives you for $0.0001/call.
- **Honest caveat:** for high-QPS prod, swap to a fine-tuned DistilBERT classifier. Note this in the README.

### 3.11 UI — Streamlit
- **Why:** Python-native, ships in 200 lines, has built-in chart support and `st.chat_message`.
- **Defensible upgrade path:** "For a consumer-grade UI we'd swap to Next.js + Vercel AI SDK calling the same FastAPI endpoints — the API contract was designed UI-agnostic."

### 3.12 Backend — FastAPI
- **Why not Flask:** Async-first (matters for streaming LLM responses), Pydantic-native (request/response validation for free), auto-generated OpenAPI spec (your prod team can wire it up without docs).
- **Why not direct Streamlit-only:** Decoupling UI from logic means the same backend can serve a Slack bot, a Teams app, or a future Next.js front-end without rewriting.

### 3.13 Evaluation — RAGAS + SQL exact-match + a gold set
- **The 50 questions:** 20 SQL-only, 20 RAG-only, 10 fusion. Hand-written, with expected answers.
- **RAGAS metrics:** `faithfulness` (does the answer cite real context?), `answer_relevance` (does the answer address the question?), `context_precision` (are retrieved chunks actually relevant?).
- **SQL exact-match:** compare normalised result-sets (sorted, deduplicated). Tolerant to SQL phrasing differences.
- **Why this is the senior signal:** Anyone can build a demo. *Measuring* it puts you above 90% of GenAI portfolios. **This is the slide you open the interview with.**

### 3.14 Observability — structured JSON logs → SQLite
- **What:** Every `/ask` call logs prompt, retrieved context, generated SQL, final answer, latency, token cost.
- **Why:** Enterprise GenAI's #1 ask is "show me what the model did." Logging is the answer.
- **Defence line:** *"If you can't replay a question, you can't debug a production incident."*

### 3.15 Auth — fake tenant header in dev, RBAC-ready
- **What:** Every request carries a `X-Tenant-Id` header. Retrieval filters chunks by tenant. SQL queries are scoped via a WHERE clause injected by the validator.
- **Why even in a portfolio:** Multi-tenant data isolation is the #1 question every enterprise security review asks. Showing you thought about it = senior signal.

---

## 4. Build steps (4-week sprint, 20+ hrs/week)

> **Cadence:** end each week with a 10-min Loom walkthrough committed to `/walkthroughs/wk-N.md` (link to video). This builds your "Featured" content as a byproduct of building.

### Week 1 — Foundations (target: data flows end-to-end, no AI yet)

| Day | Task | Output |
|----:|------|--------|
| 1 | Repo bootstrap: `pyproject.toml`, `ruff`, `mypy`, pre-commit, `.env.example`, `docker-compose.yml` for Postgres + Chroma. | Green CI on push. |
| 2 | Download Olist (Kaggle CLI), write `data_loader.py` to load 8 tables into Postgres with proper FKs. | `select count(*) from orders` returns 99441. |
| 3 | Hand-write `schema_catalog.yaml` with table/column descriptions, sample values, join hints. | File checked in, 8 tables documented. |
| 4-5 | Generate 20 synthetic PDFs (use Claude API with a `pdf_generator.py` script — return policies per category, marketing briefs, seller policies). | `/docs` folder has 20 PDFs, generation prompts committed. |
| 6 | Wire up FastAPI app skeleton with `/health` + `/ask` (stubbed). Streamlit UI skeleton that hits `/health`. | UI loads, says "backend OK". |
| 7 | Provision Azure SQL DB (S2). Migrate Olist tables to it via `bcp` or a script. Provision Blob and upload PDFs. | Azure resources tagged with `proj=retail-copilot`. |

**Week 1 interview-defence checkpoint:** "I have an enterprise warehouse, an enterprise doc store, and an API surface. The GenAI is the next layer, not the foundation."

### Week 2 — RAG (target: ask a doc question, get a cited answer)

| Day | Task | Output |
|----:|------|--------|
| 1 | PDF parsing (`pypdf`), text extraction, metadata extraction (title, section, category). | `chunker.py` produces structured chunks. |
| 2 | Chunking strategy: semantic (sentence-window, 400 tokens, 50 overlap). Justify the numbers in code comments. | `chunker.py` with reasoning. |
| 3 | Embedding pipeline: Azure OpenAI `text-embedding-3-small`, batched, retried with exponential backoff. | Vectors land in Chroma; cost-per-PDF logged. |
| 4 | Retrieval with metadata filters (e.g., `category=electronics`). | Top-k=8 returned for test queries. |
| 5 | Reranker (cross-encoder via `sentence-transformers`). Top-4 after rerank. | Rerank lifts MRR on a 10-q dev set. |
| 6 | Answer generation: GPT-4o, prompt with citations (`[doc_id: section]`). | `/ask` returns cited answer for doc qs. |
| 7 | First Loom: "RAG pipeline walkthrough." Commit transcript. | `walkthroughs/wk-2.md` + video URL. |

### Week 3 — NL2SQL (target: ask a number question, get a result)

| Day | Task | Output |
|----:|------|--------|
| 1 | Schema serialisation: `schema_catalog.yaml` → prompt-ready text block, ≤6k tokens. | `schema_prompt.py` |
| 2 | Few-shot bank: 10 hand-written (question, SQL) pairs covering joins, aggregations, date filters, top-N. | `few_shots.yaml` |
| 3 | SQL generator: GPT-4o, structured output (`response_format=json` with `sql` and `reasoning` fields). | `generator.py` |
| 4 | Validator: `sqlglot` parse, table whitelist, `LIMIT` injection, dialect check (Postgres dev, T-SQL prod). | `validator.py` with tests. |
| 5 | Executor: connection-pooled, read-only role, 10-second statement timeout. | `executor.py` |
| 6 | Result-to-NL summariser + auto-chart picker (line for time-series, bar for categorical). | `summariser.py` |
| 7 | Second Loom. | `walkthroughs/wk-3.md` |

### Week 4 — Orchestrator, eval, deploy, polish

| Day | Task | Output |
|----:|------|--------|
| 1 | Intent router: GPT-4o-mini, classifies into `{sql, rag, fusion}`. | `router.py` |
| 2 | Fusion answerer: combines SQL result + RAG context into a single answer. | `fusion.py` |
| 3 | Gold set: 50 questions in YAML. 20 SQL, 20 RAG, 10 fusion. Expected answers. | `eval/gold_set.yaml` |
| 4 | Eval runner: RAGAS for RAG, exact-match for SQL, scored fusion. CSV out + Streamlit dashboard. | `eval/runner.py`, `eval/results.csv` |
| 5 | Deploy: Azure Container Apps (backend) + Azure Static Web Apps (Streamlit). Bicep templates committed. | Live URL. |
| 6 | README: architecture diagram (excalidraw), eval results, cost breakdown, "honest limitations". | Polished README. |
| 7 | LinkedIn writeup (1,200 words). Featured tile #1 goes live. | Published article. |

---

## 5. Stack & cost summary

| Layer | Dev (free / cheap) | Prod (Azure) | Monthly $ |
|-------|--------------------|---------------|----------:|
| Warehouse | Postgres in Docker | Azure SQL DB S2 | $30 |
| Vector store | Chroma (in-process) | Azure AI Search Basic | $75 |
| Doc store | Local `/docs` | Azure Blob (Hot) | $1 |
| LLM | Azure OpenAI dev key | Azure OpenAI prod key | $20 (eval) + variable |
| Embeddings | Azure OpenAI | Azure OpenAI | $1 |
| Backend host | local | Azure Container Apps (Consumption) | $10 |
| Frontend host | local Streamlit | Azure Static Web Apps | $0 (free tier) |
| **Total prod** | | | **~$140 / month** |

> Cost transparency in the README is itself a senior signal — it's the thing every enterprise asks and most portfolios duck.

---

## 6. Repo structure (scaffolded under `/project1/`)

```
project1/
├── README.md
├── .env.example
├── .gitignore
├── requirements.txt
├── docker-compose.yml
└── src/
    ├── config.py
    ├── data_loader.py
    ├── schema_catalog.yaml
    ├── rag/
    │   └── retriever.py
    ├── nl2sql/
    │   ├── generator.py
    │   └── validator.py
    ├── orchestrator/
    │   └── router.py
    ├── ui/
    │   └── app.py
    └── eval/
        ├── gold_set.yaml
        └── runner.py
```

Each file ships with **why** comments at the top — not what-the-code-does comments, but **what the design choice is and how to defend it**.

---

## 7. Honest limitations (put this in the README too)

A senior portfolio is one that admits limits. Include all of these:

- **Synthetic PDFs:** Generation prompts and the seed model (Claude) are committed. Real enterprise docs would be ~10× messier.
- **Single tenant in v1:** RBAC scaffolding is there; multi-tenant retrieval testing is not.
- **No fine-tuning:** Eval shows GPT-4o + a good schema prompt gets us to ~85% SQL accuracy. Fine-tuning is the obvious v2 if accuracy plateaus.
- **No streaming responses in v1:** FastAPI supports SSE; UI doesn't consume it yet.
- **Eval set is small (50q):** Industry-grade NL2SQL evals (Spider, BIRD) have 1k+ questions. v2 is to plug into BIRD-mini.

---

## 8. What you will be able to say in an interview after this ships

> *"I built a RAG-and-NL2SQL copilot on top of a real retail warehouse on Azure. The bit I'm most proud of is the eval harness — 50 hand-written questions across SQL, RAG, and fusion, scored with RAGAS and exact-match SQL. It's what let me iterate on chunking, reranking, and prompt design with actual numbers, not vibes. Want me to walk you through the failure modes I found and what I changed?"*

That last sentence — inviting them into your failure analysis — is the senior move. Anyone can show a demo. Only people who shipped one can tell you what broke.
