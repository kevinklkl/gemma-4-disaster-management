"""Parse Gemma's raw response string into a Python dict.

Gemma usually returns clean JSON because the Ollama call uses `format="json"`,
but we still defend against:
  - markdown code fences (``` or ```json) that occasionally leak through
  - leading/trailing whitespace
  - trailing text after the JSON object (we slice to the last `}`)
"""

from __future__ import annotations

import json


def parse_response(text: str) -> dict:
    if text is None:
        raise ValueError("Empty Gemma response")

    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    # If the model appended commentary after the JSON, keep only up to the
    # last closing brace.
    if not text.endswith("}"):
        last = text.rfind("}")
        if last != -1:
            text = text[: last + 1]

    return json.loads(text)
