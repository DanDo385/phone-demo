"""Voice service: Twilio Media Streams WebSocket at /twilio, health at /health.

    uv run uvicorn server:app --host 100.112.2.29 --port 8765

Configuration comes from the environment (see README.md).
"""

import os

from fastapi import FastAPI, Header, HTTPException, WebSocket
from pydantic import BaseModel
from loguru import logger
from pipecat.runner.utils import parse_telephony_websocket

import appclient
from bot import TTS_MODEL, VOICES, run_call
from tts import cached_render

app = FastAPI()
active: set[str] = set()


@app.get("/health")
async def health():
    return {"ok": True, "active_calls": len(active), "together": bool(os.environ.get("TOGETHER_API_KEY"))}


class Prewarm(BaseModel):
    text: str
    language: str = "en"


@app.post("/prewarm")
async def prewarm(body: Prewarm, authorization: str = Header("")):
    """Render and cache a greeting ahead of the call (the app calls this after analysis)."""
    if not appclient.RELAY_SECRET or authorization != f"Bearer {appclient.RELAY_SECRET}":
        raise HTTPException(status_code=401)
    pcm = await cached_render(os.environ["TOGETHER_API_KEY"], TTS_MODEL, VOICES[body.language], body.text[:1000], body.language)
    return {"ok": True, "seconds": round(len(pcm) / 48000, 1)}


@app.websocket("/twilio")
async def twilio(websocket: WebSocket):
    await websocket.accept()
    transport_type, call_data = await parse_telephony_websocket(websocket)
    if transport_type != "twilio":
        await websocket.close(code=4400)
        return
    key = call_data.get("stream_id") or "unknown"
    active.add(key)
    try:
        await run_call(websocket, call_data)
    except Exception:
        logger.exception("call failed")
    finally:
        active.discard(key)
