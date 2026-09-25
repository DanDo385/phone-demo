"""Calls from the voice service back to the Next app (APP_BASE_URL).

The app owns everything business-specific: the prospect's script (served through the
relay), the mock calendar tools, the transcript store and the post-call summary.
"""

import hashlib
import hmac
import io
import json
import os
import wave

import httpx

APP = os.environ.get("APP_BASE_URL", "http://localhost:3000").rstrip("/")
RELAY_SECRET = os.environ.get("LLM_RELAY_SECRET", "")
TOOL_SECRET = os.environ.get("TOOL_WEBHOOK_SECRET", "")

_client = httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=5.0))


def valid_token(prospect_id: str, call_sid: str, greeting: str, token: str) -> bool:
    """Checks the token the app put in the TwiML (HMAC of prospect id, call id and greeting)."""
    if not RELAY_SECRET or not token:
        return False
    message = f"{prospect_id}:{call_sid}:{greeting}".encode()
    expected = hmac.new(RELAY_SECRET.encode(), message, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, token)


async def prospect(prospect_id: str) -> dict | None:
    response = await _client.get(f"{APP}/api/prospects/{prospect_id}")
    if response.status_code != 200:
        return None
    body = response.json()
    return body if body.get("status") == "ready" and body.get("analysis") else None


async def call_tool(name: str, args: dict) -> dict:
    response = await _client.post(
        f"{APP}/api/prospect-tools/{name}",
        headers={"x-tool-secret": TOOL_SECRET},
        json=args,
    )
    try:
        return response.json()
    except ValueError:
        return {"ok": False, "error": f"Tool returned {response.status_code}"}


def stereo_wav(pcm: bytes, sample_rate: int, channels: int) -> bytes:
    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setnchannels(channels)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(pcm)
    return out.getvalue()


async def finish(conversation_id: str, call_sid: str, lines: list[dict], wav: bytes | None) -> dict:
    files = {"audio": ("call.wav", wav, "audio/wav")} if wav else None
    response = await _client.post(
        f"{APP}/api/voice/finish",
        headers={"authorization": f"Bearer {RELAY_SECRET}"},
        data={"meta": json.dumps({"conversation_id": conversation_id, "call_sid": call_sid, "lines": lines})},
        files=files,
        timeout=90.0,
    )
    return {"status": response.status_code, "body": response.text[:300]}
