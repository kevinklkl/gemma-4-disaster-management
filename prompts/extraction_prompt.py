GEMMA_PROMPT_TEMPLATE = """Return compact valid JSON only. No markdown. No explanation.
Extract relief needs from the message. "tawo" means people. If unknown, use null.
Schema:
{{"location":null,"urgency":"low|medium|high|critical","persons":null,"items":[{{"name":"string","qty":null}}]}}
Message: {content}
JSON:""".strip()

GEMMA_BATCH_PROMPT_TEMPLATE = """Return a JSON array of exactly {n} objects. No markdown. No explanation.
Extract relief needs from each numbered message. "tawo" means people. If unknown, use null.
Object schema: {{"location":null,"urgency":"low|medium|high|critical","persons":null,"items":[{{"name":"string","qty":null}}]}}
{numbered_messages}
JSON array:""".strip()
