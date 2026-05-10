from engine.ollama_client import call_ollama

prompt = """
Extract donation inventory as JSON only:

"may 500 canned goods kami dito sa Cebu port, may tubig din mga 100 liters, tawagan si Ate Rosa 0917-555-1234"
"""

result = call_ollama(prompt)
print(result.response)
print()
print(result.timing_summary())
