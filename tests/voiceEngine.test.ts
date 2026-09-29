import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { selfHostedTwiml, selfHostedVoice, streamToken } from "../lib/prospect/voiceEngine";

const env = { ...process.env };
beforeEach(() => {
  process.env.LLM_RELAY_SECRET = "test-relay-secret";
  process.env.PROSPECT_VOICE_ENGINE = "selfhosted";
  process.env.VOICE_STREAM_URL = "wss://voice.example/twilio";
});
afterEach(() => {
  process.env = { ...env };
});

describe("self-hosted voice engine", () => {
  it("is off unless selected and configured", () => {
    expect(selfHostedVoice()).toEqual({ url: "wss://voice.example/twilio" });
    process.env.PROSPECT_VOICE_ENGINE = "elevenlabs";
    expect(selfHostedVoice()).toBeNull();
    process.env.PROSPECT_VOICE_ENGINE = "selfhosted";
    delete process.env.VOICE_STREAM_URL;
    expect(selfHostedVoice()).toBeNull();
  });

  it("signs prospect, call and greeting together, matching the voice server's check", () => {
    const token = streamToken("pro_1", "CA1", "Hi there");
    const expected = crypto.createHmac("sha256", "test-relay-secret").update("pro_1:CA1:Hi there").digest("hex");
    expect(token).toBe(expected);
    expect(streamToken("pro_1", "CA1", "Hi there!")).not.toBe(token);
    expect(streamToken("pro_2", "CA1", "Hi there")).not.toBe(token);
  });

  it("streams to the voice server with escaped parameters", () => {
    const xml = selfHostedTwiml({ url: "wss://voice.example/twilio", prospectId: "pro_1", callSid: "CA1", from: "+17725550199", greeting: `Thanks for calling A/C "Care" & Air` });
    expect(xml).toContain('<Connect><Stream url="wss://voice.example/twilio">');
    expect(xml).toContain('<Parameter name="greeting" value="Thanks for calling A/C &quot;Care&quot; &amp; Air"/>');
    expect(xml).toContain(`<Parameter name="token" value="${streamToken("pro_1", "CA1", `Thanks for calling A/C "Care" & Air`)}"/>`);
  });
});
