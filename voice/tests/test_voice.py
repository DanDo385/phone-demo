import asyncio
import hashlib
import hmac
import os

os.environ.setdefault("LLM_RELAY_SECRET", "test-relay-secret")

import appclient  # noqa: E402
from bot import looks_spanish  # noqa: E402
from tts import FirstClauseAggregator  # noqa: E402


def test_token_matches_the_app():
    # Same construction as lib/prospect/voiceEngine.ts streamToken().
    appclient.RELAY_SECRET = "test-relay-secret"
    token = hmac.new(b"test-relay-secret", b"pro_1:CA1:Hi there", hashlib.sha256).hexdigest()
    assert appclient.valid_token("pro_1", "CA1", "Hi there", token)
    assert not appclient.valid_token("pro_1", "CA1", "Hi there!", token)
    assert not appclient.valid_token("pro_1", "CA1", "Hi there", "")


def test_spanish_detection():
    assert looks_spanish("Hola, tengo una fuga debajo del fregadero. ¿Cuánto cuesta?")
    assert looks_spanish("¿Qué horarios tienen?")
    assert not looks_spanish("My name is Jordan Blake and I live on Palmetto Street.")
    assert not looks_spanish("It's 412 Southwest Palmetto Street in Stuart.")


def test_first_clause_is_released_early_then_sentences():
    async def run():
        agg = FirstClauseAggregator()
        out = []
        for token in ["Sure thing, Jordan, ", "I have Friday at nine. ", "Does that work?"]:
            async for a in agg.aggregate(token):
                out.append(a.text)
        rest = await agg.flush()
        return out, rest

    out, rest = asyncio.run(run())
    assert out[0] == "Sure thing, Jordan,"
    assert "I have Friday at nine." in " ".join(out)
