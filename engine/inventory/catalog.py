"""Canonical relief-item taxonomy for the Philippines disaster response system.

Each entry maps a canonical key to:
  - label:    human-readable display name (English)
  - unit:     default unit used when the message doesn't specify one
  - synonyms: surface forms (Tagalog + English + common brand names) that should
              map to this key. Used by the deterministic matcher as a safety net
              and surfaced to Gemma in the extraction prompt.
  - estimate: data-driven auto-estimation rule applied when the sender did not
              specify a quantity. Either a dict with keys:
                  multiplier (float)  — amount per base unit
                  base       (str)    — "person" or "family" (5 persons)
                  unit       (str)    — display unit string
              or the string "triage", meaning a human must decide the quantity
              (e.g. infant formula, adult diapers).

When editing this catalog, keep in mind:
  - The prompt template enumerates these keys and their top synonyms, so the
    LLM sees the same vocabulary the post-process matcher uses.
  - Synonyms are matched case-insensitively. Don't include punctuation.
  - Avoid synonyms shorter than 4 characters unless they're unambiguous; the
    matcher falls back to substring search and short tokens cause false matches.
  - Estimation multipliers target a 3-day emergency supply per the DSWD/NDRRMC
    standard family food pack baseline.
"""

# PERSONS_PER_FAMILY is used by the estimator; keep in sync with estimator.py.
PERSONS_PER_FAMILY: int = 5

