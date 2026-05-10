import threading
import requests

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "gemma4:e4b"

# Only one Ollama call runs at a time; extras wait in line instead of all
# hitting the model simultaneously and causing timeouts.
_semaphore = threading.Semaphore(1)


def call_ollama(prompt: str, temperature: float = 0.1) -> str:
    with _semaphore:
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
