"""
Streamlit chat UI.

Why Streamlit and not Next.js / Gradio:
  - Streamlit is Python-native: zero context-switch from the rest of
    the codebase.
  - `st.chat_message` + `st.chat_input` give us a real chat surface in
    ~20 lines.
  - Native chart support (st.plotly_chart) means SQL results render as
    interactive charts inline.
  - Trade-off: it's not the prettiest. For a portfolio piece that's
    fine; for a customer-facing prod app we'd swap to Next.js calling
    the same FastAPI backend. THIS upgrade path is the interview-
    defence line: "UI was deliberately decoupled from logic so the
    swap is a one-week front-end project, not a rebuild."

Why I hit a FastAPI backend instead of calling the chains directly
from Streamlit:
  - Streamlit reruns the script top-to-bottom on every interaction.
    Embedding the LLM logic here would mean re-instantiating clients,
    reloading the schema catalog, etc. on every keystroke.
  - More importantly: the API is the contract. The same /ask endpoint
    will eventually serve a Slack bot, a Teams app, a Next.js front.
    UI-coupled logic blocks those.

Defence in interview:
  "Streamlit is the right choice for V1 because it lets me focus my
   token budget on RAG/NL2SQL quality. The UI is interchangeable; the
   eval harness and the validator are not."
"""

from __future__ import annotations

import httpx
import streamlit as st


BACKEND_URL = "http://localhost:8000"


@st.cache_resource
def _http_client() -> httpx.Client:
    """
    Why st.cache_resource:
      Streamlit reruns the whole script on every user interaction.
      Without caching, we'd open a fresh httpx Client on every keystroke,
      which leaks file descriptors and is measurably slow on a 100ms
      typing cadence.

    Why httpx and not requests:
      httpx is the modern choice — http/2 support, async-capable, same
      API surface. The sync interface here is fine for Streamlit's sync
      model.
    """
    return httpx.Client(base_url=BACKEND_URL, timeout=60.0)


def _render_message(role: str, content: dict) -> None:
    """
    Render one message bubble.

    Why the content dict and not a plain string:
      Bot messages carry structured data — the SQL it ran, the chart
      to plot, the citations from RAG. A plain string would collapse
      all of that into prose; the structured form lets us render each
      part with the right widget.
    """
    with st.chat_message(role):
        st.markdown(content.get("answer", ""))

        # Show SQL + chart if present
        if sql := content.get("sql"):
            with st.expander("SQL executed"):
                st.code(sql, language="sql")
        if chart := content.get("chart"):
            # chart is a plotly figure dict — st handles it natively.
            st.plotly_chart(chart, use_container_width=True)

        # Show citations if present
        if citations := content.get("citations"):
            with st.expander("Sources"):
                for cite in citations:
                    st.markdown(f"- **{cite['doc_id']}** — {cite['section']}")

        # The "why did the bot decide that" expander — surfaces the
        # router's reasoning. This is the trust-building move.
        if reasoning := content.get("router_reasoning"):
            with st.expander("Routing decision"):
                st.markdown(f"*{reasoning}*")


def main() -> None:
    st.set_page_config(page_title="Retail GenAI Copilot", layout="wide")
    st.title("Retail GenAI Copilot")
    st.caption(
        "Ask about sales, orders, returns, or company policies. "
        "I'll fetch numbers from the warehouse, context from the docs, "
        "or both."
    )

    # Session state is Streamlit's per-user memory. Survives reruns
    # within a session, resets on browser refresh.
    if "messages" not in st.session_state:
        st.session_state.messages = []

    # Replay history (Streamlit reruns the script — we re-render each turn).
    for msg in st.session_state.messages:
        _render_message(msg["role"], msg["content"])

    if prompt := st.chat_input("Ask a question…"):
        st.session_state.messages.append(
            {"role": "user", "content": {"answer": prompt}}
        )
        _render_message("user", {"answer": prompt})

        with st.chat_message("assistant"):
            with st.spinner("Thinking…"):
                # The backend /ask endpoint will be built in wk1 day 6
                # (FastAPI skeleton) and filled out across wk2-4.
                try:
                    resp = _http_client().post("/ask", json={"question": prompt})
                    resp.raise_for_status()
                    payload = resp.json()
                except httpx.HTTPError as e:
                    payload = {
                        "answer": f"Backend error: {e}. Is the FastAPI "
                        "server running on :8000?"
                    }

        st.session_state.messages.append(
            {"role": "assistant", "content": payload}
        )
        _render_message("assistant", payload)


if __name__ == "__main__":
    main()
