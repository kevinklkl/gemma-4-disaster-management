import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, List, Optional
from fastapi import FastAPI, Request, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from engine.ollama_client import call_ollama
from prompts.extraction_prompt import GEMMA_PROMPT_TEMPLATE

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
        ]:
            if col not in existing:
                conn.execute(f"ALTER TABLE messages ADD COLUMN {col} {definition}")


init_db()


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
    }



def _parse_gemma_response(text: str) -> dict:
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return json.loads(text)


def _run_gemma_bg(msg_id: int, content: str):
    """Background task: run Gemma extraction and persist result to DB."""
    try:
        raw = call_ollama(GEMMA_PROMPT_TEMPLATE.format(content=content), temperature=0.1)
        data = _parse_gemma_response(raw)
        with get_db() as conn:
            conn.execute(
                "UPDATE messages SET extracted_data = ?, status = 'processed' WHERE id = ?",
                (json.dumps(data), msg_id)
            )
            conn.commit()
        print(f"Gemma processed message {msg_id}: {data}")
    except Exception as e:
        print(f"Background Gemma failed for message {msg_id}: {e}")


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


@app.patch("/api/messages/{message_id}/status")
def update_status(message_id: int, body: StatusUpdate):
    allowed = {"needs_processing", "processed", "fulfilled"}
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
    try:
        raw = call_ollama(GEMMA_PROMPT_TEMPLATE.format(content=req.content), temperature=0.1)
        data = _parse_gemma_response(raw)

        if req.id is not None:
            with get_db() as conn:
                conn.execute(
                    "UPDATE messages SET extracted_data = ?, status = 'processed' WHERE id = ?",
                    (json.dumps(data), int(req.id))
                )
                conn.commit()

        return data
    except Exception as e:
        print(f"Error processing message: {e}")
        raise HTTPException(status_code=500, detail="Failed to process message")
