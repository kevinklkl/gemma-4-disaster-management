"""Validate and canonicalize Gemma's extraction output.

Trust model:
  - Gemma is asked to emit `canonical` from the catalog directly, but the
    deterministic synonym matcher is the ground truth. If the matcher finds
    a key, we use it; otherwise we accept Gemma's `canonical` if it exists
    in the catalog; otherwise canonical is null.
  - Items with no canonical match are kept (free-form `name`) so downstream
    code can still display and total them, just without cross-message
    aggregation. Surface this in the UI as "uncatalogued" if needed.
"""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, ValidationError, field_validator

from engine.inventory.catalog import CATALOG, label_for, unit_for
from engine.inventory.matcher import canonicalize

Urgency = Literal["low", "medium", "high", "critical"]


class _RawItem(BaseModel):
    raw_text: Optional[str] = None
    name: Optional[str] = None  # tolerate the legacy field name
    canonical: Optional[str] = None
    qty: Optional[int] = None
    unit: Optional[str] = None

    @field_validator("qty", mode="before")
    @classmethod
    def _coerce_qty(cls, v: Any) -> Any:
        if v is None or v == "":
            return None
        if isinstance(v, (int, float)):
            return int(v)
        # The model occasionally returns "1 sack" or "100" as strings.
        if isinstance(v, str):
            digits = "".join(ch for ch in v if ch.isdigit())
            return int(digits) if digits else None
        return None


class _RawExtraction(BaseModel):
    location: Optional[str] = None
    urgency: Optional[str] = None
    persons: Optional[int] = None
    items: list[_RawItem] = Field(default_factory=list)

    @field_validator("persons", mode="before")
    @classmethod
    def _coerce_persons(cls, v: Any) -> Any:
        if v is None or v == "":
            return None
        if isinstance(v, (int, float)):
            return int(v)
        if isinstance(v, str):
            digits = "".join(ch for ch in v if ch.isdigit())
            return int(digits) if digits else None
        return None


_ALLOWED_URGENCY = {"low", "medium", "high", "critical"}


def _clean_urgency(value: Optional[str]) -> Urgency:
    if value:
        v = value.lower().strip()
        if v in _ALLOWED_URGENCY:
            return v  # type: ignore[return-value]
    return "medium"


def validate_and_canonicalize(payload: dict) -> dict:
    """Take Gemma's parsed JSON, canonicalize items, return cleaned dict.

    Output shape (stable contract for the DB / frontend):
      {
        "location": str|null,
        "urgency":  "low"|"medium"|"high"|"critical",
        "persons":  int|null,
        "items": [
          {
            "name":      str,          # display label (catalog label or raw text)
            "raw_text":  str|null,     # original text from the message
            "canonical": str|null,     # catalog key, or null if uncatalogued
            "qty":       int|null,
            "unit":      str|null,
          },
          ...
        ],
      }
    """
    try:
        raw = _RawExtraction.model_validate(payload)
    except ValidationError:
        # Fall back to lenient handling — at least preserve what we can.
        raw = _RawExtraction(
            location=payload.get("location") if isinstance(payload, dict) else None,
            urgency=payload.get("urgency") if isinstance(payload, dict) else None,
            persons=None,
            items=[],
        )

    cleaned_items: list[dict] = []
    for item in raw.items:
        original = (item.raw_text or item.name or "").strip()

        matcher_key = canonicalize(original)
        llm_key = item.canonical if item.canonical in CATALOG else None
        chosen = matcher_key or llm_key

        display = label_for(chosen) or (original or "(unknown item)")
        unit = item.unit or unit_for(chosen)

        cleaned_items.append({
            "name": display,
            "raw_text": original or None,
            "canonical": chosen,
            "qty": item.qty,
            "unit": unit,
        })

    location: Optional[str] = None
    if isinstance(raw.location, str) and raw.location.strip():
        location = raw.location.strip()

    return {
        "location": location,
        "urgency": _clean_urgency(raw.urgency),
        "persons": raw.persons,
        "items": cleaned_items,
    }
