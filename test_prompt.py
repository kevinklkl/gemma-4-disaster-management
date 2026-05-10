from engine.ollama_client import call_ollama

try:
    res = call_ollama("Respond with 'hello'")
    print(res)
except Exception as e:
    print(e)
