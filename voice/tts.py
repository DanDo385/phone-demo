"""Kokoro (or any Together TTS model) over plain HTTP, one request per sentence.

Pipecat 1.11's TogetherTTSService shares one websocket stream across sentences with no
context ids: the first sentence's "done" closes the reply's audio context, so later
sentences (and audio still in flight after a barge-in) land on a dead context and the
service is eventually marked unusable. Kokoro renders a sentence in ~0.2-0.5 s, so a
request per sentence costs little latency and makes each sentence independent: the base
class splits the reply into sentences and cancels in-flight requests on interruption.

Together always returns 24 kHz signed 16-bit mono PCM for response_format=raw; the
transport resamples to 8 kHz μ-law for Twilio.
"""

import hashlib
import pathlib
import re
import uuid
from collections.abc import AsyncGenerator

import httpx
from loguru import logger
from pipecat.frames.frames import ErrorFrame, Frame, TTSAudioRawFrame, TTSStartedFrame, TTSStoppedFrame
from pipecat.services.settings import TTSSettings
from pipecat.services.tts_service import TTSService
from pipecat.utils.text.base_text_aggregator import Aggregation, AggregationType
from pipecat.utils.text.simple_text_aggregator import SimpleTextAggregator

TOGETHER_PCM_RATE = 24000


class TogetherHttpTTSService(TTSService):
    Settings = TTSSettings

    def __init__(self, *, api_key: str, model: str, voice: str, language: str = "en", **kwargs):
        super().__init__(
            sample_rate=TOGETHER_PCM_RATE,
            push_start_frame=True,
            push_stop_frames=True,
            settings=TTSSettings(model=model, voice=voice, language=language),
            **kwargs,
        )
        self._text_aggregator = FirstClauseAggregator(aggregation_type=self._text_aggregation_mode)
        self._http = httpx.AsyncClient(
            base_url="https://api.together.ai/v1",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=httpx.Timeout(15.0, connect=5.0),
        )

    def can_generate_metrics(self) -> bool:
        return True

    async def play_prerendered(self, pcm: bytes) -> None:
        """Queue audio rendered ahead of time (the greeting) as one TTS utterance."""
        ctx = str(uuid.uuid4())
        await self.create_audio_context(ctx)
        await self.append_to_audio_context(ctx, TTSStartedFrame(context_id=ctx))
        step = self.sample_rate // 50 * 2  # 20 ms
        for i in range(0, len(pcm), step):
            await self.append_to_audio_context(ctx, TTSAudioRawFrame(pcm[i : i + step], self.sample_rate, 1, context_id=ctx))
        await self.append_to_audio_context(ctx, TTSStoppedFrame(context_id=ctx))
        await self.remove_audio_context(ctx)

    async def run_tts(self, text: str, context_id: str) -> AsyncGenerator[Frame, None]:
        body = {
            "model": self._settings.model,
            "input": text,
            "voice": self._settings.voice,
            "response_format": "raw",
            "language": str(self._settings.language or "en"),
        }
        carry = b""
        try:
            async with self._http.stream("POST", "/audio/speech", json=body) as r:
                if r.status_code != 200:
                    error = (await r.aread()).decode(errors="ignore")[:200]
                    logger.error(f"{self} Together TTS {r.status_code}: {error}")
                    yield ErrorFrame(error=f"Together TTS returned {r.status_code}")
                    return
                await self.start_tts_usage_metrics(text)
                async for chunk in r.aiter_bytes(self.chunk_size):
                    audio = carry + chunk
                    cut = len(audio) - (len(audio) % 2)
                    carry = audio[cut:]
                    if cut:
                        await self.stop_ttfb_metrics()
                        yield TTSAudioRawFrame(audio[:cut], self.sample_rate, 1, context_id=context_id)
        except httpx.HTTPError as e:
            yield ErrorFrame(error=f"Together TTS request failed: {e}")


# ---------------------------------------------------------------------------
# Speak sooner: the first clause of each reply goes to TTS at its first comma.

FIRST_CLAUSE = re.compile(r"^(.{12,}?[,;:—])\s")


class FirstClauseAggregator(SimpleTextAggregator):
    """Sentence aggregation, except the reply's opening clause is released at its first
    comma/semicolon/colon/dash. Waiting for a whole first sentence was the largest delay
    between Claude's first word and the first audio (0.6-0.8 s per turn)."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._first = True

    async def aggregate(self, text: str):
        async for aggregation in super().aggregate(text):
            self._first = False
            yield aggregation
        if self._first:
            match = FIRST_CLAUSE.match(self._text.lstrip())
            if match:
                self._text = self._text.lstrip()[match.end():]
                self._first = False
                yield Aggregation(text=match.group(1).strip(), type=AggregationType.SENTENCE)

    async def flush(self):
        self._first = True
        return await super().flush()

    async def handle_interruption(self):
        self._first = True
        await super().handle_interruption()


CACHE = pathlib.Path(__file__).parent / "cache" / "tts"


async def cached_render(api_key: str, model: str, voice: str, text: str, language: str = "en") -> bytes:
    """render(), cached on disk by content; greetings are rendered once per prospect."""
    key = hashlib.sha256(f"{model}|{voice}|{language}|{text}".encode()).hexdigest()
    path = CACHE / f"{key}.pcm"
    if path.exists():
        return path.read_bytes()
    pcm = await render(api_key, model, voice, text, language)
    CACHE.mkdir(parents=True, exist_ok=True)
    path.write_bytes(pcm)
    return pcm


async def render(api_key: str, model: str, voice: str, text: str, language: str = "en") -> bytes:
    """Whole utterance as 24 kHz PCM, for pre-rendering the greeting during call setup."""
    async with httpx.AsyncClient(timeout=15.0) as http:
        r = await http.post(
            "https://api.together.ai/v1/audio/speech",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"model": model, "input": text, "voice": voice, "response_format": "raw", "language": language},
        )
        r.raise_for_status()
        audio = r.content
        return audio[: len(audio) - (len(audio) % 2)]
