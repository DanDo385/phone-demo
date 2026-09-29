"""Fake Twilio: exercises a voice engine exactly the way a real inbound call would.

1. POSTs a signed voice webhook to the app (as Twilio does) and follows the TwiML.
2. Opens the <Stream> WebSocket with its <Parameter>s and plays the caller WAV into it
   in real time as 20 ms μ-law frames, while playing the agent's audio from a queue
   (honouring "clear" for barge-in and echoing "mark" events once played).
3. Sends the signed "completed" status callback when either side hangs up.
4. Reports per-turn latency (end of caller speech → first audible agent audio) and
   writes caller-left / agent-right stereo WAV of what the phone line carried.

    uv run --python 3.12 --with websockets --with httpx sim/fake_twilio.py \
        --app http://localhost:3000 --public https://phone-demo.magro.dev \
        --from +17725550199 --audio caller.wav --out run.wav
"""

import argparse
import asyncio
import audioop
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time
import wave
from html import unescape

import httpx
import websockets

FRAME = 160  # 20 ms at 8 kHz μ-law


def sign(token: str, url: str, params: dict) -> str:
    data = url + "".join(k + params[k] for k in sorted(params))
    return base64.b64encode(hmac.new(token.encode(), data.encode(), hashlib.sha1).digest()).decode()


def load_ulaw(path: str) -> bytes:
    with wave.open(path, "rb") as w:
        pcm = w.readframes(w.getnframes())
        if w.getnchannels() == 2:
            pcm = audioop.tomono(pcm, w.getsampwidth(), 0.5, 0.5)
        if w.getsampwidth() != 2:
            pcm = audioop.lin2lin(pcm, w.getsampwidth(), 2)
        pcm, _ = audioop.ratecv(pcm, 2, 1, w.getframerate(), 8000, None)
    return audioop.lin2ulaw(pcm, 2)


