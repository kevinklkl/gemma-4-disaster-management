import asyncio
import csv
import ipaddress
import json
import os
import socket
import sqlite3
import threading
import time
import requests
from zeroconf import ServiceInfo, Zeroconf
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, List, Optional
from fastapi import FastAPI, Request, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from engine.ollama_client import call_ollama, call_ollama_batch, node_pool, _request_single, _request_batch, MODEL_NAME, ANDROID_MODEL_NAME, LOCAL_NUM_GPU, transfer_model_to_node
from engine.extraction.parser import parse_response
from engine.extraction.validator import validate_and_canonicalize
from prompts.extraction_prompt import build_extraction_prompt, _get_shared_prefix

app = FastAPI()


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        dead = []
        for ws in self.active_connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "data/inbox.db"


def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                sender         TEXT,
                message        TEXT,
                received_at    TEXT,
                source         TEXT,
                raw_payload    TEXT,
                status         TEXT DEFAULT 'needs_processing',
                extracted_data TEXT,
                message_type   TEXT DEFAULT 'sms'
            )
        """)
        # Migrate existing DBs that may be missing the new columns
        existing = {row[1] for row in conn.execute("PRAGMA table_info(messages)")}
        for col, definition in [
            ("status", "TEXT DEFAULT 'needs_processing'"),
            ("extracted_data", "TEXT"),
            ("message_type", "TEXT DEFAULT 'sms'"),
            ("packing_state", "TEXT"),
            ("processing_started_at", "TEXT"),
            ("processing_duration_ms", "INTEGER"),
            ("processing_node", "TEXT"),
            ("retry_count", "INTEGER DEFAULT 0"),
        ]:
            if col not in existing:
                conn.execute(f"ALTER TABLE messages ADD COLUMN {col} {definition}")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_received_at ON messages(received_at)")


init_db()

_event_loop = None
_zeroconf: Zeroconf | None = None
_zeroconf_info: ServiceInfo | None = None

MDNS_NAME = "gemma-host.local"
MDNS_PORT = 8000


def _get_local_ip() -> str:
    """Return the LAN IP, skipping VPN/virtual interfaces."""
    # Collect all non-loopback IPv4 addresses for this host
    try:
        candidates = [
            info[4][0]
            for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET)
            if not info[4][0].startswith("127.")
        ]
    except Exception:
        candidates = []

    # Prefer 192.168.x.x (typical home/office LAN) over VPN ranges
    for ip in candidates:
        if ip.startswith("192.168."):
            return ip

    # Fall back to routing-table trick (picks whichever interface reaches the internet)
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


@app.on_event("startup")
async def _startup():
    global _event_loop, _zeroconf, _zeroconf_info
    _event_loop = asyncio.get_event_loop()

    # Reset any messages left mid-processing from a previous crash, then requeue all pending
    with get_db() as conn:
        conn.execute("UPDATE messages SET status = 'needs_processing' WHERE status = 'processing'")
        conn.commit()
        stuck = conn.execute(
            "SELECT id, message FROM messages WHERE status = 'needs_processing'"
        ).fetchall()
    if stuck:
        print(f"[startup] requeueing {len(stuck)} stuck messages")
        import threading
        threading.Thread(target=_run_gemma_bg, args=(stuck[0]["id"], stuck[0]["message"]), daemon=True).start()

    # Register mDNS so workers can reach this machine as gemma-host.local
    local_ip = _get_local_ip()
    _zeroconf = Zeroconf()
    _zeroconf_info = ServiceInfo(
        "_http._tcp.local.",
        "GemmaHost._http._tcp.local.",
        addresses=[socket.inet_aton(local_ip)],
        port=MDNS_PORT,
        properties={},
        server=f"{MDNS_NAME}.",
    )
    await asyncio.to_thread(_zeroconf.register_service, _zeroconf_info)
    print(f"[mdns] {MDNS_NAME} → {local_ip}:{MDNS_PORT}")


@app.on_event("shutdown")
async def _shutdown():
    if _zeroconf and _zeroconf_info:
        await asyncio.to_thread(_zeroconf.unregister_service, _zeroconf_info)
        await asyncio.to_thread(_zeroconf.close)


def _broadcast_sync(payload: dict):
    if _event_loop:
        asyncio.run_coroutine_threadsafe(manager.broadcast(payload), _event_loop)


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def row_to_message(r: sqlite3.Row) -> dict:
    return {
        "id": str(r["id"]),
        "type": r["message_type"] or "sms",
        "source": r["sender"] or "unknown",
        "time": r["received_at"] or "",
        "content": r["message"] or "",
        "status": r["status"] or "needs_processing",
        "extractedData": json.loads(r["extracted_data"]) if r["extracted_data"] else None,
        "packingState": json.loads(r["packing_state"]) if r["packing_state"] else {},
        "processingStartedAt": r["processing_started_at"],
        "processingDurationMs": r["processing_duration_ms"],
        "processingNode": r["processing_node"],
    }



_json_decoder = json.JSONDecoder(strict=False)


def _parse_batch_response(text: str) -> list:
    """Extract a JSON array from a free-text batch response."""
    text = text.strip()

    # Strip markdown fences
    if text.startswith("```json"): text = text[7:]
    if text.startswith("```"): text = text[3:]
    if text.endswith("```"): text = text[:-3]
    text = text.strip()

    start = text.find("{")
    if start == -1:
        print(f"[batch parse] no object found in response. Raw ({len(text)} chars): {repr(text[:300])}")
        return []

    # raw_decode parses the first complete JSON object and ignores trailing
    # garbage (e.g. a stray second object the model appended after closing "results").
    # strict=False tolerates raw control characters copied from SMS text.
    try:
        parsed, _ = _json_decoder.raw_decode(text, start)
    except json.JSONDecodeError as e:
        # Truncated mid-stream — try closing the array and object to salvage complete items.
        end = text.rfind("}")
        if end != -1 and end > start:
            try:
                parsed, _ = _json_decoder.raw_decode(text[start:end + 1] + "]}", 0)
            except json.JSONDecodeError:
                print(f"[batch parse] JSON error: {e} — response snippet: {repr(text[start:start+300])}")
                return []
        else:
            print(f"[batch parse] JSON error: {e} — response snippet: {repr(text[start:start+300])}")
            return []

    if isinstance(parsed, dict) and "results" in parsed:
        return parsed["results"]

    return []

def _run_gemma_bg(msg_id: int, content: str):
    """Acquire a node from the pool, sweep the DB for all queued messages and batch them."""
    with node_pool.acquire() as node:
        started_at = datetime.now(timezone.utc)
        with get_db() as conn:
            rows = conn.execute(
                "SELECT id, message FROM messages WHERE status = 'needs_processing' LIMIT ?",
                (node.max_batch,)
            ).fetchall()
            if not rows:
                return
            all_ids = [r["id"] for r in rows]
            all_contents = [r["message"] for r in rows]
            conn.execute(
                f"UPDATE messages SET status = 'processing', processing_started_at = ? "
                f"WHERE id IN ({','.join('?' * len(all_ids))})",
                [started_at.isoformat()] + all_ids
            )
            conn.commit()

        for mid in all_ids:
            _broadcast_sync({"type": "processing_started", "msgId": str(mid), "startedAt": started_at.isoformat()})

        try:
            if len(all_ids) == 1:
                t0 = time.perf_counter()
                result = _request_single(build_extraction_prompt(all_contents[0]), temperature=0.1, url=node.url, num_gpu=node.num_gpu, prefix_cached=node.prefix_cached)
                t1 = time.perf_counter()
                data = validate_and_canonicalize(parse_response(result.response))
                t2 = time.perf_counter()
                duration_ms = int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)
                with get_db() as conn:
                    conn.execute(
                        "UPDATE messages SET extracted_data = ?, status = 'processed', processing_duration_ms = ?, processing_node = ? WHERE id = ?",
                        (json.dumps(data), duration_ms, node.name, all_ids[0])
                    )
                    conn.commit()
                t3 = time.perf_counter()
                _broadcast_sync({"type": "processing_done", "msgId": str(all_ids[0]), "durationMs": duration_ms, "extractedData": data, "nodeName": node.name})
                t4 = time.perf_counter()
                print(
                    f"[msg {all_ids[0]} @{node.name}] total={duration_ms}ms"
                    f"  ollama={1000*(t1-t0):.0f}ms"
                    f"  parse={1000*(t2-t1):.0f}ms"
                    f"  db={1000*(t3-t2):.0f}ms"
                    f"  broadcast={1000*(t4-t3):.0f}ms"
                    f"  [{result.timing_summary()}]"
                )
            else:
                t0 = time.perf_counter()
                result = _request_batch(all_contents, temperature=0.0, url=node.url, num_gpu=node.num_gpu, prefix_cached=node.prefix_cached)
                t1 = time.perf_counter()
                items = _parse_batch_response(result.response)
                items = [validate_and_canonicalize(item) for item in items]
                t2 = time.perf_counter()
                duration_ms = int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)
                with get_db() as conn:
                    for i, mid in enumerate(all_ids):
                        if i < len(items):
                            data = items[i]
                            conn.execute(
                                "UPDATE messages SET extracted_data = ?, status = 'processed', processing_duration_ms = ?, processing_node = ? WHERE id = ?",
                                (json.dumps(data), duration_ms, node.name, mid)
                            )
                            _broadcast_sync({"type": "processing_done", "msgId": str(mid), "durationMs": duration_ms, "extractedData": data, "nodeName": node.name})
                        else:
                            conn.execute("UPDATE messages SET status = 'needs_processing' WHERE id = ?", (mid,))
                    conn.commit()
                t3 = time.perf_counter()
                filled = min(len(items), len(all_ids))
                print(
                    f"[batch {filled}/{len(all_ids)} @{node.name}] total={duration_ms}ms"
                    f"  ollama={1000*(t1-t0):.0f}ms"
                    f"  parse={1000*(t2-t1):.0f}ms"
                    f"  db={1000*(t3-t2):.0f}ms"
                    f"  [{result.timing_summary()}]"
                )
        except Exception as e:
            print(f"Gemma failed for messages {all_ids}: {e}")
            to_retry, to_fail = [], []
            with get_db() as conn:
                rows = conn.execute(
                    f"SELECT id, retry_count FROM messages WHERE id IN ({','.join('?'*len(all_ids))})",
                    all_ids,
                ).fetchall()
                counts = {r["id"]: (r["retry_count"] or 0) for r in rows}
                for mid in all_ids:
                    if counts.get(mid, 0) < 1:
                        conn.execute(
                            "UPDATE messages SET status='needs_processing', retry_count=1 WHERE id=?", (mid,)
                        )
                        to_retry.append(mid)
                    else:
                        conn.execute("UPDATE messages SET status='failed' WHERE id=?", (mid,))
                        to_fail.append(mid)
                conn.commit()
            for mid in to_fail:
                _broadcast_sync({"type": "processing_failed", "msgId": str(mid)})
            if to_retry:
                import threading
                threading.Thread(target=_run_gemma_bg, args=(to_retry[0], ""), daemon=True).start()


BATCH_SIZE = 10
BATCH_THRESHOLD = 2


def _run_gemma_batch(msg_ids: list, contents: list):
    """Single Ollama call for up to BATCH_SIZE messages; response is a JSON array."""
    started_at = datetime.now(timezone.utc)
    n = len(msg_ids)

    with get_db() as conn:
        for msg_id in msg_ids:
            conn.execute(
                "UPDATE messages SET status = 'processing', processing_started_at = ? WHERE id = ?",
                (started_at.isoformat(), msg_id)
            )
        conn.commit()
    for msg_id in msg_ids:
        _broadcast_sync({"type": "processing_started", "msgId": str(msg_id), "startedAt": started_at.isoformat()})

    try:
        t0 = time.perf_counter()
        node_name = "local"
        with node_pool.acquire() as node:
            cap = node.max_batch
            if len(msg_ids) > cap:
                requeue_ids = msg_ids[cap:]
                msg_ids  = msg_ids[:cap]
                contents = contents[:cap]
                with get_db() as conn:
                    conn.execute(
                        f"UPDATE messages SET status='needs_processing' WHERE id IN ({','.join('?'*len(requeue_ids))})",
                        requeue_ids,
                    )
                    conn.commit()
                threading.Thread(target=_run_gemma_bg, args=(requeue_ids[0], ""), daemon=True).start()
            n = len(msg_ids)
            result = _request_batch(contents, temperature=0.0, url=node.url, num_gpu=node.num_gpu)
            node_name = node.name
        t1 = time.perf_counter()

        items = [validate_and_canonicalize(item) for item in _parse_batch_response(result.response)]

        t2 = time.perf_counter()
        duration_ms = int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)

        with get_db() as conn:
            for i, msg_id in enumerate(msg_ids):
                if i < len(items):
                    data = items[i]
                    conn.execute(
                        "UPDATE messages SET extracted_data = ?, status = 'processed', processing_duration_ms = ?, processing_node = ? WHERE id = ?",
                        (json.dumps(data), duration_ms, node_name, msg_id)
                    )
                    _broadcast_sync({"type": "processing_done", "msgId": str(msg_id), "durationMs": duration_ms, "extractedData": data, "nodeName": node_name})
                else:
                    # Truncated — requeue for retry
                    conn.execute("UPDATE messages SET status = 'needs_processing' WHERE id = ?", (msg_id,))
            conn.commit()
        t3 = time.perf_counter()

        filled = min(len(items), n)
        missed = n - filled
        print(
            f"[batch {filled}/{n} msgs] total={duration_ms}ms"
            f"  ollama={1000*(t1-t0):.0f}ms"
            f"  parse={1000*(t2-t1):.0f}ms"
            f"  db={1000*(t3-t2):.0f}ms"
            f"  [{result.timing_summary()}]"
        )
        # Gemma returned a truncated response — re-trigger the sweep so the
        # requeued messages don't sit as needs_processing indefinitely.
        if missed > 0:
            print(f"[batch] {missed} msgs truncated — re-triggering sweep")
            leftover_ids = msg_ids[filled:]
            import threading
            threading.Thread(
                target=_run_gemma_bg,
                args=(leftover_ids[0], ""),
                daemon=True,
            ).start()
    except Exception as e:
        print(f"Batch Gemma failed for messages {msg_ids}: {e}")
        with get_db() as conn:
            for msg_id in msg_ids:
                # Count this batch attempt as the first try so _run_gemma_bg is the final retry
                conn.execute(
                    "UPDATE messages SET status='needs_processing', retry_count=1 WHERE id=?", (msg_id,)
                )
            conn.commit()
        import threading
        threading.Thread(target=_run_gemma_bg, args=(msg_ids[0], ""), daemon=True).start()


class ProcessRequest(BaseModel):
    content: str
    id: Optional[str] = None


class StatusUpdate(BaseModel):
    status: str


class PackingUpdate(BaseModel):
    itemIndex: int
    packedQty: int


class ManualMessage(BaseModel):
    content: str
    source: str = "Manual Entry"
    message_type: str = "walkin"


@app.get("/")
def health_check():
    return {"ok": True, "service": "akbay SMS receiver"}


@app.post("/")
async def receive_sms_root(request: Request, background_tasks: BackgroundTasks):
    return await receive_sms(request, background_tasks)


@app.post("/sms/inbound")
async def receive_sms(request: Request, background_tasks: BackgroundTasks):
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        payload: dict[str, Any] = await request.json()
    else:
        form = await request.form()
        payload = dict(form)

    # SMS Forwarder packs "From : NAME()\nMESSAGE" into a single "key" field
    if "key" in payload:
        key_val = payload["key"]
        lines = key_val.split("\n", 1)
        first_line = lines[0]
        if first_line.startswith("From : "):
            sender = first_line[len("From : "):].split("(")[0].strip()
        else:
            sender = first_line.strip()
        message = lines[1].strip() if len(lines) > 1 else ""
    else:
        sender = (
            payload.get("sender")
            or payload.get("from")
            or payload.get("phone")
            or payload.get("address")
            or payload.get("number")
            or "unknown"
        )
        message = (
            payload.get("message")
            or payload.get("body")
            or payload.get("text")
            or payload.get("content")
            or ""
        )

    received_at = payload.get("received_at") or datetime.now(timezone.utc).isoformat()

    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO messages (sender, message, received_at, source, raw_payload, status, message_type) "
            "VALUES (?, ?, ?, ?, ?, 'needs_processing', 'sms')",
            (sender, message, received_at, "sms_forwarder", json.dumps(payload))
        )
        conn.commit()
        row_id = cur.lastrowid
        count = conn.execute("SELECT COUNT(*) FROM messages").fetchone()[0]

    record = {
        "id": row_id,
        "sender": sender,
        "message": message,
        "received_at": received_at,
        "source": "sms_forwarder",
        "raw_payload": payload,
    }
    print("NEW SMS:", record)
    background_tasks.add_task(_run_gemma_bg, row_id, message)

    return {"ok": True, "received": record, "inbox_count": count}


@app.get("/sms/inbox")
def get_inbox():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, sender, message, received_at, source, raw_payload FROM messages ORDER BY id DESC"
        ).fetchall()
    messages = [
        {**dict(r), "raw_payload": json.loads(r["raw_payload"] or "{}")}
        for r in rows
    ]
    return {"messages": messages}


@app.get("/api/messages")
def get_messages(limit: int = 50, offset: int = 0, source: str = "", q: str = ""):
    conditions = ["status != 'fulfilled'"]
    params: list = []

    if source and source != "all":
        conditions.append("message_type = ?")
        params.append(source)

    if q.strip():
        conditions.append("(sender LIKE ? OR message LIKE ?)")
        like = f"%{q.strip()}%"
        params.extend([like, like])

    where = " AND ".join(conditions)
    with get_db() as conn:
        total = conn.execute(
            f"SELECT COUNT(*) FROM messages WHERE {where}", params
        ).fetchone()[0]
        rows = conn.execute(
            f"SELECT * FROM messages WHERE {where} ORDER BY id DESC LIMIT ? OFFSET ?",
            params + [limit, offset]
        ).fetchall()
    return {"messages": [row_to_message(r) for r in rows], "total": total, "offset": offset, "limit": limit}


@app.get("/api/stats")
def get_stats():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT status, COUNT(*) as cnt FROM messages GROUP BY status"
        ).fetchall()
    counts = {r["status"]: r["cnt"] for r in rows}
    return {
        "processed": counts.get("processed", 0),
        "inQueue": counts.get("needs_processing", 0) + counts.get("processing", 0),
        "failed": counts.get("failed", 0),
    }


@app.get("/api/messages/history")
def get_history():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM messages WHERE status = 'fulfilled' ORDER BY id DESC LIMIT 200"
        ).fetchall()
    return [row_to_message(r) for r in rows]


SYNTHETIC_CSV = os.path.join(os.path.dirname(__file__), "..", "data", "synthetic_demand_messages.csv")


@app.post("/api/seed-inbox")
def seed_inbox(background_tasks: BackgroundTasks):
    csv_path = os.path.normpath(SYNTHETIC_CSV)
    if not os.path.exists(csv_path):
        raise HTTPException(status_code=404, detail=f"CSV not found: {csv_path}")

    received_at = datetime.now(timezone.utc).isoformat()
    inserted = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        with get_db() as conn:
            for row in reader:
                content = row.get("message", "").strip()
                if not content:
                    continue
                cur = conn.execute(
                    "INSERT INTO messages (sender, message, received_at, source, raw_payload, status, message_type) "
                    "VALUES (?, ?, ?, 'synthetic', '{}', 'needs_processing', 'sms')",
                    ("Synthetic", content, received_at)
                )
                inserted.append((cur.lastrowid, content))
            conn.commit()

    # Mark all as processing immediately so the frontend doesn't auto-trigger
    # individual /api/process_message calls before the batch tasks run.
    if len(inserted) > BATCH_THRESHOLD:
        started_at = received_at
        with get_db() as conn:
            for msg_id, _ in inserted:
                conn.execute(
                    "UPDATE messages SET status = 'processing', processing_started_at = ? WHERE id = ?",
                    (started_at, msg_id)
                )
            conn.commit()

    if len(inserted) > BATCH_THRESHOLD:
        for i in range(0, len(inserted), BATCH_SIZE):
            chunk = inserted[i:i + BATCH_SIZE]
            background_tasks.add_task(_run_gemma_batch, [x[0] for x in chunk], [x[1] for x in chunk])
    else:
        for msg_id, content in inserted:
            background_tasks.add_task(_run_gemma_bg, msg_id, content)

    return {"ok": True, "queued": len(inserted)}


@app.patch("/api/messages/{message_id}/status")
def update_status(message_id: int, body: StatusUpdate):
    allowed = {"needs_processing", "processing", "processed", "fulfilled", "failed"}
    if body.status not in allowed:
        raise HTTPException(status_code=400, detail=f"status must be one of {allowed}")
    with get_db() as conn:
        result = conn.execute(
            "UPDATE messages SET status = ? WHERE id = ?", (body.status, message_id)
        )
        conn.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Message not found")
    return {"ok": True}


@app.post("/api/messages")
def create_message(body: ManualMessage, background_tasks: BackgroundTasks):
    received_at = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO messages (sender, message, received_at, source, raw_payload, status, message_type) "
            "VALUES (?, ?, ?, 'manual', '{}', 'needs_processing', ?)",
            (body.source, body.content, received_at, body.message_type)
        )
        conn.commit()
        row_id = cur.lastrowid
        row = conn.execute("SELECT * FROM messages WHERE id = ?", (row_id,)).fetchone()
    background_tasks.add_task(_run_gemma_bg, row_id, body.content)
    return row_to_message(row)


@app.patch("/api/messages/{message_id}/packing")
async def update_packing(message_id: int, body: PackingUpdate):
    with get_db() as conn:
        row = conn.execute("SELECT packing_state FROM messages WHERE id = ?", (message_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Message not found")
        state = json.loads(row["packing_state"]) if row["packing_state"] else {}
        state[str(body.itemIndex)] = body.packedQty
        conn.execute(
            "UPDATE messages SET packing_state = ? WHERE id = ?",
            (json.dumps(state), message_id)
        )
        conn.commit()
    await manager.broadcast({
        "type": "packing_update",
        "msgId": str(message_id),
        "itemIndex": body.itemIndex,
        "packedQty": body.packedQty,
    })
    return {"ok": True}


class NodeRegistration(BaseModel):
    name: str = ""
    android: bool = False


def _detect_num_gpu(ip: str) -> int:
    """
    Probe remote Ollama to choose num_gpu.

    Strategy: run the probe with num_ctx=8192 (our batch context size).
    Ollama allocates the full KV cache at load time, so size_vram after the
    generate call = model weights + KV cache that actually fit in VRAM.
    - Tight VRAM (6 GB): KV overflows to RAM → size_vram ≈ size (weights only)
    - Ample VRAM (16 GB+): KV stays in VRAM → size_vram > size by ~1.5–2 GB
    The delta between size_vram and size is therefore a direct VRAM-headroom signal.
    """
    base = f"http://{ip}:11434"
    ONE_GB = 1 * 1024 ** 3

    # Load model at full GPU with the same large context we use in batch mode.
    # This forces KV cache allocation so we can measure how much fit in VRAM.
    try:
        requests.post(
            f"{base}/api/generate",
            json={
                "model": MODEL_NAME,
                "prompt": "hi",
                "stream": False,
                "keep_alive": "5m",
                "options": {"num_predict": 1, "num_gpu": -1, "num_ctx": 8192},
            },
            timeout=120,
        )
    except Exception:
        return -1

    try:
        ps_resp = requests.get(f"{base}/api/ps", timeout=5)
        ps_resp.raise_for_status()
        entry = next(
            (m for m in ps_resp.json().get("models", []) if MODEL_NAME in m.get("name", "")),
            None,
        )
        if entry is None:
            return -1
        size = entry.get("size", 0)
        size_vram = entry.get("size_vram", 0)
    except Exception:
        return -1

    if size <= 0:
        return -1

    # Model weights only partially loaded (less VRAM than model size)
    if size_vram < size * 0.99:
        return max(1, round(LOCAL_NUM_GPU * (size_vram / size)))

    # KV cache delta: how much of the KV cache stayed in VRAM alongside the weights.
    # ≥ 2 GB delta → device has enough headroom to run at full GPU.
    # < 2 GB delta → KV overflowed to RAM; use the calibrated conservative setting.
    kv_in_vram = size_vram - size
    if kv_in_vram >= ONE_GB:
        return -1

    return LOCAL_NUM_GPU


def _transfer_then_register(ip: str, node_name: str, android: bool = False):
    """Background task: push the model to a node that lacks it, then register it."""
    base_url = f"http://{ip}:11434"
    if transfer_model_to_node(base_url):
        num_gpu = _detect_num_gpu(ip)
        status = node_pool.register(f"{base_url}/api/generate", node_name, num_gpu=num_gpu, prefix_cached=True, android=android)
        print(f"[nodes] {ip} ({node_name}) auto-registered after transfer, status={status}")
    else:
        print(f"[nodes] model transfer to {ip} ({node_name}) failed — node not added")


@app.post("/api/nodes")
async def register_node(request: Request, body: NodeRegistration):
    # X-Forwarded-For is set by the Vite dev proxy (xfwd: true).
    # Falls back to request.client.host in production (no proxy).
    ip = request.headers.get("x-forwarded-for") or request.client.host
    try:
        is_loopback = ipaddress.ip_address(ip).is_loopback
    except ValueError:
        is_loopback = ip == "localhost"
    if is_loopback:
        return {"ok": True, "status": "loopback", "nodes": node_pool.list_nodes()}

    # Verify Ollama is reachable
    try:
        resp = await asyncio.to_thread(
            lambda: requests.get(f"http://{ip}:11434/api/tags", timeout=5)
        )
        resp.raise_for_status()
        installed = [m["name"] for m in resp.json().get("models", [])]
        is_android = any(ANDROID_MODEL_NAME in m for m in installed)
        has_model = is_android or any(MODEL_NAME in m for m in installed)
    except Exception:
        return {"ok": False, "status": "unreachable", "nodes": node_pool.list_nodes()}

    node_name = body.name or ip

    if not has_model:
        threading.Thread(
            target=_transfer_then_register, args=(ip, node_name, is_android), daemon=True
        ).start()
        return {"ok": True, "status": "transferring", "nodes": node_pool.list_nodes()}

    # Android nodes use LiteRT — num_gpu is irrelevant and the probe crashes LiteRT
    if is_android:
        num_gpu = -1
    else:
        num_gpu = await asyncio.to_thread(_detect_num_gpu, ip)
    print(f"[nodes] {ip} ({node_name}) detected num_gpu={num_gpu}, android={is_android}")

    url = f"http://{ip}:11434/api/generate"
    status = node_pool.register(url, node_name, num_gpu=num_gpu, prefix_cached=True, android=is_android)
    return {"ok": True, "status": status, "nodes": node_pool.list_nodes(), "cache_prompt": _get_shared_prefix()}


@app.get("/api/nodes")
def list_nodes():
    return {"nodes": node_pool.list_nodes()}


@app.get("/api/nodes/me")
async def node_status_me(request: Request):
    ip = request.headers.get("x-forwarded-for") or request.client.host
    try:
        is_loopback = ipaddress.ip_address(ip).is_loopback
    except ValueError:
        is_loopback = ip == "localhost"
    if is_loopback:
        return {"registered": True, "isHost": True}
    url = f"http://{ip}:11434/api/generate"
    registered = any(n["url"] == url for n in node_pool.list_nodes())
    return {"registered": registered, "isHost": False}


@app.get("/api/nodes/probe")
async def probe_node(request: Request):
    """Silently attempt to auto-register the caller if their Ollama is already running."""
    ip = request.headers.get("x-forwarded-for") or request.client.host
    try:
        is_loopback = ipaddress.ip_address(ip).is_loopback
    except ValueError:
        is_loopback = ip == "localhost"
    if is_loopback:
        return {"joined": True, "isHost": True}

    url = f"http://{ip}:11434/api/generate"
    if any(n["url"] == url for n in node_pool.list_nodes()):
        return {"joined": True, "isHost": False, "nodes": node_pool.list_nodes()}

    try:
        resp = await asyncio.to_thread(
            lambda: requests.get(f"http://{ip}:11434/api/tags", timeout=3)
        )
        resp.raise_for_status()
        installed = [m["name"] for m in resp.json().get("models", [])]
        is_android = any(ANDROID_MODEL_NAME in m for m in installed)
        has_model = is_android or any(MODEL_NAME in m for m in installed)
    except Exception:
        return {"joined": False}

    if not has_model:
        threading.Thread(
            target=_transfer_then_register, args=(ip, ip), daemon=True
        ).start()
        return {"joined": False, "transferring": True}

    node_pool.register(url, ip, num_gpu=-1, prefix_cached=True, android=is_android)
    return {"joined": True, "isHost": False, "nodes": node_pool.list_nodes()}


@app.delete("/api/nodes/me")
async def unregister_node_me(request: Request):
    ip = request.headers.get("x-forwarded-for") or request.client.host
    url = f"http://{ip}:11434/api/generate"
    removed = node_pool.unregister(url)
    return {"ok": removed, "nodes": node_pool.list_nodes()}


@app.get("/api/nodes/join-script")
async def download_join_script(request: Request, name: str = ""):
    host_base = f"http://{MDNS_NAME}:{MDNS_PORT}"

    safe_name = (
        name.replace('"', "").replace("'", "").replace("\\", "")
        .replace("`", "").replace("\n", "").replace("\r", "").strip()[:64]
    )

    ua = request.headers.get("user-agent", "")
    if "Windows" in ua:
        name_val = safe_name if safe_name else "%COMPUTERNAME%"
        script = (
            "@echo off\r\n"
            'if "%1"=="run" goto run\r\n'
            'start "" /MIN "%~f0" run\r\n'
            "exit /b\r\n"
            ":run\r\n"
            'echo [1/4] Opening firewall for Ollama...\r\n'
            "netsh advfirewall firewall add rule name=\"Ollama Node\" dir=in action=allow protocol=TCP localport=11434 > nul 2>&1\r\n"
            'echo [2/4] Starting Ollama...\r\n'
            'start /MIN "Akbay Node" cmd /k "set OLLAMA_HOST=0.0.0.0 && ollama serve"\r\n'
            "set tries=0\r\n"
            ":wait\r\n"
            "timeout /t 1 /nobreak > nul\r\n"
            "curl -s http://localhost:11434/api/tags > nul 2>&1\r\n"
            "if not errorlevel 1 goto register\r\n"
            "set /a tries=tries+1\r\n"
            "if %tries% lss 15 goto wait\r\n"
            ":register\r\n"
            'echo [3/4] Connecting to host...\r\n'
            f'curl -X POST {host_base}/api/nodes'
            f' -H "Content-Type: application/json"'
            f' -d "{{\\\"name\\\":\\\"{name_val}\\\"}}"\r\n'
            'echo.\r\n'
            'echo [4/4] Done! If you see "transferring" above, the AI model is being\r\n'
            'echo       copied to this device in the background. Keep this window open.\r\n'
            "pause\r\n"
        )
        filename = "join-node.bat"
    else:
        node_name = safe_name if safe_name else "$(hostname)"
        script = (
            "#!/bin/bash\n"
            'chmod +x "$0"\n'
            'echo "Starting Ollama on the network..."\n'
            "OLLAMA_HOST=0.0.0.0 ollama serve &\n"
            "OLLAMA_PID=$!\n"
            "sleep 4\n"
            'echo "Connecting to host..."\n'
            f'NODE_NAME="{node_name}"\n'
            f'curl -s -X POST {host_base}/api/nodes \\\n'
            '  -H "Content-Type: application/json" \\\n'
            '  -d "{\\"name\\":\\"$NODE_NAME\\"}"\n'
            'echo ""\n'
            'echo "Done! Keep this window open while sharing this computer."\n'
            'echo "Press Ctrl+C to stop contributing."\n'
            "wait $OLLAMA_PID\n"
        )
        filename = "join-node.command"

    return Response(
        content=script,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/api/retry-failed")
def retry_failed(background_tasks: BackgroundTasks):
    with get_db() as conn:
        rows = conn.execute("SELECT id FROM messages WHERE status='failed'").fetchall()
        ids = [r["id"] for r in rows]
        if not ids:
            return {"ok": True, "queued": 0}
        conn.execute("UPDATE messages SET status='needs_processing', retry_count=0 WHERE status='failed'")
        conn.commit()
    background_tasks.add_task(_run_gemma_bg, ids[0], "")
    return {"ok": True, "queued": len(ids)}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.post("/api/process_message")
async def process_message(req: ProcessRequest):
    started_at = datetime.now(timezone.utc)
    try:
        if req.id is not None:
            with get_db() as conn:
                conn.execute(
                    "UPDATE messages SET status = 'processing', processing_started_at = ? WHERE id = ?",
                    (started_at.isoformat(), int(req.id))
                )
                conn.commit()
            await manager.broadcast({"type": "processing_started", "msgId": req.id, "startedAt": started_at.isoformat()})

        prompt = build_extraction_prompt(req.content)
        t0 = time.perf_counter()
        result = await asyncio.to_thread(call_ollama, prompt, 0.1)
        t1 = time.perf_counter()
        data = validate_and_canonicalize(parse_response(result.response))
        t2 = time.perf_counter()
        duration_ms = int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)

        if req.id is not None:
            with get_db() as conn:
                conn.execute(
                    "UPDATE messages SET extracted_data = ?, status = 'processed', processing_duration_ms = ? WHERE id = ?",
                    (json.dumps(data), duration_ms, int(req.id))
                )
                conn.commit()
            t3 = time.perf_counter()
            await manager.broadcast({"type": "processing_done", "msgId": req.id, "durationMs": duration_ms, "extractedData": data})
            t4 = time.perf_counter()
            print(
                f"[process_message {req.id}] total={duration_ms}ms"
                f"  ollama={1000*(t1-t0):.0f}ms"
                f"  parse={1000*(t2-t1):.0f}ms"
                f"  db={1000*(t3-t2):.0f}ms"
                f"  broadcast={1000*(t4-t3):.0f}ms"
                f"  [{result.timing_summary()}]"
            )
        else:
            print(
                f"[process_message] total={duration_ms}ms"
                f"  ollama={1000*(t1-t0):.0f}ms"
                f"  parse={1000*(t2-t1):.0f}ms"
                f"  [{result.timing_summary()}]"
            )

        return {"extractedData": data, "durationMs": duration_ms}
    except Exception as e:
        if req.id is not None:
            with get_db() as conn:
                conn.execute("UPDATE messages SET status = 'needs_processing' WHERE id = ?", (int(req.id),))
                conn.commit()
        print(f"Error processing message: {e}")
        raise HTTPException(status_code=500, detail="Failed to process message")
