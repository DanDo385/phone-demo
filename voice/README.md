# Self-hosted voice (prototype)

An alternative to ElevenLabs for prospect **phone** calls. Twilio still owns the phone
number; everything after the audio stream is ours and runs on open-weight speech models.

```
Twilio call ──webhook──► Next app (/api/webhooks/twilio/voice)
                          │  PROSPECT_VOICE_ENGINE=selfhosted → TwiML <Connect><Stream>
                          ▼     (prospect_id, call_sid, greeting, HMAC token)
            voice server (this directory, Pipecat 1.11) /twilio
              μ-law 8 kHz ─► Silero VAD (0.2 s) + Smart Turn v3 (local ONNX)
                          ─► Parakeet TDT 0.6B v3 (Together realtime)
                          ─► Next app relay /api/llm/v1 ─► Claude  (prospect script, tools, live transcript)
                          ─► Kokoro-82M (Together, one HTTP request per phrase) ─► μ-law 8 kHz
              tools → /api/prospect-tools/*        end of call → /api/voice/finish
                                                   (timed transcript + stereo WAV)
```

The Next app is unchanged for everything else: the relay applies the prospect's script
and records the live transcript exactly as for the ElevenLabs agent, and `/api/voice/finish`
stores the recording and runs the same summary and transcript email.

## Models

| Stage | Model | Licence | Where it runs now |
| --- | --- | --- | --- |
| Voice activity | Silero VAD | MIT | voice server CPU |
| End of turn | Smart Turn v3.2 | BSD-2 | voice server CPU |
| Speech to text | NVIDIA Parakeet TDT 0.6B v3 | CC-BY-4.0 | Together (hosted open weights) |
| Speech | Kokoro-82M (`af_heart`, Spanish `ef_dora`) | Apache-2.0 | Together (hosted open weights) |
| Replies | Claude via the relay | — | Anthropic |

Together hosts the same open weights we would run on our own GPU, so the code does not
change when STT and TTS move to our own hardware. This Mac (2017 i5, Intel) and
`ubuntu-hel1` (4 vCPU, no GPU) cannot run Parakeet or Kokoro in real time.

Whisper large-v3 is available (`STT_MODEL=openai/whisper-large-v3`) but not the default: it
detects the language from the start of the buffer, which on a call is silence, then
translates Spanish into English. Parakeet keeps Spanish and is 3-4× faster.

## Running

```bash
# on the voice host (Linux; Pipecat needs onnxruntime 1.24, which has no Intel-Mac build)
uv sync
set -a; . ./.env; set +a     # TOGETHER_API_KEY, LLM_RELAY_SECRET, TOOL_WEBHOOK_SECRET, APP_BASE_URL
uv run uvicorn server:app --host <tailscale-ip> --port 8765
uv run python -m pytest tests

# in the Next app's environment
PROSPECT_VOICE_ENGINE=selfhosted
VOICE_STREAM_URL=ws://<tailscale-ip>:8765/twilio   # wss://<public host>/twilio for real Twilio calls
```

Optional: `VOICE_LLM_MODEL` (`claude-opus-5` default; `claude-haiku-4-5`, `claude-sonnet-5`,
`claude-sonnet-5:fast` = thinking off), `STT_MODEL`, `TTS_MODEL`, `VOICE_EN`, `VOICE_ES`,
`VAD_STOP_SECS`, `IDLE_SECS`. Adding `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN` lets the service
hang up real calls through Twilio's API when the agent ends the call.

`POST /prewarm` (bearer `LLM_RELAY_SECRET`) renders and caches a greeting; the app calls it when
a prospect's analysis finishes, so the first ring does not wait for TTS.

## Testing without a phone number

