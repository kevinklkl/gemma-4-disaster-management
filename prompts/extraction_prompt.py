"""Extraction prompt for Gemma.

Optimized for edge inference and maximum KV cache retention.
Uses Prefix Sharing: The exact same Shared Prefix is sent to Ollama 
for both single-message and batch extractions, ensuring the model never 
has to re-read the CATALOG or RULES when the queue size fluctuates.
"""

from __future__ import annotations

from engine.inventory.catalog import CATALOG


def _is_tagalog_word(word: str) -> bool:
    """Heuristic to detect Tagalog/Bisaya words for prioritized prompt rendering."""
    # Common Tagalog and Bisaya grammatical markers
    local_markers = {
        "ng", "mga", "ang", "sa", "kay", "nang", "po", "ho", "na", "pa", 
        "din", "rin", "daw", "raw", "naman", "ni", "ug", "ang"
    }
    
    word_lower = word.lower().strip(".,!?;:()[]\"'")
    
    # Expanded Disaster & Logistics Lexicon (Tagalog + Common Bisaya)
    local_roots = {
        # Food & Water
        "tubig", "bigas", "delata", "kain", "inom", "ulam", "gatas", "kape", 
        "noodles", "sardinas", "tinapay", "gutom", "uhaw", "pagkaon",
        
        # Medical & Hygiene
        "sakit", "gamot", "sugat", "lagnat", "ubo", "sipon", "hugas", 
        "pampers", "diaper", "napkin", "sabon", "tambal",
        
        # Shelter & Supplies
        "bahay", "banig", "kumot", "trapal", "tent", "bubong", "damit", 
        "tsinelas", "balay",
        
        # People & Vulnerable Groups
        "bata", "matanda", "lola", "lolo", "pamilya", "tao", "katao", 
        "nanay", "tatay", "buntis", "sanggol", "pilay", "aso", "pusa", "iro",
        
        # Action, Status, & Emergency
        "tulong", "bigay", "padala", "kailangan", "ubos", "sira", "baha", 
        "lunod", "tabang", "wala", "dami", "konti"
    }
    
    # Check if it's an exact match for a marker or root
    if word_lower in local_markers or word_lower in local_roots:
        return True
        
    # Check for common Tagalog verbal/adjective affixes
    affixes = ["-in", "-an", "mag-", "nag-", "pa-", "pinag-", "naka-", "pang-", "ma-"]
    has_affix = any(affix in word_lower for affix in affixes)
    
    # Prevent false positives where English words happen to contain "-in"
    if has_affix:
        for affix in affixes:
            if affix.endswith("-") and word_lower.startswith(affix.strip("-")):
                return True
            if affix.startswith("-") and word_lower.endswith(affix.strip("-")):
                return True

    return False


def _get_disambiguation_hint(key: str, catalog: dict) -> str | None:
    """Return short hint if key has semantically similar siblings."""
    disambig_map = {
        "diapers_baby": "for infants",
        "diapers_adult": "for elderly/PWD", 
        "water_drinking": "for consumption",
        "water_cleaning": "for hygiene/cleaning",
        "rice": "uncooked grain",
        "rice_cooked": "prepared meal",
        "canned_goods": "sardines, tuna, meat in can",
        "canned_vegetables": "corn, beans, veggies in can",
        "milk_adult": "nutritional drink for adults",
        "infant_formula": "baby milk/formula",
    }
    return disambig_map.get(key)


def _render_catalog_lines() -> str:
    """One line per canonical key: `key — top synonyms`."""
    lines: list[str] = []
    for key, entry in CATALOG.items():
        seen = {key.lower(), entry["label"].lower()}
        chosen: list[str] = []
        
        # Prioritize: Tagalog synonyms first, then English, then variants
        tagalog_sims = [s for s in entry["synonyms"] if _is_tagalog_word(s) and s.lower() not in seen]
        english_sims = [s for s in entry["synonyms"] if s.lower() not in seen and s not in tagalog_sims]
        
        for syn in tagalog_sims + english_sims:
            s = syn.lower()
            if s in seen:
                continue
            seen.add(s)
            chosen.append(syn)
            if len(chosen) >= 6:
                break
                
        hint = _get_disambiguation_hint(key, CATALOG)
        synonyms = ", ".join(chosen) if chosen else entry["label"]
        line_suffix = f" ({hint})" if hint else ""
        lines.append(f"  {key} — {synonyms}{line_suffix}")
    return "\n".join(lines)


_INSTRUCTIONS_HEADER = """\
Extract relief needs from disaster messages (Tagalog, English, Taglish).
No markdown. No explanation.

SCHEMA:
{"loc":<str|null>,"urg":"L|M|H|C","pax":<int|null>,"items":[{"txt":<str>,"can":<key|null>,"qty":<int|null>,"u":<str|null>}]}

CANONICAL ITEMS: Match the closest key below. If nothing fits, use null.
"""


_INSTRUCTIONS_FOOTER = """\
URGENCY (urg):
 C — critical: life-threatening, trapped, medical emergency
 H — high: no food/water 24h+, sick, urgent evacuation
 M — medium: running low, evacuated but stable
 L — low: pre-positioning, donation, inquiry

RULES:
- pax: Extract TOTAL people (1 pamilya ≈ 5 persons). Combine demographics.
- txt: EXACT short name of the physical relief good ONLY.
- REQUESTS ONLY: Extract ONLY items being explicitly requested or needed. NEVER extract items the sender already has, or items they mentioned eating/using in the past (e.g., "kanin lang nakain").
- CONTEXT MATTERS: Pay attention to who the item is for. "gatas" for a baby MUST be matched to infant formula, not standard milk. 
- DEMOGRAPHICS ARE NOT ITEMS: NEVER extract "bata", "senior", "tao", "pamilya", etc., into the "items" array. They ONLY count towards "pax".
- can: MUST match a key exactly, or null. Split compound requests.
- qty: INT only. Extract only if explicit.
- u: EXACT unit (cans, sacks, L, packs). null if unspecified.
- Empty items [] is valid if no specific physical goods are requested.
"""
_FEW_SHOT_EXAMPLES = """\
EXAMPLES:
Message: "Brgy 7 San Jose, kailangan namin ng tubig at bigas para sa 50 katao."
Extraction: {"loc":"Brgy 7 San Jose","urg":"H","pax":50,"items":[{"txt":"tubig","can":"water","qty":null,"u":null},{"txt":"bigas","can":"rice","qty":null,"u":null}]}

Message: "TULONG! Naipit kami sa Brgy Bagumbayan, walang makain 2 days na"
Extraction: {"loc":"Brgy Bagumbayan","urg":"C","pax":null,"items":[]}

Message: "sir/mam ung anti-rejection meds ng tito ko ubos bkas."
Extraction: {"loc":null,"urg":"H","pax":1,"items":[{"txt":"anti-rejection meds","can":null,"qty":null,"u":null}]}

Message: "we only have rice left. need drinking water fast for 3 families."
Extraction: {"loc":null,"urg":"H","pax":15,"items":[{"txt":"drinking water","can":"water","qty":null,"u":null}]}
"""


def _get_shared_prefix() -> str:
    """This exact string is cached by Ollama across both Single and Batch calls."""
    return (
        f"{_INSTRUCTIONS_HEADER}"
        f"{_render_catalog_lines()}\n\n"
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