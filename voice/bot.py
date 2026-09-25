"""One phone call: Twilio Media Stream in, open-weight speech models, Claude via the app's relay.

    Twilio μ-law 8 kHz ─► Silero VAD + Smart Turn v3 ─► Whisper (Together) ─► relay → Claude
                                                                              │
    Twilio ◄─ μ-law 8 kHz ◄─ Kokoro (Together) ◄──────────────────────────────┘

The relay (/api/llm/v1 in the Next app) swaps in the prospect's script and records the
live transcript, exactly as it does for the ElevenLabs agent. Tools post to the app's
/api/prospect-tools endpoints. When the call ends, the timed transcript and a stereo
recording (caller left, agent right) go to /api/voice/finish.
"""

import asyncio
import audioop
import os
import re
import time

from loguru import logger
from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.adapters.schemas.tools_schema import ToolsSchema
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import (
    BotStartedSpeakingFrame,
    BotStoppedSpeakingFrame,
    EndWorkerFrame,
    LLMMessagesAppendFrame,
    LLMTextFrame,
    OutputAudioRawFrame,
    TTSAudioRawFrame,
    UserStoppedSpeakingFrame,
    VADUserStoppedSpeakingFrame,
    TranscriptionFrame,
    TTSSpeakFrame,
    TTSTextFrame,
    TTSUpdateSettingsFrame,
    UserStartedSpeakingFrame,
)
from pipecat.observers.base_observer import BaseObserver, FramePushed
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair, LLMUserAggregatorParams
from pipecat.processors.audio.audio_buffer_processor import AudioBufferProcessor
from pipecat.processors.frame_processor import FrameDirection
from pipecat.serializers.twilio import TwilioFrameSerializer
from pipecat.services.llm_service import FunctionCallParams
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.transcriptions.language import Language
from pipecat.transports.websocket.fastapi import FastAPIWebsocketParams, FastAPIWebsocketTransport

import appclient
from stt import FinalizingTogetherSTTService
import tts as tts_audio
from tts import TogetherHttpTTSService

VOICES = {"en": os.environ.get("VOICE_EN", "af_heart"), "es": os.environ.get("VOICE_ES", "ef_dora")}
# Parakeet v3: ~0.15-0.25 s per turn and keeps Spanish as Spanish. Whisper detects the
# language from the start of the buffer, which in a call is silence, then translates.
STT_MODEL = os.environ.get("STT_MODEL", "nvidia/parakeet-tdt-0.6b-v3")
LLM_MODEL = os.environ.get("VOICE_LLM_MODEL", "claude-opus-5")
TTS_MODEL = os.environ.get("TTS_MODEL", "hexgrad/Kokoro-82M")
# Seconds of caller silence before the agent checks in ("..." turn, as ElevenLabs does).
IDLE_SECS = float(os.environ.get("IDLE_SECS", "8"))
# Short VAD stop: Smart Turn v3 decides whether the caller has actually finished.
VAD_STOP_SECS = float(os.environ.get("VAD_STOP_SECS", "0.2"))
MAX_IDLE_PROMPTS = 2

SPANISH = re.compile(
    r"[¿¡ñáéíóú]|\b(hola|gracias|tengo|quiero|necesito|cuánto|cuando|dónde|usted|por favor|adiós|buenos|buenas|sí|está|puede|mañana)\b",
    re.IGNORECASE,
)

TOOLS = ToolsSchema(
    standard_tools=[
        FunctionSchema(
            name="check_availability",
            description="List open appointment times. Call before offering any time.",
            properties={},
            required=[],
        ),
        FunctionSchema(
            name="book_appointment",
            description="Book one of the open times returned by check_availability. Confirm to the caller only if this succeeds.",
            properties={
                "starts_at": {"type": "string", "description": "The starts_at value exactly as check_availability returned it"},
                "service": {"type": "string", "description": "Service name from the business profile"},
                "customer_name": {"type": "string", "description": "Caller's name"},
                "customer_phone": {"type": "string", "description": "Callback number"},
                "notes": {"type": "string", "description": "Short description of the job"},
            },
            required=["starts_at", "service", "customer_name"],
        ),
        FunctionSchema(
            name="take_message",
            description="Take a message for the team when the caller needs a person or something you cannot answer.",
            properties={
                "message": {"type": "string", "description": "The message, in English"},
                "customer_name": {"type": "string", "description": "Caller's name"},
                "customer_phone": {"type": "string", "description": "Callback number"},
            },
            required=["message"],
        ),
        FunctionSchema(
            name="end_call",
            description="Hang up after the caller says goodbye, or after they stay silent.",
            properties={"reason": {"type": "string", "description": "Why the call is ending"}},
            required=[],
        ),
    ]
)


def looks_spanish(text: str) -> bool:
    return len(SPANISH.findall(text)) >= 2 or bool(re.search(r"[¿¡ñ]", text))


