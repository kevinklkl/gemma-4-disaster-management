GEMMA_PROMPT_TEMPLATE = """
    Extract the requested relief goods information from this message.
    Note that "tawo" means people, divide it by 5 to estimate families if exact families are not given.
    Message to process: {content}

    Return ONLY a valid JSON object matching this schema:
    {{
        "location": "The location, address, or sitio mentioned.",
        "urgency": "critical, high, medium, or low",
        "families": <number of families>,
        "items": [
            {{
                "name": "item name",
                "qty": <number>
            }}
        ]
    }}
    Do not wrap the JSON in Markdown formatting like ```json ... ```. Just return the raw JSON object.
    """
