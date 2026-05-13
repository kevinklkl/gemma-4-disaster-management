import threading
from contextlib import contextmanager
from dataclasses import dataclass, field
import requests

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "gemma4-e2b-unsloth"


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


def _build_result(body: dict) -> OllamaResult:
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


LOCAL_NUM_GPU = 24  # ~60/40 GPU/CPU on host's 6 GB VRAM — tune this per machine


def _request_single(prompt: str, temperature: float, url: str = OLLAMA_URL, num_gpu: int = LOCAL_NUM_GPU) -> OllamaResult:
    response = requests.post(
        url,
        json={
            "model": MODEL_NAME,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "keep_alive": "30m",
            "options": {
                "temperature": temperature,
                "top_p": 0.95,
                "top_k": 64,
                "num_ctx": 2048,
                "num_predict": 512,
                "num_gpu": num_gpu,
            },
        },
        timeout=60,
    )
    response.raise_for_status()
    return _build_result(response.json())


def _request_batch(messages: list[str], temperature: float, url: str = OLLAMA_URL, num_gpu: int = LOCAL_NUM_GPU) -> OllamaResult:
    from prompts.extraction_prompt import build_batch_prompt
    prompt = build_batch_prompt(messages)
    response = requests.post(
        url,
        json={
            "model": MODEL_NAME,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "keep_alive": "30m",
            "options": {
                "temperature": temperature,
                "top_p": 0.95,
                "top_k": 64,
                "num_ctx": 8192,
                "num_predict": 4096,
                "num_gpu": num_gpu,
            },
        },
        timeout=180,
    )
    response.raise_for_status()
    return _build_result(response.json())


@dataclass
class _OllamaNode:
    url: str
    name: str
    num_gpu: int = -1  # -1 = Ollama auto (fills as much GPU as possible)
    lock: threading.Semaphore = field(default_factory=lambda: threading.Semaphore(1))
    busy: bool = False
    jobs_done: int = 0


class NodePool:
    def __init__(self):
        self._nodes: list[_OllamaNode] = []
        self._cv = threading.Condition(threading.Lock())
        self._nodes.append(_OllamaNode(url=OLLAMA_URL, name="local", num_gpu=LOCAL_NUM_GPU))

    def register(self, url: str, name: str, num_gpu: int = -1) -> str:
        with self._cv:
            if any(n.url == url for n in self._nodes):
                return "already_registered"
            self._nodes.append(_OllamaNode(url=url, name=name, num_gpu=num_gpu))
            return "registered"

    def _try_acquire(self) -> "_OllamaNode | None":
        for node in self._nodes:
            if node.lock.acquire(blocking=False):
                node.busy = True
                return node
        return None

    @contextmanager
    def acquire(self):
        """Yield a free node. Any node finishing wakes all waiters so the queue
        drains across all nodes, not just local."""
        with self._cv:
            while True:
                node = self._try_acquire()
                if node:
                    break
                self._cv.wait()

        try:
            yield node
        finally:
            node.busy = False
            node.jobs_done += 1
            node.lock.release()
            with self._cv:
                self._cv.notify_all()

    def unregister(self, url: str) -> bool:
        with self._cv:
            before = len(self._nodes)
            self._nodes = [n for n in self._nodes if n.url != url]
            self._cv.notify_all()
            return len(self._nodes) < before

    def list_nodes(self) -> list[dict]:
        with self._cv:
            return [
                {"url": n.url, "name": n.name, "busy": n.busy, "jobs_done": n.jobs_done}
                for n in self._nodes
            ]


node_pool = NodePool()
# Backward-compat alias — api.py no longer imports this after the update,
# but keeps things from blowing up if any other code still references it.
ollama_lock = node_pool._nodes[0].lock


def call_ollama(prompt: str, temperature: float = 1.0) -> OllamaResult:
    with node_pool.acquire() as node:
        return _request_single(prompt, temperature, url=node.url, num_gpu=node.num_gpu)


def call_ollama_batch(messages: list[str], temperature: float = 1.0) -> OllamaResult:
    with node_pool.acquire() as node:
        return _request_batch(messages, temperature, url=node.url, num_gpu=node.num_gpu)
