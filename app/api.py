from datetime import datetime
from typing import Any
from fastapi import FastAPI, Request

app = FastAPI()

INBOX = []


@app.get("/")
def health_check():
    return {
        "ok": True,
        "service": "Bayanihan-AI SMS receiver"
    }


@app.post("/")
async def receive_sms_root(request: Request):
    return await receive_sms(request)


@app.post("/sms/inbound")
async def receive_sms(request: Request):
    """
    Flexible SMS receiver endpoint.
    Accepts JSON or form data from SMS Forwarder apps.
    """
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

    record = {
        "id": len(INBOX) + 1,
        "sender": sender,
        "message": message,
        "received_at": payload.get("received_at") or datetime.utcnow().isoformat(),
        "source": "sms_forwarder",
        "raw_payload": payload,
    }
    INBOX.append(record)
    print("NEW SMS:", record)

    return {
        "ok": True,
        "received": record,
        "inbox_count": len(INBOX),
    }


@app.get("/sms/inbox")
def get_inbox():
    return {
        "messages": INBOX
    }