class CallLog(BaseObserver):
    """Timed transcript and latency, observed from the frames flowing through the pipeline.

    Times are seconds since the call connected, the same origin as the recording, so the
    page can highlight each line during playback.
    """

    def __init__(self):
        super().__init__()
        self.t0 = time.monotonic()
        self.lines: list[dict] = []
        self.seen: set[int] = set()
        self.user_turn_at: float | None = None
        self.agent_open = False
        # Per turn: seconds from the caller's last speech (VAD) to each stage.
        self.turns: list[dict] = []
        self.turn: dict | None = None

    def now(self) -> float:
        return round(time.monotonic() - self.t0, 2)

    async def on_push_frame(self, data: FramePushed):
        frame = data.frame
        if frame.id in self.seen:
            return
        self.seen.add(frame.id)
        t = self.now()

        # Latency stages, measured from the caller's last speech (Silero VAD stop).
        if isinstance(frame, VADUserStoppedSpeakingFrame):
            self.turn = {"vad_stop": t}
        elif self.turn is not None:
            if isinstance(frame, TranscriptionFrame) and frame.text.strip():
                self.turn["transcript"] = t
            elif isinstance(frame, UserStoppedSpeakingFrame):
                self.turn.setdefault("turn_end", t)
            elif isinstance(frame, LLMTextFrame) and frame.text.strip():
                self.turn.setdefault("llm_first_word", t)
            elif isinstance(frame, TTSAudioRawFrame) and "llm_first_word" in self.turn:
                self.turn.setdefault("tts_first_audio", t)
            elif isinstance(frame, BotStartedSpeakingFrame) and "llm_first_word" in self.turn:
                self.turn["bot_speaking"] = t
                base = self.turn.pop("vad_stop")
                self.turns.append({k: round(v - base, 2) for k, v in self.turn.items()})
                self.turn = None

        # Timed transcript.
        if isinstance(frame, UserStartedSpeakingFrame):
            self.user_turn_at = t
            self.agent_open = False
        elif isinstance(frame, TranscriptionFrame) and frame.text.strip():
            last = self.lines[-1] if self.lines else None
            if last and last["speaker"] == "caller" and not self.agent_open:
                last["text"] = f"{last['text']} {frame.text.strip()}"
            else:
                self.lines.append({"speaker": "caller", "text": frame.text.strip(), "atSecs": self.user_turn_at or t})
        elif isinstance(frame, BotStartedSpeakingFrame):
            self.lines.append({"speaker": "agent", "text": "", "atSecs": t})
            self.agent_open = True
        elif isinstance(frame, TTSTextFrame) and frame.text:
            last = self.lines[-1] if self.lines else None
            if last and last["speaker"] == "agent":
                sep = "" if not last["text"] or frame.text.startswith((" ", ",", ".", "?", "!")) else " "
                last["text"] = f"{last['text']}{sep}{frame.text}".strip()
        elif isinstance(frame, BotStoppedSpeakingFrame):
            self.agent_open = False

    def transcript(self) -> list[dict]:
        return [l for l in self.lines if l["text"].strip()]


