import requests

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "gemma4"


def call_ollama(prompt: str, temperature: float = 0.1) -> str:
    response = requests.post(
        OLLAMA_URL,
        json={
            "model": MODEL_NAME,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature
            }
        },
        timeout=120
    )

    response.raise_for_status()
    return response.json()["response"]
