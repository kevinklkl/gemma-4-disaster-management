"""Data-driven quantity estimator for relief items.

When Gemma extracts an item but the sender did not specify a quantity, this
module fills in a recommended quantity based on the `estimate` rule attached
to each catalog entry.  Explicit quantities from the sender are never touched.

Rules (defined per item in catalog.py):
  {"multiplier": float, "base": "person"|"family", "unit": str}
      → qty = ceil(persons [or families] × multiplier)
  "triage"
      → qty stays null; unit is set to "triage" so the UI can flag it
"""

from __future__ import annotations

import math
from typing import Any

from engine.inventory.catalog import CATALOG, PERSONS_PER_FAMILY


def estimate_needs(data: dict[str, Any]) -> dict[str, Any]:
    """Mutate *data* in-place: fill missing quantities using catalog rules.

    Returns the same dict for convenience.
    """
    persons: int | None = data.get("persons")
    if not persons or persons <= 0:
        return data

    families = math.ceil(persons / PERSONS_PER_FAMILY)

    for item in data.get("items", []):
        if item.get("qty") is not None:
            continue

        canonical: str | None = item.get("canonical")
        if not canonical:
            continue

        rule = CATALOG.get(canonical, {}).get("estimate")
        if rule is None:
            continue

        if rule == "triage":
            item["unit"] = "triage"
            item["estimated"] = False
            continue

        base = rule["base"]
        multiplier: float = rule["multiplier"]

        if base == "person":
            qty = math.ceil(persons * multiplier)
        elif base == "family":
            qty = math.ceil(families * multiplier)
        else:
            qty = math.ceil(persons * multiplier)

        item["qty"] = qty
        item["unit"] = rule["unit"]
        item["estimated"] = True

    return data
