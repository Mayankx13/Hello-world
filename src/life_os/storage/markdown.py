"""Markdown frontmatter read/write helpers.

Markdown is the source of truth. This module is the only place that parses
or writes frontmatter; everything else goes through these functions.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

import frontmatter
import yaml


@dataclass
class MarkdownDoc:
    path: Path
    metadata: dict[str, Any]
    body: str

    def title(self) -> str | None:
        for line in self.body.splitlines():
            stripped = line.strip()
            if stripped.startswith("# "):
                return stripped[2:].strip()
        return self.metadata.get("title")


def _yaml_default(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Path):
        return str(value)
    raise TypeError(f"Cannot serialize {type(value).__name__} to YAML")


class _SafeDumper(yaml.SafeDumper):
    pass


def _date_representer(dumper: yaml.SafeDumper, data: date) -> yaml.ScalarNode:
    return dumper.represent_scalar("tag:yaml.org,2002:str", data.isoformat())


_SafeDumper.add_representer(date, _date_representer)
_SafeDumper.add_representer(datetime, _date_representer)


def read(path: Path) -> MarkdownDoc:
    """Parse a markdown file with YAML frontmatter."""
    raw = path.read_text(encoding="utf-8")
    post = frontmatter.loads(raw)
    return MarkdownDoc(path=path, metadata=dict(post.metadata), body=post.content)


def write(path: Path, metadata: dict[str, Any], body: str) -> None:
    """Write a markdown file with YAML frontmatter, ensuring parents exist."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fm = yaml.dump(
        metadata,
        Dumper=_SafeDumper,
        sort_keys=False,
        default_flow_style=False,
        allow_unicode=True,
    ).strip()
    content = f"---\n{fm}\n---\n\n{body.rstrip()}\n"
    path.write_text(content, encoding="utf-8")


_PHASE_RE = re.compile(r"^##\s+(?P<title>.+)$")
_FIELD_RE = re.compile(r"^[-*]\s*(?P<key>[a-z_][a-z0-9_]*)\s*:\s*(?P<val>.*)$", re.IGNORECASE)


def iter_roadmap_phases(doc: MarkdownDoc) -> list[dict[str, Any]]:
    """Pull phase blocks from a roadmap markdown file.

    Each `##` heading starts a phase. Lines like `- start: 2026-05-08`
    immediately under the heading become structured fields. The optional
    `- dod:` line followed by indented bullets becomes a list of DOD items.
    """
    phases: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    in_dod = False
    lines = doc.body.splitlines()
    line_index = 0
    for raw_line in lines:
        line_index += 1
        line = raw_line.rstrip()
        m = _PHASE_RE.match(line)
        if m:
            if current is not None:
                phases.append(current)
            current = {
                "title": m.group("title").strip(),
                "line_number": line_index,
                "dod": [],
                "fields": {},
                "body_lines": [],
            }
            in_dod = False
            continue
        if current is None:
            continue
        if in_dod:
            stripped = line.lstrip()
            if stripped.startswith(("- ", "* ")) and (line.startswith("  ") or line.startswith("\t")):
                current["dod"].append(stripped[2:].strip())
                continue
            in_dod = False
        f = _FIELD_RE.match(line)
        if f:
            key = f.group("key").lower()
            val = f.group("val").strip()
            if key == "dod":
                in_dod = True
                if val:
                    current["dod"].append(val)
            else:
                current["fields"][key] = val
            continue
        current["body_lines"].append(line)
    if current is not None:
        phases.append(current)
    return phases
