"""Extraction prompt for Gemma.

Optimized for edge inference and maximum KV cache retention.
Uses Prefix Sharing: The exact same Shared Prefix is sent to Ollama
for both single-message and batch extractions, ensuring the model never
has to re-read the RULES when the queue size fluctuates.

Canonical matching is handled entirely by the deterministic Python matcher
(engine/inventory/matcher.py) post-extraction. The catalog is not included
in the prompt — ~550 tokens saved per call.
"""

from __future__ import annotations


_INSTRUCTIONS_HEADER = """\
Extract relief needs from disaster messages (Tagalog, English, Taglish).
No markdown. No explanation.

SCHEMA:
{"loc":<str|null>,"urg":"L|M|H|C","pax":<int|null>,"items":[{"txt":<str>,"qty":<int|null>,"u":<str|null>}]}
"""

_INSTRUCTIONS_FOOTER = """\
URGENCY (urg):
 C — critical: life-threatening, trapped, medical emergency
 H — high: no food/water 24h+, sick, urgent evacuation
 M — medium: running low, evacuated but stable
 L — low: pre-positioning, donation, inquiry

RULES:
- pax: Extract TOTAL people (1 pamilya ≈ 5 persons). Combine demographics.
- txt: EXACT short name of the physical relief good ONLY. Be specific:
  * "gatas/milk" for a baby/sanggol → write "infant formula"
  * "diapers/pampers" for elderly/matanda/PWD → write "adult diapers"
- REQUESTS ONLY: Extract ONLY items being explicitly requested or needed. NEVER extract items the sender already has, or items they mentioned eating/using in the past (e.g., "kanin lang nakain").
- DEMOGRAPHICS ARE NOT ITEMS: NEVER extract "bata", "senior", "tao", "pamilya", etc., into the "items" array. They ONLY count towards "pax".
- Split compound requests into separate items.
- qty: INT only. Extract only if explicit.
- u: EXACT unit (cans, sacks, L, packs). null if unspecified.
- Empty items [] is valid if no specific physical goods are requested.
"""

_FEW_SHOT_EXAMPLES = """\
EXAMPLES:
Message: "Brgy 7 San Jose, kailangan namin ng tubig at bigas para sa 50 katao."
Extraction: {"loc":"Brgy 7 San Jose","urg":"H","pax":50,"items":[{"txt":"tubig","qty":null,"u":null},{"txt":"bigas","qty":null,"u":null}]}

Message: "TULONG! Naipit kami sa Brgy Bagumbayan, walang makain 2 days na"
Extraction: {"loc":"Brgy Bagumbayan","urg":"C","pax":null,"items":[]}

Message: "sir/mam ung anti-rejection meds ng tito ko ubos bkas."
Extraction: {"loc":null,"urg":"H","pax":1,"items":[{"txt":"anti-rejection meds","qty":null,"u":null}]}

Message: "we only have rice left. need drinking water fast for 3 families."
Extraction: {"loc":null,"urg":"H","pax":15,"items":[{"txt":"drinking water","qty":null,"u":null}]}

Message: "Brgy Mabolo kailangan namin 10 sacks ng bigas at 200 lata ng sardinas para sa 80 katao."
Extraction: {"loc":"Brgy Mabolo","urg":"H","pax":80,"items":[{"txt":"bigas","qty":10,"u":"sacks"},{"txt":"sardinas","qty":200,"u":"cans"}]}
"""


def _get_shared_prefix() -> str:
    """This exact string is cached by Ollama across both Single and Batch calls."""
    return (
        f"{_INSTRUCTIONS_HEADER}"
        f"{_INSTRUCTIONS_FOOTER}\n"
        f"{_FEW_SHOT_EXAMPLES}\n"
    )


def build_extraction_prompt(content: str) -> str:
    """Suffix for a single message."""
    prefix = _get_shared_prefix()
    suffix = (
        f"TASK: Extract the following single message. Return ONLY the JSON object.\n\n"
        f'Message: "{content}"\n'
        f"JSON:"
    )
    return prefix + suffix


def build_batch_prompt(messages: list[str]) -> str:
    """Suffix for multiple messages."""
    n = len(messages)
    numbered = "\n".join(f"{i + 1}: {msg}" for i, msg in enumerate(messages))
    prefix = _get_shared_prefix()
    suffix = (
        f"TASK: Extract the following {n} messages. Return a JSON object with a 'results' array containing {n} objects.\n\n"
        f"{numbered}\n\n"
        f"JSON Object:"
    )
    return prefix + suffix
