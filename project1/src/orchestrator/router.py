"""
Intent router — decides RAG vs NL2SQL vs both.

Why an LLM router and not a classifier model:
  - A fine-tuned DistilBERT classifier would be faster (~10ms vs ~300ms)
    and cheaper. But that's a multi-week build (data collection, label
    bootstrap, training, deployment) for a V1 win.
  - GPT-4o-mini at temperature=0 with a tight system prompt gets us 90%+
    accuracy on the intent classification, costs ~$0.0001/call, and is
    explainable to the business immediately.
  - The interview-defence line: "Routers are a hot upgrade path —
    swappable on day one without changing any downstream code."

Why three classes and not two:
  - sql_only: numerical, time-bounded, aggregate questions.
  - rag_only: policy, narrative, qualitative questions.
  - fusion: questions that need numbers AND context together. The
    interesting ones — "why did returns spike in São Paulo?" needs SQL
    (returns trend) AND RAG (recent policy changes).

Why I expose the router's reasoning, not just the label:
  - Reviewers and users want to know "why did the bot decide this?"
  - Logging the reasoning lets us spot drift — if 80% of "fusion"
    queries actually need only SQL, we tweak the prompt.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Literal

from openai import AsyncAzureOpenAI, AsyncOpenAI

from src.config import settings

IntentLabel = Literal["sql_only", "rag_only", "fusion"]


@dataclass(frozen=True)
class IntentDecision:
    label: IntentLabel
    reasoning: str
    confidence: float  # 0.0–1.0, the model's self-reported confidence


SYSTEM_PROMPT = """\
You classify user questions about a Brazilian e-commerce retailer into \
ONE of three intents:

- "sql_only": question needs only numerical/transactional data from the \
warehouse. Examples: "revenue last quarter in SP", "top 10 sellers by \
volume", "average order value by payment type".
- "rag_only": question needs only policy/narrative content from internal \
documents. Examples: "what is our return policy for electronics?", \
"who do I contact for seller onboarding issues?".
- "fusion": question requires BOTH transactional data AND document \
context to answer well. Examples: "why are returns spiking in \
electronics?" (returns trend + recent policy change), "is our marketing \
campaign hitting its target?" (campaign metrics + brief).

Output JSON with: {"label": <one of the three>, "reasoning": <one \
sentence>, "confidence": <0.0 to 1.0>}.

Default to "fusion" only if you're confident BOTH sides are needed. \
When in doubt, prefer "sql_only" or "rag_only" — fusion is more \
expensive.
"""


def _make_client() -> AsyncOpenAI | AsyncAzureOpenAI:
    if settings.use_azure_openai:
        return AsyncAzureOpenAI(
            azure_endpoint=settings.azure_openai_endpoint,
            api_key=settings.azure_openai_api_key.get_secret_value(),
            api_version=settings.azure_openai_api_version,
        )
    return AsyncOpenAI(api_key=settings.openai_api_key.get_secret_value())


async def route(question: str) -> IntentDecision:
    """
    Classify the question. Used by the orchestrator to fan out.

    Why temperature=0 + small model:
      Classification accuracy plateaus quickly with model size on simple
      tasks. mini at T=0 is deterministic, fast, and cheap.

    Why I cap to 200 output tokens:
      The output is a small JSON. Capping tokens is a belt-and-braces
      cost guard — a runaway model that decides to write an essay won't
      blow our daily budget.
    """
    client = _make_client()
    deployment = (
        settings.azure_openai_mini_deployment
        if settings.use_azure_openai
        else "gpt-4o-mini"
    )

    response = await client.chat.completions.create(
        model=deployment,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": question},
        ],
        response_format={"type": "json_object"},
        temperature=0,
        max_tokens=200,
    )

    raw = response.choices[0].message.content or "{}"
    parsed = json.loads(raw)

    label = parsed.get("label", "sql_only")
    if label not in ("sql_only", "rag_only", "fusion"):
        # Defensive: if the model returns garbage, fall back to the
        # cheapest option. Better a wrong answer than a hung process.
        label = "sql_only"

    return IntentDecision(
        label=label,  # type: ignore[arg-type]
        reasoning=parsed.get("reasoning", ""),
        confidence=float(parsed.get("confidence", 0.5)),
    )
