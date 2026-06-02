"""
NL → SQL generator.

Why this is its own module, separate from the validator and executor:
  Generation is "creative". Validation is "rules". Execution is "I/O".
  Mixing them = harder to unit-test, harder to swap the LLM, harder to
  add a different validation backend later. Three single-responsibility
  modules beat one "sql_chain.py" 600-line god-file.

Why structured output (JSON with `sql` + `reasoning`) and not raw text:
  - `reasoning` is the LLM's chain-of-thought, logged for debuggability
    and shown to the user as a "why did the bot do that?" expander.
  - `sql` is parsed downstream. Without structured output we'd have to
    regex it out of a markdown code block — fragile and a source of
    silent failures when the LLM changes formatting.

Why GPT-4o and not GPT-4o-mini for SQL:
  Mini is good enough for intent routing (3-way classification) but
  measurably worse on multi-join, multi-aggregation SQL. The cost
  delta is $0.005 vs $0.0003 per call — irrelevant against a single
  business analyst's salary.

Defence in interview:
  "The SQL generator alone is the easy part. What makes this production-
   shaped is (a) the schema_catalog priming the prompt with business
   semantics, (b) structured-output JSON so the downstream code never
   parses prose, and (c) a few-shot bank that teaches the model what
   `last quarter` means in our timezone."
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml
from openai import AsyncAzureOpenAI, AsyncOpenAI

from src.config import settings


@dataclass(frozen=True)
class SqlCandidate:
    """The generator's output, pre-validation."""
    sql: str
    reasoning: str
    estimated_tokens: int


SYSTEM_PROMPT = """\
You are a senior data analyst writing SQL for a Brazilian e-commerce \
warehouse on Postgres. You return JSON with exactly two keys: "sql" \
(a single SELECT statement, no trailing semicolon) and "reasoning" \
(a one-paragraph explanation of your approach).

Rules — these are not negotiable:
1. Only SELECT. Never INSERT, UPDATE, DELETE, DROP, ALTER, CREATE.
2. Only tables listed in the schema catalog below. Never query system \
catalogs (information_schema, pg_catalog).
3. If the question requires data you don't have, return \
{"sql": "", "reasoning": "Missing: <what>"} — do not hallucinate \
columns.
4. Default to LIMIT 100 unless the user explicitly asks for more or \
the answer is a single aggregate.
5. Use the column descriptions in the catalog as ground truth. If a \
column's sample_values are listed, treat them as the complete enum.
6. Date filters: "last quarter" means the calendar quarter ending the \
most recent completed Sunday. Use date_trunc('quarter', current_date) \
as the anchor.
7. All money is BRL.

SCHEMA CATALOG:
{schema_catalog}

FEW-SHOT EXAMPLES:
{few_shots}
"""


def _load_schema_text() -> str:
    """
    Load the schema_catalog.yaml and render it as a compact prompt block.

    Why I render here and don't cache:
      The catalog is ~3-5k tokens, loaded once per process. Caching is
      premature optimisation. If we ever hit catalog reloads being the
      bottleneck, we add @lru_cache.
    """
    path = Path(__file__).parent.parent / "schema_catalog.yaml"
    with path.open() as f:
        catalog = yaml.safe_load(f)

    lines: list[str] = []
    for table_name, table in catalog["tables"].items():
        lines.append(f"\n## {table_name}")
        lines.append(table.get("description", "").strip())
        if "join_hints" in table:
            lines.append(f"Joins: {table['join_hints'].strip()}")
        lines.append("Columns:")
        for col_name, col in table["columns"].items():
            samples = col.get("sample_values")
            sample_str = f" Examples: {samples}." if samples else ""
            lines.append(
                f"  - {col_name} ({col['type']}): {col['description']}{sample_str}"
            )
    return "\n".join(lines)


def _load_few_shots() -> str:
    """
    Load (question, sql) examples that teach the model our conventions.

    TODO (wk3 day 2): write 10 hand-crafted examples into
    src/nl2sql/few_shots.yaml. Cover: simple count, join+aggregate,
    date filter, top-N, multi-level group-by.

    Why hand-crafted and not auto-generated:
      - The whole point is to teach the model our preferred SQL style
        (snake_case aliases, no SELECT *, CTEs over nested subqueries).
      - Auto-generated examples mostly teach the model to imitate its
        own bad habits.
    """
    return "(few-shot examples to be filled in week 3 day 2)"


def _make_client() -> AsyncOpenAI | AsyncAzureOpenAI:
    """
    Build the right OpenAI client based on settings.

    Why async client:
      - The orchestrator may run NL2SQL and RAG concurrently. A sync
        client would block the event loop and serialise them.
    """
    if settings.use_azure_openai:
        return AsyncAzureOpenAI(
            azure_endpoint=settings.azure_openai_endpoint,
            api_key=settings.azure_openai_api_key.get_secret_value(),
            api_version=settings.azure_openai_api_version,
        )
    return AsyncOpenAI(api_key=settings.openai_api_key.get_secret_value())


async def generate_sql(question: str) -> SqlCandidate:
    """
    Generate a SQL candidate for the given natural-language question.

    Why response_format=json_object and not just-prompt-for-JSON:
      Modern OpenAI/Azure OpenAI models enforce JSON output server-side
      when this is set. Without it, you get 99% JSON + 1% "Sure! Here's
      the SQL:" prose — and that 1% blows up json.loads().

    Why temperature=0:
      SQL is a closed-vocabulary task. Sampling diversity doesn't help
      and hurts reproducibility. The interview-defence line:
      "Generation tasks where there's a single correct output should
       always be temperature 0."
    """
    client = _make_client()
    deployment = (
        settings.azure_openai_chat_deployment
        if settings.use_azure_openai
        else "gpt-4o"
    )

    system = SYSTEM_PROMPT.format(
        schema_catalog=_load_schema_text(),
        few_shots=_load_few_shots(),
    )

    response = await client.chat.completions.create(
        model=deployment,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": question},
        ],
        response_format={"type": "json_object"},
        temperature=0,
    )

    raw = response.choices[0].message.content or "{}"
    parsed: dict[str, Any] = json.loads(raw)

    # Why .get with a fallback rather than `parsed["sql"]`:
    #   Even with response_format=json_object, malformed responses
    #   happen on rare model errors. Better to surface a clean SqlCandidate
    #   with empty SQL than a KeyError that nukes the request.
    return SqlCandidate(
        sql=parsed.get("sql", "").strip(),
        reasoning=parsed.get("reasoning", "").strip(),
        estimated_tokens=response.usage.total_tokens if response.usage else 0,
    )
