# `retail-genai-copilot`

A GenAI copilot that sits on top of a real e-commerce data warehouse and answers natural-language questions by either querying the database (NL2SQL), retrieving from policy/marketing docs (RAG), or fusing both.

Built on Azure (OpenAI, SQL DB, AI Search, Blob, Container Apps). Local dev runs on Postgres + Chroma so you can iterate without spending cloud credits.

> Full design rationale is in `../project1_spec.md`. This README is the operator manual.

---

## Why this project exists

Enterprises sit on two kinds of data:
1. **Structured** — transactions, customers, products in a warehouse.
2. **Unstructured** — policy PDFs, marketing briefs, contracts in a doc store.

Every "let's add GenAI to our data" project hits the same wall: the LLM either knows about (1) or (2), rarely both, and almost never with the security + observability an enterprise needs. This project shows the architecture and discipline to do it properly.

---

## Quickstart (local dev — 10 minutes from clone to first query)

```bash
# 1. Clone + venv
git clone <your-fork>
cd project1
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 2. Spin up local Postgres + Chroma
docker-compose up -d

# 3. Configure env
cp .env.example .env
# Edit .env with your Azure OpenAI keys (or set USE_AZURE_OPENAI=false to use OpenAI direct)

# 4. Load Olist into Postgres
python -m src.data_loader

# 5. Generate + index the synthetic PDFs
python -m src.rag.indexer  # not scaffolded — Week-2 task

# 6. Run the API
uvicorn src.ui.api:app --reload --port 8000  # not scaffolded — Week-1 task

# 7. Run the Streamlit UI in another shell
streamlit run src/ui/app.py
```

---

## Architecture

```
Streamlit UI
    │
    ▼
FastAPI orchestrator  ──► intent_router  ──► RAG  /  NL2SQL  /  fusion
                                              │        │
                                              ▼        ▼
                                          AI Search   Azure SQL
                                              │        ▲
                                              ▼        │
                                            Blob     warehouse
```

See `../project1_spec.md` §2 for the full diagram and box-by-box defence notes.

---

## What's scaffolded vs what's left to build

| File | Status | Build week |
|------|--------|------------|
| `src/config.py` | ✅ scaffolded | wk1 |
| `src/data_loader.py` | ✅ scaffolded (Olist loader skeleton) | wk1 |
| `src/schema_catalog.yaml` | ✅ scaffolded (8 Olist tables documented) | wk1 |
| `src/rag/retriever.py` | ✅ scaffolded (interface + Chroma stub) | wk2 |
| `src/nl2sql/generator.py` | ✅ scaffolded (prompt + structured output) | wk3 |
| `src/nl2sql/validator.py` | ✅ scaffolded (sqlglot guards) | wk3 |
| `src/orchestrator/router.py` | ✅ scaffolded (intent classifier) | wk4 |
| `src/ui/app.py` | ✅ scaffolded (Streamlit chat skeleton) | wk1 |
| `src/eval/gold_set.yaml` | ✅ scaffolded (5 sample questions; needs 50) | wk4 |
| `src/eval/runner.py` | ✅ scaffolded (RAGAS + SQL exact-match) | wk4 |
| Embedding pipeline | ⏳ Week 2 | wk2 |
| Chunker | ⏳ Week 2 | wk2 |
| Reranker | ⏳ Week 2 | wk2 |
| SQL executor | ⏳ Week 3 | wk3 |
| Fusion answerer | ⏳ Week 4 | wk4 |
| Azure Bicep deploy | ⏳ Week 4 | wk4 |
| Observability/logging | ⏳ Week 4 | wk4 |

---

## Cost ceiling (prod)

Capped at ~$140/month. See spec §5 for the breakdown. The `.env` has `MAX_TOKENS_PER_QUERY` and `MAX_QUERIES_PER_DAY` defaults — they're not theatre, they're real caps wired into the FastAPI middleware.

---

## Honest limitations

See spec §7. tl;dr: synthetic PDFs, single tenant in v1, no fine-tuning yet, 50-q eval set is small.
