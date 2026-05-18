"""Extraction prompt for Gemma.

Optimized for edge inference and KV cache retention.

Single-message calls include the `rep` (reply draft) field so the model can
generate a short SMS reply when information is missing or the message is an
inquiry.

Batch calls omit `rep` entirely — each additional reply string adds 30–50
tokens per item and overflows the Android LiteRT model's output budget, causing
truncated JSON. reply_checker.py fills in template replies post-extraction.

The two prefixes are cached separately by Ollama.
"""

from __future__ import annotations


# ── Shared rules (no rep) ────────────────────────────────────────────────────

_HEADER_BASE = """\
Extract relief needs from disaster messages (Tagalog, English, Taglish).
No markdown. No explanation.
"""

_FOOTER_BASE = """\
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
- cat: Item category. One of: food, water, hygiene, shelter, clothing, medical, baby, elderly, disability, household, education, protection. null if unclear.
- Empty items [] is valid if no specific physical goods are requested.
"""

_EXAMPLES_BASE = """\
EXAMPLES:
Message: "Brgy 7 San Jose, kailangan namin ng tubig at bigas para sa 50 katao."
Extraction: {"loc":"Brgy 7 San Jose","urg":"H","pax":50,"items":[{"txt":"tubig","qty":null,"u":null,"cat":"water"},{"txt":"bigas","qty":null,"u":null,"cat":"food"}]}

Message: "TULONG! Naipit kami sa Brgy Bagumbayan, walang makain 2 days na"
Extraction: {"loc":"Brgy Bagumbayan","urg":"C","pax":null,"items":[]}

Message: "sir/mam ung anti-rejection meds ng tito ko ubos bkas."
Extraction: {"loc":null,"urg":"H","pax":1,"items":[{"txt":"anti-rejection meds","qty":null,"u":null,"cat":"medical"}]}

Message: "we only have rice left. need drinking water fast for 3 families."
Extraction: {"loc":null,"urg":"H","pax":15,"items":[{"txt":"drinking water","qty":null,"u":null,"cat":"water"}]}

Message: "Brgy Mabolo kailangan namin 10 sacks ng bigas at 200 lata ng sardinas para sa 80 katao."
Extraction: {"loc":"Brgy Mabolo","urg":"H","pax":80,"items":[{"txt":"bigas","qty":10,"u":"sacks","cat":"food"},{"txt":"sardinas","qty":200,"u":"cans","cat":"food"}]}
"""


# ── Single-message: includes rep ─────────────────────────────────────────────

_SINGLE_SCHEMA = 'SCHEMA:\n{"loc":<str|null>,"urg":"L|M|H|C","pax":<int|null>,"items":[{"txt":<str>,"qty":<int|null>,"u":<str|null>,"cat":<str|null>}],"rep":<null|str>}\n'

_SINGLE_REP_RULE = '- rep: Short (1-2 sentence) SMS reply draft. Same language as the message. null if request is clear and location is known. String if location is missing, message is an inquiry, or critical info is unclear — acknowledge receipt and ask for what\'s missing.\n'

_SINGLE_EXAMPLES = """\
EXAMPLES:
Message: "Brgy 7 San Jose, kailangan namin ng tubig at bigas para sa 50 katao."
Extraction: {"loc":"Brgy 7 San Jose","urg":"H","pax":50,"items":[{"txt":"tubig","qty":null,"u":null,"cat":"water"},{"txt":"bigas","qty":null,"u":null,"cat":"food"}],"rep":null}

Message: "TULONG! Naipit kami sa Brgy Bagumbayan, walang makain 2 days na"
Extraction: {"loc":"Brgy Bagumbayan","urg":"C","pax":null,"items":[],"rep":null}

Message: "sir/mam ung anti-rejection meds ng tito ko ubos bkas."
Extraction: {"loc":null,"urg":"H","pax":1,"items":[{"txt":"anti-rejection meds","qty":null,"u":null,"cat":"medical"}],"rep":"Natanggap po ang inyong mensahe. Maaari po bang sabihin ang inyong lokasyon para makatulong agad?"}

Message: "we only have rice left. need drinking water fast for 3 families."
Extraction: {"loc":null,"urg":"H","pax":15,"items":[{"txt":"drinking water","qty":null,"u":null,"cat":"water"}],"rep":"Message received. Could you share your location so we can send help right away?"}

Message: "Brgy Mabolo kailangan namin 10 sacks ng bigas at 200 lata ng sardinas para sa 80 katao."
Extraction: {"loc":"Brgy Mabolo","urg":"H","pax":80,"items":[{"txt":"bigas","qty":10,"u":"sacks","cat":"food"},{"txt":"sardinas","qty":200,"u":"cans","cat":"food"}],"rep":null}
"""

# ── Reply-upgrade variant: rep is always required ────────────────────────────
# Used by _run_reply_draft_bg when reply_needed=1. Gemma must always write a
# rep string — the ticket responder needs a draft to send, never null.

_UPGRADE_SCHEMA = 'SCHEMA:\n{"loc":<str|null>,"urg":"L|M|H|C","pax":<int|null>,"items":[{"txt":<str>,"qty":<int|null>,"u":<str|null>,"cat":<str|null>}],"rep":<str>}\n'

