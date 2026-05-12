import asyncio
import csv
import json
import os
import sqlite3
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, List, Optional
from fastapi import FastAPI, Request, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from engine.ollama_client import call_ollama, call_ollama_batch, ollama_lock, _request_single, _request_batch
from engine.extraction.parser import parse_response
from engine.extraction.validator import validate_and_canonicalize
from prompts.extraction_prompt import build_extraction_prompt

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
        ]:
            if col not in existing:
                conn.execute(f"ALTER TABLE messages ADD COLUMN {col} {definition}")


init_db()

_event_loop = None


@app.on_event("startup")
async def _store_loop():
    global _event_loop
    _event_loop = asyncio.get_event_loop()
    # Requeue any messages left as needs_processing from before a server restart
    with get_db() as conn:
        stuck = conn.execute(
            "SELECT id, message FROM messages WHERE status = 'needs_processing'"
        ).fetchall()
    if stuck:
        print(f"[startup] requeueing {len(stuck)} stuck messages")
        import threading
        threading.Thread(target=_run_gemma_bg, args=(stuck[0]["id"], stuck[0]["message"]), daemon=True).start()


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
    }



def _parse_batch_response(text: str) -> list:
    """Extract a JSON array from a free-text batch response."""
    original = text
    text = text.strip()
    
    # Strip markdown fences
    if text.startswith("```json"): text = text[7:]
    if text.startswith("```"): text = text[3:]
    if text.endswith("```"): text = text[:-3]
    text = text.strip()
    
    # Look for the outermost Object {}
    start = text.find("{")
    end = text.rfind("}")
    
    if start == -1 or end == -1 or end <= start:
        print(f"[batch parse] no object found in response.")
        return []
        
    try:
        # Load the whole string between { and }
        parsed = json.loads(text[start:end + 1])
    except json.JSONDecodeError as e:
        print(f"[batch parse] JSON error: {e} — response snippet: {repr(text[start:start+300])}")
        return []
        
    # Extract the array from our "results" wrapper
    if isinstance(parsed, dict) and "results" in parsed:
        return parsed["results"]
        
    return []

def _run_gemma_bg(msg_id: int, content: str):
    """Wait for the Ollama lock, then sweep the DB for all queued messages and batch them."""
    with ollama_lock:
        # We now hold the lock — any tasks that queued up while we were waiting
        # will have their messages sitting as needs_processing in the DB.
        started_at = datetime.now(timezone.utc)
        with get_db() as conn:
            rows = conn.execute(
                "SELECT id, message FROM messages WHERE status = 'needs_processing' LIMIT ?",
                (BATCH_SIZE,)
            ).fetchall()
            if not rows:
                return  # Another worker already processed everything
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
                result = _request_single(build_extraction_prompt(all_contents[0]), temperature=0.1)
                t1 = time.perf_counter()
                data = validate_and_canonicalize(parse_response(result.response))
                t2 = time.perf_counter()
                duration_ms = int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)
                with get_db() as conn:
                    conn.execute(
                        "UPDATE messages SET extracted_data = ?, status = 'processed', processing_duration_ms = ? WHERE id = ?",
                        (json.dumps(data), duration_ms, all_ids[0])
                    )
                    conn.commit()
                t3 = time.perf_counter()
                _broadcast_sync({"type": "processing_done", "msgId": str(all_ids[0]), "durationMs": duration_ms, "extractedData": data})
                t4 = time.perf_counter()
                print(
                    f"[msg {all_ids[0]}] total={duration_ms}ms"
                    f"  ollama={1000*(t1-t0):.0f}ms"
                    f"  parse={1000*(t2-t1):.0f}ms"
                    f"  db={1000*(t3-t2):.0f}ms"
                    f"  broadcast={1000*(t4-t3):.0f}ms"
                    f"  [{result.timing_summary()}]"
                )
            else:
                t0 = time.perf_counter()
                result = _request_batch(all_contents, temperature=0.0)
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
                                "UPDATE messages SET extracted_data = ?, status = 'processed', processing_duration_ms = ? WHERE id = ?",
                                (json.dumps(data), duration_ms, mid)
                            )
                            _broadcast_sync({"type": "processing_done", "msgId": str(mid), "durationMs": duration_ms, "extractedData": data})
                        else:
                            conn.execute("UPDATE messages SET status = 'needs_processing' WHERE id = ?", (mid,))
                    conn.commit()
                t3 = time.perf_counter()
                filled = min(len(items), len(all_ids))
                print(
                    f"[batch {filled}/{len(all_ids)} msgs] total={duration_ms}ms"
                    f"  ollama={1000*(t1-t0):.0f}ms"
                    f"  parse={1000*(t2-t1):.0f}ms"
                    f"  db={1000*(t3-t2):.0f}ms"
                    f"  [{result.timing_summary()}]"
                )
        except Exception as e:
            with get_db() as conn:
                for mid in all_ids:
                    conn.execute("UPDATE messages SET status = 'needs_processing' WHERE id = ?", (mid,))
                conn.commit()
            print(f"Gemma failed for messages {all_ids}: {e}")


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
        result = call_ollama_batch(contents)
        t1 = time.perf_counter()

        items = [validate_and_canonicalize(item) for item in _parse_batch_response(result.response)]

        t2 = time.perf_counter()
        duration_ms = int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)

        with get_db() as conn:
            for i, msg_id in enumerate(msg_ids):
                if i < len(items):
                    data = items[i]
                    conn.execute(
                        "UPDATE messages SET extracted_data = ?, status = 'processed', processing_duration_ms = ? WHERE id = ?",
                        (json.dumps(data), duration_ms, msg_id)
                    )
                    _broadcast_sync({"type": "processing_done", "msgId": str(msg_id), "durationMs": duration_ms, "extractedData": data})
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
        with get_db() as conn:
            for msg_id in msg_ids:
                conn.execute("UPDATE messages SET status = 'needs_processing' WHERE id = ?", (msg_id,))
            conn.commit()
        print(f"Batch Gemma failed for messages {msg_ids}: {e}")
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
    return {"ok": True, "service": "Bayanihan-AI SMS receiver"}


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
def get_messages():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM messages WHERE status != 'fulfilled' ORDER BY id DESC"
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
