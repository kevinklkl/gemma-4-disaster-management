"""Canonical relief-item taxonomy for the Philippines disaster response system.

Each entry maps a canonical key to:
  - label:    human-readable display name (English)
  - unit:     default unit used when the message doesn't specify one
  - synonyms: surface forms (Tagalog + English + common brand names) that should
              map to this key. Used by the deterministic matcher as a safety net
              and surfaced to Gemma in the extraction prompt.

When editing this catalog, keep in mind:
  - The prompt template enumerates these keys and their top synonyms, so the
    LLM sees the same vocabulary the post-process matcher uses.
  - Synonyms are matched case-insensitively. Don't include punctuation.
  - Avoid synonyms shorter than 4 characters unless they're unambiguous; the
    matcher falls back to substring search and short tokens cause false matches.
"""

CATALOG: dict[str, dict] = {
    # --- Food: staples -----------------------------------------------------
    "rice": {
        "label": "Rice",
        "unit": "kg",
        "synonyms": ["rice", "bigas", "kanin", "sinaing", "rice grains"],
    },
    "canned_goods": {
        "label": "Canned goods",
        "unit": "cans",
        "synonyms": [
            "canned goods", "canned food", "delata", "lata",
            "sardines", "sardinas", "corned beef", "karne norte",
            "tuna", "meatloaf", "luncheon meat", "spam", "century tuna",
        ],
    },
    "noodles": {
        "label": "Instant noodles",
        "unit": "packs",
        "synonyms": [
            "noodles", "instant noodles", "pancit canton", "lucky me",
            "mami", "instant pancit", "miki", "ramen",
        ],
    },
    "bread_biscuits": {
        "label": "Bread / biscuits",
        "unit": "packs",
        "synonyms": [
            "bread", "tinapay", "pandesal", "biscuits", "biskwit",
            "crackers", "skyflakes", "fita", "monde",
        ],
    },
    "milk": {
        "label": "Milk (powdered/evap)",
        "unit": "packs",
        "synonyms": [
            "milk", "gatas", "powdered milk", "bear brand", "nido",
            "evaporated milk", "alaska", "condensada",
        ],
    },
    "infant_formula": {
        "label": "Infant formula",
        "unit": "cans",
        "synonyms": [
            "infant formula", "formula", "gatas ng bata", "gatas ng sanggol",
            "bonna", "promil", "lactum", "s26", "enfagrow", "nestogen",
        ],
    },
    "coffee_sugar": {
        "label": "Coffee / sugar",
        "unit": "packs",
        "synonyms": [
            "coffee", "kape", "sugar", "asukal", "3-in-1", "kopiko",
            "nescafe", "great taste",
        ],
    },
    "cooking_oil": {
        "label": "Cooking oil",
        "unit": "L",
        "synonyms": ["cooking oil", "mantika", "vegetable oil", "minyak"],
    },
    "salt_seasoning": {
        "label": "Salt / seasoning",
        "unit": "packs",
        "synonyms": ["salt", "asin", "seasoning", "magic sarap", "vetsin"],
    },

    # --- Water -------------------------------------------------------------
    "water_drinking": {
        "label": "Drinking water",
        "unit": "L",
        "synonyms": [
            "drinking water", "tubig na inumin", "mineral water",
            "purified water", "tubig", "water", "agua", "inumin",
            "bottled water", "wilkins", "absolute", "nature spring",
        ],
    },
    "water_container": {
        "label": "Water container",
        "unit": "pcs",
        "synonyms": [
            "water container", "water jug", "galon ng tubig", "drum",
            "water drum", "jerry can", "balde",
        ],
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
    },
    "sanitary_pads": {
        "label": "Sanitary pads",
        "unit": "packs",
        "synonyms": [
            "sanitary pads", "sanitary napkin", "napkin", "modess",
            "whisper", "kotex", "pasador", "menstrual pads",
        ],
    },
    "diapers_baby": {
        "label": "Baby diapers",
        "unit": "packs",
        "synonyms": [
            "baby diapers", "diapers", "lampin", "pampers", "huggies",
            "eq", "drypers", "baby diaper",
        ],
    },
    "diapers_adult": {
        "label": "Adult diapers",
        "unit": "packs",
        "synonyms": ["adult diapers", "adult diaper", "adult pampers"],
    },

    # --- Shelter / bedding -------------------------------------------------
    "blanket": {
        "label": "Blanket",
        "unit": "pcs",
        "synonyms": ["blanket", "blankets", "kumot", "manta"],
    },
    "sleeping_mat": {
        "label": "Sleeping mat",
        "unit": "pcs",
        "synonyms": [
            "sleeping mat", "mat", "banig", "mats", "kahoy banig",
            "papag", "tabig",
        ],
    },
    "tarpaulin_tent": {
        "label": "Tarpaulin / tent",
        "unit": "pcs",
        "synonyms": [
            "tarpaulin", "tarp", "trapal", "lona", "tent",
            "tolda", "emergency shelter",
        ],
    },
    "clothes": {
        "label": "Clothes",
        "unit": "pcs",
        "synonyms": [
            "clothes", "clothing", "damit", "panyolito", "ukay",
            "used clothes", "second hand clothes",
        ],
    },

    # --- Light / power -----------------------------------------------------
    "flashlight": {
        "label": "Flashlight",
        "unit": "pcs",
        "synonyms": ["flashlight", "flashlights", "ilaw", "lampara", "torch"],
    },
    "candle": {
        "label": "Candle",
        "unit": "pcs",
        "synonyms": ["candle", "candles", "kandila"],
    },
    "batteries": {
        "label": "Batteries",
        "unit": "pcs",
        "synonyms": ["batteries", "battery", "baterya", "double a", "triple a"],
    },
    "power_source": {
        "label": "Power / generator",
        "unit": "pcs",
        "synonyms": [
            "generator", "genset", "power bank", "powerbank",
            "solar lamp", "solar light",
        ],
    },

    # --- Medical -----------------------------------------------------------
    "medicine_general": {
        "label": "Medicine (general)",
        "unit": "packs",
        "synonyms": [
            "medicine", "gamot", "biogesic", "paracetamol", "neozep",
            "alaxan", "bioflu", "decolgen", "tempra", "mefenamic",
        ],
    },
    "first_aid": {
        "label": "First aid kit",
        "unit": "kits",
        "synonyms": [
            "first aid", "first aid kit", "betadine", "bandage",
            "alcohol", "alkohol", "gauze", "cotton", "band aid",
        ],
    },
    "face_mask": {
        "label": "Face masks",
        "unit": "pcs",
        "synonyms": [
            "face mask", "facemask", "mask", "n95", "surgical mask",
            "kn95", "face shield",
        ],
    },

    # --- Rescue / personnel ------------------------------------------------
    "rescue_boat": {
        "label": "Rescue boat",
        "unit": "pcs",
        "synonyms": [
            "rescue boat", "rubber boat", "bangka", "boat", "lifeboat",
            "rubber raft",
        ],
    },
    "rescue_personnel": {
        "label": "Rescue personnel",
        "unit": "people",
        "synonyms": [
            "rescue personnel", "rescuer", "rescuers", "responders",
            "tagasagip", "emergency responders", "first responders",
        ],
    },
    "life_vest": {
        "label": "Life vest",
        "unit": "pcs",
        "synonyms": ["life vest", "life jacket", "salbabida"],
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
