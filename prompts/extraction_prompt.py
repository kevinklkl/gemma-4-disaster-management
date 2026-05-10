GEMMA_PROMPT_TEMPLATE = """Return compact valid JSON only. No markdown. No explanation.
Extract relief needs from the message. "tawo" means people. If unknown, use null.
Schema:
{{"location":null,"urgency":"low|medium|high|critical","persons":null,"items":[{{"name":"string","qty":null}}]}}
Message: {content}
JSON:""".strip()
