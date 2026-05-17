"""Post-extraction check: determine if a reply to the sender is needed.

Runs after validate_and_canonicalize(). Acts as a safety net when Gemma
misses obvious cases where the sender needs a response.
"""

from __future__ import annotations

_QUESTION_WORDS = {
    # English
    "where", "when", "how", "what", "who", "can", "could", "may", "is", "are",
    "do", "does", "did", "will", "would", "should", "have", "has",
    # Tagalog/Taglish
    "saan", "kailan", "paano", "sino", "ano", "meron", "mayroon", "pwede",
    "puwede", "available", "may", "nandoon", "nasaan",
}

_INQUIRY_PHRASES = [
    "where can i", "where can we", "how do i", "how do we",
    "is there", "are there", "do you have", "can i", "can we",
    "gusto ko", "gusto namin", "nagbibigay", "tumatanggap",
    "accepting donations", "donation",
]


def check_reply_needed(extracted: dict, original_message: str = "") -> dict:
    """Return updated extracted dict with reply_needed, reply_draft, and reply_draft_source set.

    reply_draft_source values:
      'ai_single'   — AI wrote the draft in a full single-message call (high quality, keep)
      'ai_template' — template or no draft yet; eligible for AI single upgrade later
      None          — no reply needed
    """
    already_has_draft = bool(extracted.get("reply_draft"))

    if already_has_draft:
        extracted["reply_needed"] = True
        # Draft came from the AI's rep field in a single-message call
        extracted["reply_draft_source"] = "ai_single"
        return extracted

    msg_lower = original_message.lower().strip()

    missing_location = not extracted.get("location")
    no_items = not extracted.get("items")

    is_question = (
        msg_lower.endswith("?")
        or any(msg_lower.startswith(w) for w in _QUESTION_WORDS)
        or any(phrase in msg_lower for phrase in _INQUIRY_PHRASES)
    )

    if missing_location and not no_items:
        extracted["reply_needed"] = True
        extracted["reply_draft"] = _location_request_template(original_message)
        extracted["reply_draft_source"] = "ai_template"
        return extracted

    if is_question or (no_items and missing_location):
        extracted["reply_needed"] = True
        extracted["reply_draft_source"] = "ai_template"
        return extracted

    extracted["reply_needed"] = False
    extracted["reply_draft_source"] = None
    return extracted


def _location_request_template(message: str) -> str | None:
    """Generate a minimal location-request reply based on message language."""
    msg_lower = message.lower()
    tagalog_hints = {"kailangan", "tulong", "paki", "po", "kami", "namin", "walang", "wala"}
    is_tagalog = any(w in msg_lower for w in tagalog_hints)

    if is_tagalog:
        return "Natanggap po ang inyong mensahe. Maaari po bang ibahagi ang inyong eksaktong lokasyon (barangay/bayan) para makatulong agad?"
    return "Message received. Please share your exact location (barangay/town) so we can send help right away."