`sim/fake_twilio.py` is a fake Twilio. It sends the signed voice webhook to the app, follows
the TwiML to whichever engine it names, streams a caller WAV as real-time 20 ms μ-law frames,
plays the agent's audio from a queue (honouring `clear` and `mark`), sends the signed
`completed` status callback, and reports per-turn latency: end of caller speech to first
audible agent audio. The same script drives the ElevenLabs engine, so both are measured
identically.

```bash
TWILIO_AUTH_TOKEN=… TWILIO_ACCOUNT_SID=… uv run --no-project --python 3.12 \
  --with websockets --with httpx sim/fake_twilio.py --from +17725550199 --audio caller.wav --out run.wav
```

## Results (2026-09-25)

Same 5-turn caller script, same prospect, same relay. Caller simulated on a Mac in the US;
voice server in Helsinki; ElevenLabs in its own cloud. Median seconds from end of caller
speech to first agent audio, and whether the appointment was actually booked (one run each):

| Engine | Haiku 4.5 | Sonnet 5 | Sonnet 5, thinking off | Opus 5 |
| --- | --- | --- | --- | --- |
| Self-hosted | 2.26 (not booked) | 4.50 (booked) | 2.96 (booked) | 4.06 (booked) |
| ElevenLabs | 1.58 (not booked) | 2.26 (not booked) | 2.16 (not booked) | 3.00 (booked) |

Greeting starts 1.7-1.9 s after the stream opens self-hosted, 0.7 s on ElevenLabs.
Barge-in: the agent goes quiet 0.66 s after the caller starts talking.

Per-turn stages on the self-hosted stack (Haiku), seconds after the caller stops:
transcript 0.10-0.17 · end of turn 0.13-0.17 · Claude's first word 0.8-1.2 · first audio 1.5-2.0.

What the remaining gap to ElevenLabs is made of:

1. **Speculation.** ElevenLabs sends the relay speculative requests on partial transcripts
   while the caller is still talking, which hides model latency. The gap grows with slower
   models (0.7 s on Haiku, 1-2 s on thinking models). Pipecat's eager end-of-turn needs an
   STT that emits early end-of-turn signals; Together's realtime Parakeet does not.
2. **Geography.** Every audio hop crosses the Atlantic (US caller ↔ Helsinki), and the relay
   hop goes Helsinki → Cloudflare → this Mac → Anthropic. A single US-East host for the voice
   server and the app removes most of it.
3. **Per-phrase TTS.** ~0.3 s per request; a websocket TTS with proper per-reply contexts
   would shave a little more.

Booking success above is one run per cell and mostly shows that Haiku skips the booking tool
under this script; model choice needs a proper eval before it is changed.

## Cost per call minute (approximate)

- Speech to text: Parakeet $0.0015 per audio minute.
- Speech: Kokoro $4 per million characters; an agent speaking ~700 characters a minute is ~$0.003.
- Claude and Twilio: the same on either engine.
- ElevenLabs Conversational AI, for comparison: roughly $0.08-0.10 per minute on Creator.

## Pipecat 1.11 issues worked around here

- `TogetherTTSService` shares one websocket stream across sentences without context ids; the
  first sentence's `done` closes the reply's audio context, later sentences land on a dead
  context and the service is eventually marked unusable. It also forwards odd-length PCM
  deltas that the resampler rejects. → `tts.TogetherHttpTTSService` (one request per phrase).
- `TogetherSTTService` never sets `finalized=True`, so every turn waits out the 1.0 s STT
  safety timer. → `stt.FinalizingTogetherSTTService`.
- Audio queued into a TTS audio context before the pipeline has fully started is dropped. →
  the pre-rendered greeting is queued as `OutputAudioRawFrame`s through the worker.

## Not done yet

- A public `wss://` route (needed for real Twilio calls) and a service manager; it runs in
  `tmux` on `ubuntu-hel1`, bound to Tailscale only.
- Browser calls: the `/try` page's "Talk in your browser" still uses ElevenLabs.
- Speculative turn start, a US deployment, and our own GPU for Parakeet and Kokoro.
