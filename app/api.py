import json
from datetime import datetime
from typing import Any
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from engine.ollama_client import call_ollama

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ProcessRequest(BaseModel):
    content: str

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

@app.post("/api/process_message")
async def process_message(req: ProcessRequest):
    prompt = f"""
    Extract the requested relief goods information from this message.
    Note that "tawo" means people, divide it by 5 to estimate families if exact families are not given.
    Message to process: {req.content}

    Return ONLY a valid JSON object matching this schema:
    {{
        "location": "The location, address, or sitio mentioned.",
        "urgency": "critical, high, medium, or low",
        "families": <number of families>,
        "items": [
            {{
                "name": "item name",
                "qty": <number>
            }}
        ]
    }}
    Do not wrap the JSON in Markdown formatting like ```json ... ```. Just return the raw JSON object.
    """

    try:
        response_text = call_ollama(prompt, temperature=0.1)
        response_text = response_text.strip()

        # In case the model returns markdown JSON blocks
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]

        data = json.loads(response_text)
        return data
    except Exception as e:
        print(f"Error processing message: {e}")
        raise HTTPException(status_code=500, detail="Failed to process message")
