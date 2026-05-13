import json
import os
import pathlib
import shutil
import subprocess
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

# IPs currently being transferred to — prevents probe_node from spawning
# duplicate transfer threads while one is already in progress.
_transfers_in_progress: set[str] = set()
_transfers_lock = threading.Lock()


def _get_ollama_models_dir() -> "pathlib.Path | None":
    for candidate in [
        pathlib.Path(os.environ.get("USERPROFILE", "")) / ".ollama" / "models",
        pathlib.Path.home() / ".ollama" / "models",
    ]:
        if candidate.exists():
            return candidate
    return None


def _find_model_manifest(models_dir: pathlib.Path, model_name: str) -> "pathlib.Path | None":
    name, tag = (model_name.split(":", 1) + ["latest"])[:2]
    base = models_dir / "manifests" / "registry.ollama.ai"
    for candidate in [
        base / "library" / name / tag,
        base / name / tag,
        base / "library" / name / "latest",
        base / name / "latest",
    ]:
        if candidate.exists():
            return candidate
    return None


def _upload_blob(node_base_url: str, digest: str, blob_path: pathlib.Path, retries: int = 3) -> bool:
    size_mb = blob_path.stat().st_size // (1024 * 1024)
    url = f"{node_base_url}/api/blobs/{digest}"
    use_curl = shutil.which("curl") is not None

    for attempt in range(1, retries + 1):
        print(f"[model-transfer] uploading {digest[:20]}… ({size_mb} MB) attempt {attempt}/{retries}")
        try:
            if use_curl:
                result = subprocess.run(
                    ["curl", "-s", "-X", "POST", url,
                     "-H", "Content-Type: application/octet-stream",
                     "--data-binary", f"@{blob_path}",
                     "--max-time", "1800",
                     "-w", "\n%{http_code}"],
                    capture_output=True, text=True, timeout=1900,
                )
                status = result.stdout.strip().splitlines()[-1] if result.stdout.strip() else "0"
                if result.returncode == 0 and status.startswith("2"):
                    return True
                print(f"[model-transfer] curl upload failed: http={status} {result.stderr[:200]}")
            else:
                with open(blob_path, "rb") as f:
                    up = requests.post(
                        url, data=f,
                        headers={"Content-Type": "application/octet-stream",
                                 "Content-Length": str(blob_path.stat().st_size)},
                        timeout=1800,
                    )
                if up.ok:
                    return True
                print(f"[model-transfer] upload failed ({up.status_code}): {up.text}")
        except Exception as e:
            print(f"[model-transfer] upload error (attempt {attempt}): {e}")
    return False


def transfer_model_to_node(node_base_url: str) -> bool:
    """Copy MODEL_NAME from the local Ollama to a remote Ollama node over LAN.

    Reads the OCI manifest from disk to find all blob digests (works for both
    pulled models and local GGUF imports), uploads each blob to the remote node,
    then calls /api/create to register the model name.
    """
    ip = node_base_url.split("//")[-1].split(":")[0]
    with _transfers_lock:
        if ip in _transfers_in_progress:
            print(f"[model-transfer] transfer to {ip} already in progress, skipping")
            return False
        _transfers_in_progress.add(ip)

    try:
        return _do_transfer(node_base_url)
    finally:
        with _transfers_lock:
            _transfers_in_progress.discard(ip)


def _do_transfer(node_base_url: str) -> bool:
    print(f"[model-transfer] starting → {node_base_url}")

    models_dir = _get_ollama_models_dir()
    if not models_dir:
        print("[model-transfer] cannot locate local ~/.ollama/models")
        return False

    manifest_path = _find_model_manifest(models_dir, MODEL_NAME)
    if not manifest_path:
        print(f"[model-transfer] cannot find manifest for {MODEL_NAME}")
        return False

    with open(manifest_path) as f:
        manifest = json.load(f)

    blobs_dir = models_dir / "blobs"

    all_layers = []
    if "config" in manifest:
        all_layers.append(manifest["config"])
    all_layers.extend(manifest.get("layers", []))

    model_blob_digest = next(
        (l["digest"] for l in manifest.get("layers", [])
         if l.get("mediaType") == "application/vnd.ollama.image.model"),
        None,
    )

    for layer in all_layers:
        digest = layer["digest"]
        blob_path = blobs_dir / digest.replace(":", "-")
        if not blob_path.exists():
            print(f"[model-transfer] blob not found: {blob_path}")
            return False

        try:
            head = requests.head(f"{node_base_url}/api/blobs/{digest}", timeout=5)
            if head.status_code == 200:
                print(f"[model-transfer] {digest[:20]}… already on node, skipping")
                continue
        except Exception:
            pass

        if not _upload_blob(node_base_url, digest, blob_path):
            return False

        print(f"[model-transfer] {digest[:20]}… done")

    try:
        show = requests.post(
            "http://localhost:11434/api/show",
            json={"model": MODEL_NAME},
            timeout=10,
        )
        show.raise_for_status()
        show_data = show.json()
    except Exception as e:
        print(f"[model-transfer] /api/show failed: {e}")
        show_data = {}

    if model_blob_digest:
        lines = [f"FROM @{model_blob_digest}"]
        if show_data.get("template"):
            lines.append(f'TEMPLATE """{show_data["template"]}"""')
        if show_data.get("system"):
            lines.append(f'SYSTEM """{show_data["system"]}"""')
        for param_line in (show_data.get("parameters") or "").strip().splitlines():
            if param_line.strip():
                lines.append(f"PARAMETER {param_line.strip()}")
        modelfile = "\n".join(lines)
    else:
        modelfile = show_data.get("modelfile", f"FROM {MODEL_NAME}")

    try:
        create = requests.post(
            f"{node_base_url}/api/create",
            json={"model": MODEL_NAME, "modelfile": modelfile, "stream": False},
            timeout=120,
        )
        if not create.ok:
            print(f"[model-transfer] /api/create failed: {create.text}")
            return False
    except Exception as e:
        print(f"[model-transfer] /api/create error: {e}")
        return False

    print(f"[model-transfer] ✓ {MODEL_NAME} ready on {node_base_url}")
    return True


def call_ollama(prompt: str, temperature: float = 1.0) -> OllamaResult:
    with node_pool.acquire() as node:
        return _request_single(prompt, temperature, url=node.url, num_gpu=node.num_gpu)


def call_ollama_batch(messages: list[str], temperature: float = 1.0) -> OllamaResult:
    with node_pool.acquire() as node:
        return _request_batch(messages, temperature, url=node.url, num_gpu=node.num_gpu)