_UPGRADE_REP_RULE = '- rep: REQUIRED. Short (1-2 sentence) SMS reply draft. Same language as the message. Always a string — never null. Acknowledge receipt, confirm what was understood, and ask for any missing info (location, quantity, etc.).\n'

_UPGRADE_EXAMPLES = """\
EXAMPLES:
Message: "Brgy 7 San Jose, kailangan namin ng tubig at bigas para sa 50 katao."
Extraction: {"loc":"Brgy 7 San Jose","urg":"H","pax":50,"items":[{"txt":"tubig","qty":null,"u":null,"cat":"water"},{"txt":"bigas","qty":null,"u":null,"cat":"food"}],"rep":"Natanggap po. Inaasikaso na namin ang inyong kahilingan para sa tubig at bigas para sa 50 katao sa Brgy 7 San Jose."}

Message: "TULONG! Naipit kami sa Brgy Bagumbayan, walang makain 2 days na"
Extraction: {"loc":"Brgy Bagumbayan","urg":"C","pax":null,"items":[],"rep":"Natanggap po ang inyong mensahe — ipapadala na ang tulong sa Brgy Bagumbayan. Ilang tao ang nangangailangan ng pagkain?"}

Message: "sir/mam ung anti-rejection meds ng tito ko ubos bkas."
Extraction: {"loc":null,"urg":"H","pax":1,"items":[{"txt":"anti-rejection meds","qty":null,"u":null,"cat":"medical"}],"rep":"Natanggap po ang inyong mensahe. Maaari po bang sabihin ang inyong lokasyon para makatulong agad?"}

Message: "we only have rice left. need drinking water fast for 3 families."
Extraction: {"loc":null,"urg":"H","pax":15,"items":[{"txt":"drinking water","qty":null,"u":null,"cat":"water"}],"rep":"Message received. Could you share your location so we can send drinking water for 3 families right away?"}

Message: "Brgy Mabolo kailangan namin 10 sacks ng bigas at 200 lata ng sardinas para sa 80 katao."
Extraction: {"loc":"Brgy Mabolo","urg":"H","pax":80,"items":[{"txt":"bigas","qty":10,"u":"sacks","cat":"food"},{"txt":"sardinas","qty":200,"u":"cans","cat":"food"}],"rep":"Natanggap po. Pinoproseso na ang inyong kahilingan para sa 10 sacks ng bigas at 200 lata ng sardinas para sa 80 katao sa Brgy Mabolo."}
"""


# ── Batch: no rep (saves ~40 tokens per item, prevents Android truncation) ───

_BATCH_SCHEMA = 'SCHEMA:\n{"loc":<str|null>,"urg":"L|M|H|C","pax":<int|null>,"items":[{"txt":<str>,"qty":<int|null>,"u":<str|null>,"cat":<str|null>}]}\n'


def _get_shared_prefix() -> str:
    """Single-message prefix — includes rep field. Cached by Ollama."""
    return (
        f"{_HEADER_BASE}"
        f"{_SINGLE_SCHEMA}"
        f"{_FOOTER_BASE}"
        f"{_SINGLE_REP_RULE}\n"
        f"{_SINGLE_EXAMPLES}\n"
    )


def _get_batch_prefix() -> str:
    """Batch prefix — omits rep to keep per-item token count low. Cached separately."""
    return (
        f"{_HEADER_BASE}"
        f"{_BATCH_SCHEMA}"
        f"{_FOOTER_BASE}\n"
        f"{_EXAMPLES_BASE}\n"
    )


def build_extraction_prompt(content: str) -> str:
    """Single-message prompt (includes rep)."""
    suffix = (
        f"TASK: Extract the following single message. Return ONLY the JSON object.\n\n"
        f'Message: "{content}"\n'
        f"JSON:"
    )
    return _get_shared_prefix() + suffix


def build_reply_upgrade_prompt(content: str) -> str:
    """Single-message prompt for the reply-draft upgrade path.

    Identical to the standard single-message prompt except rep is always
    required (never null). Used when reply_needed=1 — the responder needs a
    draft to send regardless of whether location is known.
    """
    prefix = (
        f"{_HEADER_BASE}"
        f"{_UPGRADE_SCHEMA}"
        f"{_FOOTER_BASE}"
        f"{_UPGRADE_REP_RULE}\n"
        f"{_UPGRADE_EXAMPLES}\n"
    )
    suffix = (
        f"TASK: Extract the following single message. Return ONLY the JSON object.\n\n"
        f'Message: "{content}"\n'
        f"JSON:"
    )
    return prefix + suffix


def build_batch_prompt(messages: list[str]) -> str:
    """Batch prompt (no rep — prevents token overflow on constrained devices)."""
    n = len(messages)
    numbered = "\n".join(f"{i + 1}: {msg}" for i, msg in enumerate(messages))
    suffix = (
        f"TASK: Extract the following {n} messages. Return a JSON object with a 'results' array containing {n} objects.\n\n"
        f"{numbered}\n\n"
        f"JSON Object:"
    )
    return _get_batch_prefix() + suffix
