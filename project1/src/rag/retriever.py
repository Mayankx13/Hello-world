"""
Retrieval interface — Chroma in dev, Azure AI Search in prod.

Why a Protocol-based interface and not just "use Chroma everywhere":
  - Dev uses Chroma because it's in-process and free.
  - Prod uses Azure AI Search because of hybrid (BM25 + vector) + RBAC.
  - The orchestrator should not care which backend is wired up.
  - Protocols (PEP 544) give us structural typing without inheritance.
    This is the modern Python way — no `class MyRetriever(BaseRetriever)`
    inheritance ceremony.

Why two-stage retrieval (vector → reranker):
  Vector similarity is a proxy for relevance, not relevance itself. A
  cross-encoder reranker scores each (query, candidate) pair with full
  attention, which catches the cases where embedding similarity got
  confused. Empirically: +10-15 points on context_precision.

Defence in interview:
  "I'd never ship a single-stage retriever to prod. Two-stage is cheap
   insurance — the reranker call is ~50ms on 8 candidates, and the
   accuracy lift is meaningful enough to show in the eval CSV."
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class RetrievedChunk:
    """
    One result from the retriever.

    Why a dataclass and not a dict:
      - Typed access (`chunk.text` not `chunk["text"]`).
      - IDE autocomplete in the orchestrator.
      - frozen=True: immutable, safe to pass between async tasks.

    Why these fields specifically:
      - text: the content the LLM will use.
      - doc_id + section: the citation. EVERY RAG answer must cite.
      - score: useful for debugging — log it, surface "low confidence"
        when the top result is below threshold.
      - tenant_id: RBAC scaffolding. Even in single-tenant dev we set
        this to `demo-tenant`; in prod the filter is enforced upstream.
    """
    text: str
    doc_id: str
    section: str
    score: float
    tenant_id: str


class Retriever(Protocol):
    """
    Structural type. Anything with this method shape is a Retriever.

    Why async:
      Embedding the query and hitting the vector store are network calls.
      The orchestrator runs them concurrently with the NL2SQL chain in
      the fusion path. sync-blocking here serialises the whole pipeline.
    """

    async def retrieve(
        self,
        query: str,
        tenant_id: str,
        top_k: int = 8,
    ) -> list[RetrievedChunk]:
        ...


class ChromaRetriever:
    """
    Local dev backend. In-process Chroma collection.

    TODO (wk2 day 4-5):
      1. Open Chroma client at settings.chroma_persist_dir.
      2. Use OpenAI embedding (Azure or direct, per settings).
      3. Query with `where={"tenant_id": tenant_id}`.
      4. Run reranker on returned candidates, return top 4.

    Why I scaffold the class but not the body:
      - The signature is the contract. The body is the implementation.
      - Filling in the body without first agreeing on the contract is
        the #1 way junior projects collect "now I need to refactor"
        debt.
    """

    def __init__(self, collection_name: str = "policies") -> None:
        self.collection_name = collection_name

    async def retrieve(
        self,
        query: str,
        tenant_id: str,
        top_k: int = 8,
    ) -> list[RetrievedChunk]:
        raise NotImplementedError("Implement in wk2 day 4-5.")


class AzureAiSearchRetriever:
    """
    Prod backend. Hybrid (BM25 + vector) via Azure AI Search.

    Why hybrid > vector-only in prod:
      - Vector wins on paraphrased questions ("how do I send a parcel
        back" → "return policy").
      - BM25 wins on keyword-exact questions ("what's the SLA on
        category 7?"). The literal "SLA" + "category 7" tokens out-
        score any semantic neighbour.
      - Hybrid = max(vector_score, bm25_score) (Azure default) gets
        both classes of question right.

    TODO (wk4): implement when migrating to Azure.
    """

    def __init__(self, index_name: str) -> None:
        self.index_name = index_name

    async def retrieve(
        self,
        query: str,
        tenant_id: str,
        top_k: int = 8,
    ) -> list[RetrievedChunk]:
        raise NotImplementedError("Implement in wk4 deployment phase.")


def get_retriever() -> Retriever:
    """
    Factory. Reads settings.vector_backend and returns the right one.

    Why a factory and not direct construction in the orchestrator:
      Keeps the prod/dev switch in ONE place. The orchestrator just
      does `retriever = get_retriever()` and never sees the branch.

    Why not a singleton:
      Streamlit re-runs the script on every interaction. A singleton
      pattern here would cache the Chroma client across reruns; we
      use Streamlit's `st.cache_resource` at the UI layer instead,
      which is the right altitude.
    """
    from src.config import settings

    if settings.vector_backend == "chroma":
        return ChromaRetriever()
    if settings.vector_backend == "azure_ai_search":
        return AzureAiSearchRetriever(settings.azure_search_index_name)
    raise ValueError(f"Unknown vector_backend: {settings.vector_backend}")
