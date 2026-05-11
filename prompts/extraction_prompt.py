"""Extraction prompt for Gemma.

Optimized for edge inference and maximum KV cache retention.
The prompt is assembled from three pieces:
  1. Static instructions (urgency rubric, rules, minified output schema).
  2. The canonical-item vocabulary, rendered dynamically from `CATALOG`.
  3. Few-shot examples demonstrating Taglish input and minified JSON output.

Call `build_extraction_prompt(content)` for single-message extraction.
For high-throughput sweeps, use `GEMMA_BATCH_PROMPT_TEMPLATE`.
"""

from __future__ import annotations

from engine.inventory.catalog import CATALOG


def _is_tagalog_word(word: str) -> bool:
    """Heuristic to detect Tagalog/Bisaya words for prioritized prompt rendering."""
    # Common Tagalog and Bisaya grammatical markers
    local_markers = {
        "ng", "mga", "ang", "sa", "kay", "nang", "po", "ho", "na", "pa", 
        "din", "rin", "daw", "raw", "naman", "ni", "ug", "ang" # 'ug' is Bisaya 'and'
    }
    
    word_lower = word.lower().strip(".,!?;:()[]\"'")
    
    # Expanded Disaster & Logistics Lexicon (Tagalog + Common Bisaya)
    local_roots = {
        # Food & Water
        "tubig", "bigas", "delata", "kain", "inom", "ulam", "gatas", "kape", 
        "noodles", "sardinas", "tinapay", "gutom", "uhaw", "pagkaon", # pagkaon = food (Bisaya)
        
        # Medical & Hygiene
        "sakit", "gamot", "sugat", "lagnat", "ubo", "sipon", "hugas", 
        "pampers", "diaper", "napkin", "sabon", "tambal", # tambal = medicine (Bisaya)
        
        # Shelter & Supplies
        "bahay", "banig", "kumot", "trapal", "tent", "bubong", "damit", 
        "tsinelas", "balay", # balay = house (Bisaya)
        
        # People & Vulnerable Groups
        "bata", "matanda", "lola", "lolo", "pamilya", "tao", "katao", 
        "nanay", "tatay", "buntis", "sanggol", "pilay", "aso", "pusa", "iro",
        
        # Action, Status, & Emergency
        "tulong", "bigay", "padala", "kailangan", "ubos", "sira", "baha", 
        "lunod", "tabang", "wala", "dami", "konti" # tabang = help (Bisaya)
    }
    
    # Check if it's an exact match for a marker or root
    if word_lower in local_markers or word_lower in local_roots:
        return True
        
    # Check for common Tagalog verbal/adjective affixes
    affixes = ["-in", "-an", "mag-", "nag-", "pa-", "pinag-", "naka-", "pang-", "ma-"]
    has_affix = any(affix in word_lower for affix in affixes)
    
    # Prevent false positives where English words happen to contain "-in" (like "medicine" or "origin")
    # We only trigger the affix rule if the string actually starts/ends with the hyphenated affix
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
Return compact valid JSON only. No markdown. No explanation.

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
- pax: Total people (1 pamilya ≈ 5 persons).
- txt: EXACT phrase from message.
- can: MUST match a key exactly, or null. Split compound requests.
- qty: INT only. Extract only if explicit.
- u: EXACT unit (cans, sacks, L, packs). null if unspecified.
- Empty items [] is valid if no specific physical goods are requested.
"""


_FEW_SHOT_EXAMPLES = """\
EXAMPLES:

Message: "Brgy 7 San Jose, kailangan namin ng tubig at bigas para sa 50 katao. Walang kuryente, may mga matanda."
JSON: {"loc":"Brgy 7 San Jose","urg":"H","pax":50,"items":[{"txt":"tubig","can":"water_drinking","qty":null,"u":null},{"txt":"bigas","can":"rice","qty":null,"u":null}]}

Message: "send 100 cans of sardines and 5 sacks of rice to evacuation center in Tacloban asap please"
JSON: {"loc":"Tacloban","urg":"H","pax":null,"items":[{"txt":"sardines","can":"canned_goods","qty":100,"u":"cans"},{"txt":"rice","can":"rice","qty":5,"u":"sacks"}]}

Message: "TULONG! Naipit kami sa Brgy Bagumbayan, may mga bata at lola, walang makain 2 days na"
JSON: {"loc":"Brgy Bagumbayan","urg":"C","pax":null,"items":[]}

Message: "need diapers and milk for 3 babies and adult pampers for lola"
JSON: {"loc":null,"urg":"H","pax":4,"items":[{"txt":"diapers","can":"diapers_baby","qty":null,"u":null},{"txt":"milk for babies","can":"infant_formula","qty":null,"u":null},{"txt":"adult pampers","can":"diapers_adult","qty":null,"u":null}]}

Message: "naka-evacuate na kami sa school. 3 pamilya kami dito, kailangan ng banig at kumot pang gabi"
JSON: {"loc":"school","urg":"M","pax":15,"items":[{"txt":"banig","can":"sleeping_mat","qty":null,"u":null},{"txt":"kumot","can":"blanket","qty":null,"u":null}]}

Message: "200 people stranded, need 50 packs of noodles, 30L water, and blankets"
JSON: {"loc":null,"urg":"C","pax":200,"items":[{"txt":"noodles","can":"canned_goods","qty":50,"u":"packs"},{"txt":"water","can":"water_drinking","qty":30,"u":"L"},{"txt":"blankets","can":"blanket","qty":null,"u":null}]}
"""


def build_extraction_prompt(content: str) -> str:
    """Assembles the prompt. Dynamic content MUST stay at the very bottom for KV caching."""
    return (
        f"{_INSTRUCTIONS_HEADER}"
        f"{_render_catalog_lines()}\n\n"
        f"{_INSTRUCTIONS_FOOTER}\n"
        f"{_FEW_SHOT_EXAMPLES}\n"
        f'Message: "{content}"\n'
        f"JSON:"
    )


# Lean batch template
GEMMA_BATCH_PROMPT_TEMPLATE = """Return a JSON object containing a "results" array of exactly {n} objects. No markdown. No explanation.
Extract relief needs. "tawo" = pax. Unknown = null.
Schema: {{"results": [{{"loc":null,"urg":"L|M|H|C","pax":null,"items":[{{"txt":"string","qty":null}}]}}]}}

{numbered_messages}

JSON object:""".strip()