def speech_ends(ulaw: bytes, min_gap: float = 0.7) -> list[float]:
    """Seconds where a caller utterance ends (speech followed by ≥ min_gap of silence)."""
    ends, speaking, silent = [], False, 0
    for i in range(0, len(ulaw), FRAME):
        loud = audioop.rms(audioop.ulaw2lin(ulaw[i : i + FRAME], 2), 2) > 500
        if loud:
            speaking, silent = True, 0
        elif speaking:
            silent += 1
            if silent * 0.02 >= min_gap:
                ends.append(round((i / 8000) - min_gap, 2))
                speaking = False
    return ends


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--app", default="http://localhost:3000")
    ap.add_argument("--public", default="https://phone-demo.magro.dev", help="URL Twilio signs against")
    ap.add_argument("--from", dest="caller", required=True)
    ap.add_argument("--to", default="+17372583478")
    ap.add_argument("--audio", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--tail", type=float, default=25, help="seconds to wait after caller audio ends")
    a = ap.parse_args()
    token, account = os.environ["TWILIO_AUTH_TOKEN"], os.environ["TWILIO_ACCOUNT_SID"]
    call_sid = "CA" + secrets.token_hex(16)
    stream_sid = "MZ" + secrets.token_hex(16)

    params = {"CallSid": call_sid, "AccountSid": account, "From": a.caller, "To": a.to, "CallStatus": "ringing", "Direction": "inbound"}
    async with httpx.AsyncClient(timeout=30) as http:
        r = await http.post(
            f"{a.app}/api/webhooks/twilio/voice",
            data=params,
            headers={"X-Twilio-Signature": sign(token, f"{a.public}/api/webhooks/twilio/voice", params)},
        )
    twiml = r.text
    m = re.search(r'<Stream[^>]*url="([^"]+)"', twiml)
    if not m:
        print("TwiML had no <Stream>:", re.sub(r"<[^>]+>", " ", twiml).strip()[:200])
        return
    url = unescape(m.group(1))
    custom = {unescape(n): unescape(v) for n, v in re.findall(r'<Parameter name="([^"]+)" value="([^"]*)"', twiml)}
    engine = "elevenlabs" if "elevenlabs" in url else "self-hosted"
    print(f"engine: {engine}  stream: {url.split('?')[0]}  params: {sorted(custom)}")

    caller = load_ulaw(a.audio)
    ends = speech_ends(caller)
    total = len(caller) / 8000 + a.tail
    sent = bytearray()  # caller track, one byte per 1/8000 s
    heard = bytearray(b"\xff" * (len(caller) + int(a.tail * 8000)))  # agent track as played; 0xFF is μ-law silence
    queue: list[tuple[str, bytes | str]] = []
    state = {"play_pos": 0, "hung_up_by": None}
    t_start = time.monotonic()

    async with websockets.connect(url, max_size=None) as ws:
        await ws.send(json.dumps({"event": "connected", "protocol": "Call", "version": "1.0.0"}))
        await ws.send(
            json.dumps(
                {
                    "event": "start",
                    "sequenceNumber": "1",
                    "streamSid": stream_sid,
                    "start": {
                        "accountSid": account,
                        "streamSid": stream_sid,
                        "callSid": call_sid,
                        "tracks": ["inbound"],
                        "mediaFormat": {"encoding": "audio/x-mulaw", "sampleRate": 8000, "channels": 1},
                        "customParameters": custom,
                    },
                }
            )
        )

        async def receive():
            try:
                async for raw in ws:
                    msg = json.loads(raw)
                    ev = msg.get("event")
                    if ev == "media":
                        queue.append(("audio", base64.b64decode(msg["media"]["payload"])))
                    elif ev == "clear":
                        queue.clear()
                    elif ev == "mark":
                        queue.append(("mark", msg["mark"]["name"]))
            except websockets.ConnectionClosed:
                pass
            state["hung_up_by"] = state["hung_up_by"] or "agent"

        async def play():
            seq = 2
            frame_i = 0
            while True:
                elapsed = time.monotonic() - t_start
                if elapsed > total or state["hung_up_by"]:
                    break
                # Caller → stream, paced in real time.
                while frame_i * FRAME < len(caller) and frame_i * 0.02 <= elapsed:
                    chunk = caller[frame_i * FRAME : (frame_i + 1) * FRAME]
                    frame_i += 1
                    seq += 1
                    sent.extend(chunk)
                    try:
                        await ws.send(json.dumps({"event": "media", "sequenceNumber": str(seq), "streamSid": stream_sid, "media": {"track": "inbound", "chunk": str(frame_i), "timestamp": str(int(frame_i * 20)), "payload": base64.b64encode(chunk).decode()}}))
                    except websockets.ConnectionClosed:
                        state["hung_up_by"] = state["hung_up_by"] or "agent"
                        break
                # Agent → speaker, one playback clock.
                target = int(elapsed * 8000)
                while state["play_pos"] < target:
                    if not queue:
                        state["play_pos"] = target
                        break
                    kind, item = queue[0]
                    if kind == "mark":
                        queue.pop(0)
                        try:
                            await ws.send(json.dumps({"event": "mark", "streamSid": stream_sid, "mark": {"name": item}}))
                        except websockets.ConnectionClosed:
                            pass
                        continue
                    n = min(len(item), target - state["play_pos"])
                    pos = state["play_pos"]
                    if pos + n <= len(heard):
                        heard[pos : pos + n] = item[:n]
                    state["play_pos"] += n
                    rest = item[n:]
                    if rest:
                        queue[0] = ("audio", rest)
                    else:
                        queue.pop(0)
                await asyncio.sleep(0.01)
            if not state["hung_up_by"]:
                state["hung_up_by"] = "caller"
                try:
                    await ws.send(json.dumps({"event": "stop", "streamSid": stream_sid, "stop": {"accountSid": account, "callSid": call_sid}}))
                    await ws.close()
                except websockets.ConnectionClosed:
                    pass

        await asyncio.gather(receive(), play())

    duration = round(time.monotonic() - t_start)
    status = {**params, "CallStatus": "completed", "CallDuration": str(duration)}
    async with httpx.AsyncClient(timeout=30) as http:
        await http.post(
            f"{a.app}/api/webhooks/twilio/status",
            data=status,
            headers={"X-Twilio-Signature": sign(token, f"{a.public}/api/webhooks/twilio/status", status)},
        )

    # Latency: first audible agent audio after each caller utterance ends.
    agent = bytes(heard[: state["play_pos"]])
    starts, loud_prev = [], False
    for i in range(0, len(agent), FRAME):
        loud = audioop.rms(audioop.ulaw2lin(agent[i : i + FRAME], 2), 2) > 300
        if loud and not loud_prev:
            starts.append(i / 8000)
        loud_prev = loud
    turns = []
    for e in ends:
        after = [s for s in starts if s > e + 0.05]
        if after and after[0] - e < 15:
            turns.append(round(after[0] - e, 2))
    print(f"hung up by: {state['hung_up_by']} after {duration}s")
    print(f"caller utterances: {len(ends)}, agent responses measured: {len(turns)}")
    if turns:
        s = sorted(turns)
        print(f"turn latency (s): {turns}")
        print(f"  median {s[len(s) // 2]:.2f}  best {s[0]:.2f}  worst {s[-1]:.2f}")
    greeting = starts[0] if starts else None
    print(f"greeting started at: {greeting:.2f}s after connect" if greeting is not None else "no greeting heard")

    n = max(len(sent), len(agent))
    left = audioop.ulaw2lin(bytes(sent).ljust(n, b"\xff"), 2)
    right = audioop.ulaw2lin(agent.ljust(n, b"\xff"), 2)
    stereo = audioop.add(audioop.tostereo(left, 2, 1, 0), audioop.tostereo(right, 2, 0, 1), 2)
    with wave.open(a.out, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(8000)
        w.writeframes(stereo)
    print(json.dumps({"engine": engine, "call_sid": call_sid, "turns": turns, "greeting": greeting, "hung_up_by": state["hung_up_by"]}))


if __name__ == "__main__":
    asyncio.run(main())
