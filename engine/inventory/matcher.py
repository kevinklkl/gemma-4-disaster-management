"""Deterministic synonym -> canonical key matcher.

Acts as a safety net for the LLM extractor: even if Gemma forgets to set
`canonical` or picks a wrong key, the matcher can recover the right one by
scanning the raw text against the catalog's synonym list.

Match strategy (in order of trust):
  1. Exact match of the full normalized text.
  2. Token-level match (any whitespace-separated token equals a synonym).
  3. Bigram match (e.g. "corned beef", "first aid").
  4. Substring match against synonyms of length >= 4 (avoids noisy short hits).

Returns None if nothing in the catalog matches.
"""

from __future__ import annotations

import re

from .catalog import CATALOG, label_for, unit_for

_SYNONYM_INDEX: dict[str, str] = {}


def _normalize(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s\-]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _build_index() -> None:
    for key, entry in CATALOG.items():
        forms = [key, entry["label"], *entry["synonyms"]]
        for form in forms:
            normalized = _normalize(form)
            if normalized and normalized not in _SYNONYM_INDEX:
                _SYNONYM_INDEX[normalized] = key


_build_index()


def canonicalize(text: str | None) -> str | None:
    """Map a free-form item description to a canonical catalog key.

    Returns None when nothing in the catalog applies.
    """
    if not text:
        return None
    normalized = _normalize(text)
    if not normalized:
        return None

    if normalized in _SYNONYM_INDEX:
        return _SYNONYM_INDEX[normalized]

    tokens = normalized.split()
    for token in tokens:
        if token in _SYNONYM_INDEX:
            return _SYNONYM_INDEX[token]

    for i in range(len(tokens) - 1):
        bigram = f"{tokens[i]} {tokens[i+1]}"
        if bigram in _SYNONYM_INDEX:
            return _SYNONYM_INDEX[bigram]

    for syn, key in _SYNONYM_INDEX.items():
        if len(syn) >= 4 and syn in normalized:
            return key

    return None


__all__ = ["canonicalize", "label_for", "unit_for"]
