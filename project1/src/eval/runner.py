"""
Evaluation harness — runs the gold set, scores every answer.

Why this file is the project's secret weapon:
  Demos win nothing in senior interviews. Numbers do. Every model
  swap, every prompt tweak, every chunking change gets a CSV diff:
  "+2.3 faithfulness, -1.1 latency". That's the conversation no
  other GenAI-overlay portfolio is having.

Three metric families:
  1. SQL exact-match: result-set equivalence (sorted, deduped) between
     the model's SQL and the expected SQL. Catches "right answer, ugly
     query" and "wrong answer, pretty query" symmetrically.
  2. RAGAS (faithfulness, answer_relevance, context_precision):
     - faithfulness: does the answer cite real retrieved context?
     - answer_relevance: does the answer address the question?
     - context_precision: are the retrieved chunks actually relevant?
  3. Operational: latency, token cost. Senior signal — recruiters
     check these.

Why I write the runner before the chains are done:
  The eval contract IS the contract for the chains. Writing it first
  forces the rest of the system to honour it. Inverting that order
  is how projects ship "we'll add evals later" and never do.

Defence in interview:
  "I started with the eval. Most GenAI portfolios end with one, if at
   all. Starting with it forced every downstream component to be
   measurable — the chains return structured outputs the runner can
   score, the retriever returns chunks with doc_ids, the router emits
   labels. Without the eval-first discipline, none of that gets shaped
   correctly."
"""

from __future__ import annotations

import asyncio
import csv
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any

import yaml

# Eval runner deliberately does NOT import the chains yet. We wire it
# up in week 4. The runner shape is locked first so the chains know
# what to return.


@dataclass
class EvalResult:
    question_id: str
    category: str
    sql_match: float  # 1.0 = exact, 0.5 = partial, 0.0 = miss
    faithfulness: float
    answer_relevance: float
    context_precision: float
    latency_ms: int
    token_cost_usd: float
    notes: str = ""


def load_gold_set(path: Path) -> list[dict[str, Any]]:
    """Why this is a thin wrapper: testability + future remote sources."""
    with path.open() as f:
        return yaml.safe_load(f)["questions"]


def compare_result_sets(actual: list[tuple], expected: list[tuple]) -> float:
    """
    Why result-set comparison and not SQL string match:
      "SELECT COUNT(*) FROM o" and "SELECT COUNT(o.order_id) FROM o" are
      different strings, same answer. String-match would falsely penalise
      the model. Result-set comparison is the only honest metric.

    Why we sort + dedupe before comparing:
      SQL is set-semantics by default. ORDER BY is presentation; we don't
      penalise the model for picking a different order.

    Returns 1.0 (exact), 0.5 (overlap), or 0.0 (miss).
    """
    actual_set = {tuple(row) for row in actual}
    expected_set = {tuple(row) for row in expected}
    if actual_set == expected_set:
        return 1.0
    intersection = actual_set & expected_set
    if not intersection:
        return 0.0
    # Jaccard as a partial-credit proxy.
    union = actual_set | expected_set
    return round(len(intersection) / len(union), 2)


async def evaluate_question(question: dict[str, Any]) -> EvalResult:
    """
    Run one question through the full pipeline. Score it.

    TODO (wk4):
      1. Call the orchestrator /ask endpoint (or call the chains
         directly if we want to bypass the network).
      2. Diff returned SQL result-set against expected.
      3. Call RAGAS metrics on (question, answer, retrieved_contexts).
      4. Pull latency + token cost from the response envelope.
    """
    start = time.monotonic()
    # Placeholder while chains are stubbed:
    elapsed = int((time.monotonic() - start) * 1000)
    return EvalResult(
        question_id=question["id"],
        category=question["category"],
        sql_match=0.0,
        faithfulness=0.0,
        answer_relevance=0.0,
        context_precision=0.0,
        latency_ms=elapsed,
        token_cost_usd=0.0,
        notes="Stub — implement wk4 day 4.",
    )


async def run() -> None:
    """
    Top-level eval loop.

    Why async with `asyncio.gather`:
      Eval over 50 questions is 50 LLM round-trips. Sequential = ~5 min.
      Concurrent = ~30s. We rate-limit downstream (the chain) but the
      runner shouldn't be the bottleneck.

    Why a CSV output and not a DB:
      CSVs diff cleanly in git. Every eval run gets committed with the
      change that triggered it. That commit history IS the experiment
      log. No "let me check the dashboard" — just `git log eval/results.csv`.
    """
    gold = load_gold_set(Path(__file__).parent / "gold_set.yaml")
    results = await asyncio.gather(
        *(evaluate_question(q) for q in gold)
    )

    out_path = Path(__file__).parent / "results.csv"
    with out_path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=asdict(results[0]).keys())
        writer.writeheader()
        for r in results:
            writer.writerow(asdict(r))

    print(f"Wrote {len(results)} results to {out_path}")
    _print_summary(results)


def _print_summary(results: list[EvalResult]) -> None:
    """
    Console-friendly aggregate. Same numbers we'd surface on the
    Streamlit eval dashboard.
    """
    by_cat: dict[str, list[EvalResult]] = {}
    for r in results:
        by_cat.setdefault(r.category, []).append(r)

    for cat, rs in by_cat.items():
        n = len(rs)
        avg_sql = sum(r.sql_match for r in rs) / n
        avg_faith = sum(r.faithfulness for r in rs) / n
        avg_rel = sum(r.answer_relevance for r in rs) / n
        avg_lat = sum(r.latency_ms for r in rs) / n
        print(
            f"[{cat:10}] n={n:2}  sql={avg_sql:.2f}  "
            f"faith={avg_faith:.2f}  rel={avg_rel:.2f}  "
            f"latency_ms={avg_lat:.0f}"
        )


if __name__ == "__main__":
    asyncio.run(run())