CATALOG: dict[str, dict] = {
    # --- Food: staples -----------------------------------------------------
    "rice": {
        "label": "Rice",
        "unit": "kg",
        "synonyms": ["rice", "bigas", "kanin", "sinaing", "rice grains"],
        # ~0.35 kg/person/day × 3 days ≈ 1 kg/person
        "estimate": {"multiplier": 1, "base": "person", "unit": "kg"},
    },
    "canned_goods": {
        "label": "Canned goods",
        "unit": "cans",
        "synonyms": [
            "canned goods", "canned food", "delata", "lata",
            "sardines", "sardinas", "corned beef", "karne norte",
            "tuna", "meatloaf", "luncheon meat", "spam", "century tuna",
        ],
        # 2 cans/person/day × 3 days = 6; round to 6
        "estimate": {"multiplier": 6, "base": "person", "unit": "cans"},
    },
    "noodles": {
        "label": "Instant noodles",
        "unit": "packs",
        "synonyms": [
            "noodles", "instant noodles", "pancit canton", "lucky me",
            "mami", "instant pancit", "miki", "ramen",
        ],
        # 1 pack/person/day × 3 days
        "estimate": {"multiplier": 3, "base": "person", "unit": "packs"},
    },
    "bread_biscuits": {
        "label": "Bread / biscuits",
        "unit": "packs",
        "synonyms": [
            "bread", "tinapay", "pandesal", "biscuits", "biskwit",
            "crackers", "skyflakes", "fita", "monde",
        ],
        # 1 pack/family/day × 3 days; shared among household
        "estimate": {"multiplier": 3, "base": "family", "unit": "packs"},
    },
    "milk": {
        "label": "Milk (powdered/evap)",
        "unit": "packs",
        "synonyms": [
            "milk", "gatas", "powdered milk", "bear brand", "nido",
            "evaporated milk", "alaska", "condensada",
        ],
        # 1 pack/family for 3-day ration; shared
        "estimate": {"multiplier": 1, "base": "family", "unit": "packs"},
    },
    "infant_formula": {
        "label": "Infant formula",
        "unit": "cans",
        "synonyms": [
            "infant formula", "formula", "gatas ng bata", "gatas ng sanggol",
            "bonna", "promil", "lactum", "s26", "enfagrow", "nestogen",
        ],
        # Quantity depends on number of infants — requires human triage
        "estimate": "triage",
    },
    "coffee_sugar": {
        "label": "Coffee / sugar",
        "unit": "packs",
        "synonyms": [
            "coffee", "kape", "sugar", "asukal", "3-in-1", "kopiko",
            "nescafe", "great taste",
        ],
        # 1 pack/family/day × 3 days; shared
        "estimate": {"multiplier": 3, "base": "family", "unit": "packs"},
    },
    "cooking_oil": {
        "label": "Cooking oil",
        "unit": "L",
        "synonyms": ["cooking oil", "mantika", "vegetable oil", "minyak"],
        # ~0.5 L/family for 3-day supply; shared
        "estimate": {"multiplier": 1, "base": "family", "unit": "L"},
    },
    "salt_seasoning": {
        "label": "Salt / seasoning",
        "unit": "packs",
        "synonyms": ["salt", "asin", "seasoning", "magic sarap", "vetsin"],
        # 1 pack/family; shared condiment
        "estimate": {"multiplier": 1, "base": "family", "unit": "packs"},
    },

    # --- Water -------------------------------------------------------------
    "water_drinking": {
        "label": "Drinking water",
        "unit": "L",
        "synonyms": [
            "drinking water", "tubig na inumin", "mineral water",
            "purified water", "tubig", "water", "agua", "inumin",
            "bottled water", "wilkins", "absolute", "nature spring",
            "safe water", "clean water", "potable water",
            "safe drinking water", "malinis na tubig",
        ],
        # WHO/SPHERE minimum: 3 L/person/day × 3 days = 9 L
        "estimate": {"multiplier": 9, "base": "person", "unit": "L"},
    },
    "water_container": {
        "label": "Water container",
        "unit": "pcs",
        "synonyms": [
            "water container", "water jug", "galon ng tubig", "drum",
            "water drum", "jerry can", "balde",
        ],
        # 1 container (≥20 L) per family for water storage
        "estimate": {"multiplier": 1, "base": "family", "unit": "pcs"},
    },

    # --- Hygiene -----------------------------------------------------------
    "hygiene_kit": {
        "label": "Hygiene kit",
        "unit": "kits",
        "synonyms": [
            "hygiene kit", "hygiene", "soap", "sabon", "shampoo",
            "toothpaste", "toothbrush", "sipilyo", "kolgeyt", "colgate",
            "safeguard", "palmolive",
        ],
        # 1 kit/family is the standard DSWD pack
        "estimate": {"multiplier": 1, "base": "family", "unit": "kits"},
    },
    "sanitary_pads": {
        "label": "Sanitary pads",
        "unit": "packs",
        "synonyms": [
            "sanitary pads", "sanitary napkin", "napkin", "modess",
            "whisper", "kotex", "pasador", "menstrual pads",
        ],
        # Depends on female population count — requires human triage
        "estimate": "triage",
    },
    "diapers_baby": {
        "label": "Baby diapers",
        "unit": "packs",
        "synonyms": [
            "baby diapers", "diapers", "lampin", "pampers", "huggies",
            "eq", "drypers", "baby diaper",
        ],
        # Depends on number of infants — requires human triage
        "estimate": "triage",
    },
    "diapers_adult": {
        "label": "Adult diapers",
        "unit": "packs",
        "synonyms": ["adult diapers", "adult diaper", "adult pampers"],
        # Depends on elderly/disabled population — requires human triage
        "estimate": "triage",
    },

    # --- Shelter / bedding -------------------------------------------------
    "blanket": {
        "label": "Blanket",
        "unit": "pcs",
        "synonyms": ["blanket", "blankets", "kumot", "manta"],
        # 1 blanket per person
        "estimate": {"multiplier": 1, "base": "person", "unit": "pcs"},
    },
    "sleeping_mat": {
        "label": "Sleeping mat",
        "unit": "pcs",
        "synonyms": [
            "sleeping mat", "mat", "banig", "mats", "kahoy banig",
            "papag", "tabig",
        ],
        # 1 mat per family (shared floor space in evacuation centers)
        "estimate": {"multiplier": 1, "base": "family", "unit": "pcs"},
    },
    "tarpaulin_tent": {
        "label": "Tarpaulin / tent",
        "unit": "pcs",
        "synonyms": [
            "tarpaulin", "tarp", "trapal", "lona", "tent",
            "tolda", "emergency shelter",
        ],
        # 1 tarp/tent per family for emergency shelter
        "estimate": {"multiplier": 1, "base": "family", "unit": "pcs"},
    },
    "clothes": {
        "label": "Clothes",
        "unit": "pcs",
        "synonyms": [
            "clothes", "clothing", "damit", "panyolito", "ukay",
            "used clothes", "second hand clothes",
        ],
        # 2 sets per person (one on, one spare)
        "estimate": {"multiplier": 2, "base": "person", "unit": "pcs"},
    },

    # --- Light / power -----------------------------------------------------
    "flashlight": {
        "label": "Flashlight",
        "unit": "pcs",
        "synonyms": ["flashlight", "flashlights", "ilaw", "lampara", "torch"],
        # 1 flashlight per family
        "estimate": {"multiplier": 1, "base": "family", "unit": "pcs"},
    },
    "candle": {
        "label": "Candle",
        "unit": "pcs",
        "synonyms": ["candle", "candles", "kandila"],
        # ~3 candles/night × 3 nights = 9 per family; round to 10
        "estimate": {"multiplier": 10, "base": "family", "unit": "pcs"},
    },
    "batteries": {
        "label": "Batteries",
        "unit": "pcs",
        "synonyms": ["batteries", "battery", "baterya", "double a", "triple a"],
        # 4 batteries per family (2 sets for flashlight)
        "estimate": {"multiplier": 4, "base": "family", "unit": "pcs"},
    },
    "power_source": {
        "label": "Power / generator",
        "unit": "pcs",
        "synonyms": [
            "generator", "genset", "power bank", "powerbank",
            "solar lamp", "solar light",
        ],
        # Operational/infrastructure decision — requires human triage
        "estimate": "triage",
    },

    # --- Medical -----------------------------------------------------------
    "medicine_general": {
        "label": "Medicine (general)",
        "unit": "packs",
        "synonyms": [
            "medicine", "gamot", "biogesic", "paracetamol", "neozep",
            "alaxan", "bioflu", "decolgen", "tempra", "mefenamic",
        ],
        # 1 assorted medicine pack per family for 3 days
        "estimate": {"multiplier": 1, "base": "family", "unit": "packs"},
    },
    "first_aid": {
        "label": "First aid kit",
        "unit": "kits",
        "synonyms": [
            "first aid", "first aid kit", "betadine", "bandage",
            "alcohol", "alkohol", "gauze", "cotton", "band aid",
        ],
        # 1 kit per 10 persons (round up); expressed as per-family for simplicity
        "estimate": {"multiplier": 1, "base": "family", "unit": "kits"},
    },
    "face_mask": {
        "label": "Face masks",
        "unit": "pcs",
        "synonyms": [
            "face mask", "facemask", "mask", "n95", "surgical mask",
            "kn95", "face shield",
        ],
        # 2 masks/person/day × 3 days = 6; standard pack is often 5, use 5
        "estimate": {"multiplier": 5, "base": "person", "unit": "pcs"},
    },

    # --- Rescue / personnel ------------------------------------------------
    "rescue_boat": {
        "label": "Rescue boat",
        "unit": "pcs",
        "synonyms": [
            "rescue boat", "rubber boat", "bangka", "boat", "lifeboat",
            "rubber raft",
        ],
        # Operational asset — number depends on geography, not headcount
        "estimate": "triage",
    },
    "rescue_personnel": {
        "label": "Rescue personnel",
        "unit": "people",
        "synonyms": [
            "rescue personnel", "rescuer", "rescuers", "responders",
            "tagasagip", "emergency responders", "first responders",
        ],
        # Operational staffing — requires command decision
        "estimate": "triage",
    },
    "life_vest": {
        "label": "Life vest",
        "unit": "pcs",
        "synonyms": ["life vest", "life jacket", "salbabida"],
        # 1 life vest per person for water rescue / evacuation
        "estimate": {"multiplier": 1, "base": "person", "unit": "pcs"},
    },
}


def all_keys() -> list[str]:
    return list(CATALOG.keys())


def label_for(key: str | None) -> str | None:
    if key and key in CATALOG:
        return CATALOG[key]["label"]
    return None


def unit_for(key: str | None) -> str | None:
    if key and key in CATALOG:
        return CATALOG[key]["unit"]
    return None
