import threading
from dataclasses import dataclass
import requests

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "gemma4:e4b"

# Only one Ollama call runs at a time; extras wait in line instead of all
# hitting the model simultaneously and causing timeouts.
_semaphore = threading.Semaphore(1)


@dataclass
class OllamaResult:
    response: str
    total_ms: float
    load_ms: float
    prompt_eval_ms: float
    eval_ms: float
    prompt_tokens: int
    eval_tokens: int

    @property
    def tokens_per_sec(self) -> float:
        if self.eval_ms <= 0:
            return 0.0
        return self.eval_tokens / (self.eval_ms / 1000)

    def timing_summary(self) -> str:
        return (
            f"total={self.total_ms:.0f}ms  "
            f"load={self.load_ms:.0f}ms  "
            f"prompt_eval={self.prompt_eval_ms:.0f}ms ({self.prompt_tokens} tok)  "
            f"generate={self.eval_ms:.0f}ms ({self.eval_tokens} tok, {self.tokens_per_sec:.1f} tok/s)"
        )


def call_ollama(prompt: str, temperature: float = 0.1) -> OllamaResult:
    with _semaphore:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": MODEL_NAME,
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "keep_alive": "30m",
                "options": {
                    "temperature": temperature,
                    "num_ctx": 1024,
                    "num_predict": 120,
                },
            },
            timeout=90,
        )
        response.raise_for_status()
        body = response.json()

    ns = 1_000_000  # nanoseconds → milliseconds
    return OllamaResult(
        response=body["response"],
        total_ms=body.get("total_duration", 0) / ns,
        load_ms=body.get("load_duration", 0) / ns,
        prompt_eval_ms=body.get("prompt_eval_duration", 0) / ns,
        eval_ms=body.get("eval_duration", 0) / ns,
        prompt_tokens=body.get("prompt_eval_count", 0),
        eval_tokens=body.get("eval_count", 0),
    )
