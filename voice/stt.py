"""Together realtime STT whose completed transcripts count as final.

Pipecat 1.11's TogetherSTTService pushes the "completed" transcript without
finalized=True. The turn-stop strategy only ends a turn early on a finalized transcript,
so every turn otherwise waits out the STT p99 safety timer (1.0 s after the caller stops).
"""

from pipecat.frames.frames import TranscriptionFrame
from pipecat.processors.frame_processor import FrameDirection
from pipecat.services.together.stt import TogetherSTTService


class FinalizingTogetherSTTService(TogetherSTTService):
    async def push_frame(self, frame, direction: FrameDirection = FrameDirection.DOWNSTREAM):
        if isinstance(frame, TranscriptionFrame) and not frame.finalized:
            frame.finalized = True
        await super().push_frame(frame, direction)