async def run_call(websocket, call_data) -> None:
    body = call_data.get("body", {}) or {}
    stream_sid = call_data.get("stream_id")
    call_sid = body.get("call_sid") or call_data.get("call_id") or ""
    prospect_id = body.get("prospect_id", "")
    conversation_id = f"self_{call_sid or stream_sid}"
    log = logger.bind(call=conversation_id)
    setup_t0 = time.monotonic()
    marks: dict[str, float] = {}

    def mark(name: str) -> None:
        marks[name] = round(time.monotonic() - setup_t0, 2)

    greeting = body.get("greeting", "")
    if not appclient.valid_token(prospect_id, call_sid, greeting, body.get("token", "")):
        log.warning("rejected stream with a bad token")
        await websocket.close(code=4403)
        return
    mark("token_checked")

    # Render the greeting while the pipeline and STT connection come up.
    greeting_audio = asyncio.create_task(tts_audio.cached_render(os.environ["TOGETHER_API_KEY"], TTS_MODEL, VOICES["en"], greeting))

    serializer = TwilioFrameSerializer(
        stream_sid=stream_sid,
        call_sid=call_sid or None,
        account_sid=os.environ.get("TWILIO_ACCOUNT_SID"),
        auth_token=os.environ.get("TWILIO_AUTH_TOKEN"),
        params=TwilioFrameSerializer.InputParams(auto_hang_up=bool(os.environ.get("TWILIO_AUTH_TOKEN") and call_sid.startswith("CA"))),
    )
    transport = FastAPIWebsocketTransport(
        websocket=websocket,
        params=FastAPIWebsocketParams(audio_in_enabled=True, audio_out_enabled=True, add_wav_header=False, serializer=serializer),
    )
    stt = FinalizingTogetherSTTService(api_key=os.environ["TOGETHER_API_KEY"], settings=FinalizingTogetherSTTService.Settings(model=STT_MODEL))
    tts = TogetherHttpTTSService(api_key=os.environ["TOGETHER_API_KEY"], model=TTS_MODEL, voice=VOICES["en"], language="en")
    llm = OpenAILLMService(
        api_key=appclient.RELAY_SECRET,
        base_url=f"{appclient.APP}/api/llm/v1",
        default_headers={"x-prospect-id": prospect_id, "x-conversation-id": conversation_id},
        settings=OpenAILLMService.Settings(model=LLM_MODEL),
    )

    # The relay replaces this with the prospect's full script on every turn.
    context = LLMContext(messages=[{"role": "system", "content": "You are a phone receptionist."}], tools=TOOLS)
    aggregators = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(vad_analyzer=SileroVADAnalyzer(params=VADParams(stop_secs=VAD_STOP_SECS)), user_idle_timeout=IDLE_SECS),
    )
    recorder = AudioBufferProcessor(num_channels=2)
    pipeline = Pipeline(
        [transport.input(), stt, aggregators.user(), llm, tts, transport.output(), recorder, aggregators.assistant()]
    )
    call_log = CallLog()
    mark("services_built")
    worker = PipelineWorker(
        pipeline,
        params=PipelineParams(audio_in_sample_rate=16000, audio_out_sample_rate=8000, enable_metrics=True),
        observers=[call_log],
        idle_timeout_secs=600,
    )

    state = {"language": "en", "idle_prompts": 0, "audio": None, "ending": False}

    async def tool_handler(params: FunctionCallParams):
        args = {**(params.arguments or {}), "prospect_id": prospect_id, "conversation_id": conversation_id}
        result = await appclient.call_tool(params.function_name, args)
        await params.result_callback(result)

    for name in ("check_availability", "book_appointment", "take_message"):
        llm.register_function(name, tool_handler)

    async def end_call(params: FunctionCallParams):
        await params.result_callback({"ok": True, "ending": True})
        if not state["ending"]:
            state["ending"] = True
            # Queued behind the goodbye audio, so the caller hears it before the line drops.
            await params.llm.push_frame(EndWorkerFrame(), FrameDirection.UPSTREAM)

    llm.register_function("end_call", end_call)

    @stt.event_handler("on_connected")
    async def _stt_ready(_service):
        log.debug("stt connected")

    @aggregators.user().event_handler("on_user_turn_idle")
    async def _idle(_aggregator):
        state["idle_prompts"] += 1
        if state["idle_prompts"] > MAX_IDLE_PROMPTS:
            await worker.queue_frame(EndWorkerFrame())
            return
        await worker.queue_frame(LLMMessagesAppendFrame(messages=[{"role": "user", "content": "..."}], run_llm=True))

    @recorder.event_handler("on_audio_data")
    async def _audio(_processor, audio: bytes, sample_rate: int, num_channels: int):
        state["audio"] = (audio, sample_rate, num_channels)

    class LanguageWatch(BaseObserver):
        async def on_push_frame(self, data: FramePushed):
            frame = data.frame
            if isinstance(frame, TranscriptionFrame) and frame.text:
                state["idle_prompts"] = 0
                spanish = looks_spanish(frame.text)
                wanted = "es" if spanish else ("en" if re.search(r"[a-z]{4,}", frame.text, re.I) and not spanish else state["language"])
                if wanted != state["language"]:
                    state["language"] = wanted
                    log.info(f"caller language → {wanted}")
                    await worker.queue_frame(
                        TTSUpdateSettingsFrame(
                            delta=TogetherHttpTTSService.Settings(voice=VOICES[wanted], language=wanted),
                            service=tts,
                        )
                    )

    worker.add_observer(LanguageWatch())

    @transport.event_handler("on_client_connected")
    async def _connected(_transport, _ws):
        mark("connected")
        call_log.t0 = time.monotonic()
        await recorder.start_recording()
        try:
            pcm = await asyncio.wait_for(greeting_audio, timeout=3)
            context.add_message({"role": "assistant", "content": greeting})
            call_log.lines.append({"speaker": "agent", "text": greeting, "atSecs": call_log.now()})
            mark("greeting_ready")
            # Queued through the pipeline (behind StartFrame), already at the line's 8 kHz.
            pcm8, _ = audioop.ratecv(pcm, 2, 1, tts_audio.TOGETHER_PCM_RATE, 8000, None)
            await worker.queue_frames(
                [OutputAudioRawFrame(audio=pcm8[i : i + 320], sample_rate=8000, num_channels=1) for i in range(0, len(pcm8), 320)]
            )
            log.info(f"setup timeline (s since stream start): {marks}")
        except Exception as e:
            log.warning(f"greeting pre-render unavailable ({e}); speaking it live")
            await worker.queue_frames([TTSSpeakFrame(greeting)])
        log.info(f"connected: prospect={prospect_id or '-'}")

    @transport.event_handler("on_client_disconnected")
    async def _disconnected(_transport, _ws):
        await worker.cancel()

    await PipelineRunner(handle_sigint=False).run(worker)

    await recorder.stop_recording()
    await asyncio.sleep(0.2)
    wav = appclient.stereo_wav(*state["audio"]) if state["audio"] and state["audio"][0] else None
    lines = call_log.transcript()
    log.info(f"call over: {len(lines)} lines, model {LLM_MODEL}")
    for i, t in enumerate(call_log.turns):
        log.info(f"turn {i + 1} (s after caller stopped): {t}")
    if greeting:
        result = await appclient.finish(conversation_id, call_sid, lines, wav)
        log.info(f"finish upload: {result}")
