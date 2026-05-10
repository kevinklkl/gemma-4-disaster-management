"""Extraction prompt for Gemma.

The prompt is assembled from three pieces:
  1. Static instructions (urgency rubric, persons rule, output schema).
  2. The canonical-item vocabulary, rendered from `engine.inventory.catalog`
     so the prompt and the post-process matcher always agree.
  3. Few-shot examples that demonstrate Taglish / code-switched input.

Call `build_extraction_prompt(content)` to get the full string to send to
Ollama. `GEMMA_PROMPT_TEMPLATE` is kept as a legacy export — call sites that
use `.format(content=...)` continue to work.
"""

from __future__ import annotations

from engine.inventory.catalog import CATALOG


def _render_catalog_lines() -> str:
    """One line per canonical key: `key — top synonyms`.

    Keep this concise; we send it on every request and prompt tokens cost
    eval time. Show 4-6 synonyms per item, prioritizing Tagalog + the most
    common English forms.
    """
    lines: list[str] = []
    for key, entry in CATALOG.items():
        # Top synonyms first, deduped against the key/label.
        seen = {key.lower(), entry["label"].lower()}
        chosen: list[str] = []
        for syn in entry["synonyms"]:
            s = syn.lower()
            if s in seen:
                continue
            seen.add(s)
            chosen.append(syn)
            if len(chosen) >= 5:
                break
        synonyms = ", ".join(chosen) if chosen else entry["label"]
        lines.append(f"  {key} — {synonyms}")
    return "\n".join(lines)


_FEW_SHOT_EXAMPLES = """\
EXAMPLES:

Message: "Brgy 7 San Jose, kailangan namin ng tubig at bigas para sa 50 katao. Walang kuryente, may mga matanda."
JSON: {"location":"Brgy 7 San Jose","urgency":"high","persons":50,"items":[{"raw_text":"tubig","canonical":"water_drinking","qty":null,"unit":null},{"raw_text":"bigas","canonical":"rice","qty":null,"unit":null}]}

Message: "send 100 cans of sardines and 5 sacks of rice to evacuation center in Tacloban asap please"
JSON: {"location":"Tacloban","urgency":"high","persons":null,"items":[{"raw_text":"sardines","canonical":"canned_goods","qty":100,"unit":"cans"},{"raw_text":"rice","canonical":"rice","qty":5,"unit":"sacks"}]}

Message: "hi po may delata ako 20 cans pwede po idonate"
JSON: {"location":null,"urgency":"low","persons":null,"items":[{"raw_text":"delata","canonical":"canned_goods","qty":20,"unit":"cans"}]}

Message: "TULONG! Naipit kami sa Brgy Bagumbayan, may mga bata at lola, walang makain 2 days na"
JSON: {"location":"Brgy Bagumbayan","urgency":"critical","persons":null,"items":[]}

Message: "need diapers and milk for 3 babies and adult pampers for lola"
JSON: {"location":null,"urgency":"high","persons":4,"items":[{"raw_text":"diapers","canonical":"diapers_baby","qty":null,"unit":null},{"raw_text":"milk for babies","canonical":"infant_formula","qty":null,"unit":null},{"raw_text":"adult pampers","canonical":"diapers_adult","qty":null,"unit":null}]}

Message: "naka-evacuate na kami sa school. 3 pamilya kami dito, kailangan ng banig at kumot pang gabi"
JSON: {"location":"school","urgency":"medium","persons":15,"items":[{"raw_text":"banig","canonical":"sleeping_mat","qty":null,"unit":null},{"raw_text":"kumot","canonical":"blanket","qty":null,"unit":null}]}
"""


_INSTRUCTIONS_HEADER = """\
You extract relief needs from disaster messages written in Tagalog, English,
or mixed Taglish (code-switching is normal). Return compact valid JSON only.
No markdown. No explanation. No prose before or after.

OUTPUT SCHEMA:
{"location":<string|null>,"urgency":"low|medium|high|critical","persons":<int|null>,"items":[{"raw_text":<string>,"canonical":<key|null>,"qty":<int|null>,"unit":<string|null>}]}

CANONICAL ITEMS — pick the key whose synonyms best match each requested item.
If nothing fits, set "canonical" to null and keep raw_text faithful to the message.
"""


_INSTRUCTIONS_FOOTER = """\

URGENCY:
  critical — life-threatening NOW: trapped, drowning, medical emergency, no
             shelter in active storm, "tulong na", "mamamatay na", "naipit"
  high     — urgent: no food/water for 24h+, sick children/elderly/PWD,
             immediate evacuation needed
  medium   — running low / replenishment / evacuated but stable
  low      — pre-positioning, future need, donation offer, general inquiry

PERSONS:
  Total people needing help. "tawo" / "katao" = persons.
  Family-size convention: 1 pamilya / 1 family ≈ 5 persons.
  Add up explicit demographic mentions (e.g., "3 bata at 2 matanda" = 5).
  Use null if not stated.

RULES:
  - raw_text: keep the surface form from the message (Tagalog or English).
  - canonical: must be one of the keys above, or null.
  - qty: integer only. If the message says "a few", "marami", "konti", use null.
  - unit: "cans", "sacks", "kg", "L", "packs", "pcs", "kits", "people", etc.
    Preserve what the message says; use null if unspecified.
  - Critical situations with no specific items: items can be an empty list.
  - Never invent items or quantities not in the message.
"""


def build_extraction_prompt(content: str) -> str:
    return (
        f"{_INSTRUCTIONS_HEADER}"
        f"{_render_catalog_lines()}\n"
        f"{_INSTRUCTIONS_FOOTER}\n"
        f"{_FEW_SHOT_EXAMPLES}\n"
        f'Message: "{content}"\n'
        f"JSON:"
    )
