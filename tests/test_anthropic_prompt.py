from __future__ import annotations

from datetime import date

from life_os.llm import anthropic_client
from life_os.storage import markdown as md


def test_build_prompt_includes_persona_and_roadmap(paths):
    prompt = anthropic_client.build_prompt(paths, window="now")
    blocks = prompt.system_blocks
    assert len(blocks) >= 2  # persona + at least one roadmap block
    persona_block = blocks[0]
    assert "Mayank" in persona_block["text"]
    assert persona_block["cache_control"]["type"] == "ephemeral"
    # Cache_control on every block so cache hit rate is maximized.
    for block in blocks:
        assert block["cache_control"]["type"] == "ephemeral"


def test_build_prompt_caps_blocks_to_at_most_four(paths):
    prompt = anthropic_client.build_prompt(paths, window="all")
    assert 1 <= len(prompt.system_blocks) <= 4


def test_corpus_window_includes_recent_entries(paths):
    today = date.today()
    p = paths.entries_dir / f"{today.year:04d}" / f"{today.month:02d}" / f"{today.isoformat()}-evening.md"
    md.write(p, {"date": today.isoformat(), "type": "evening"}, "## Wins\n\nshipped life-os\n")
    prompt = anthropic_client.build_prompt(paths, window="all")
    full_text = "\n".join(b["text"] for b in prompt.system_blocks)
    assert "shipped life-os" in full_text
