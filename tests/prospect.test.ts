import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, resetDbForTests, run } from "../lib/db";
import { weeklyHours } from "../lib/prospect/calendar";
import { displayLines, toClaudeMessages } from "../lib/prospect/relay";
import type { Analysis } from "../lib/prospect/schema";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "prospect-"));
  resetDbForTests(path.join(dir, "test.sqlite"));
});
afterEach(() => {
  closeDb();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("custom LLM relay translation", () => {
  const history = [
    { role: "system" as const, content: "placeholder prompt" },
    { role: "assistant" as const, content: "Thanks for calling Acme." },
    { role: "user" as const, content: "When can you come out?" },
    { role: "assistant" as const, content: "", tool_calls: [{ id: "toolu_1", type: "function" as const, function: { name: "check_availability", arguments: "{}" } }] },
    { role: "tool" as const, tool_call_id: "toolu_1", content: '{"slots":[]}' },
    { role: "assistant" as const, content: "Friday at 9 works." },
  ];

  it("drops the ElevenLabs system prompt, starts with a user turn, and maps tool calls", () => {
    const out = toClaudeMessages(history);
    expect(out[0]).toEqual({ role: "user", content: "(The call has connected.)" });
    expect(out.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant", "user", "assistant"]);
    expect(out[3].content).toEqual([{ type: "tool_use", id: "toolu_1", name: "check_availability", input: {} }]);
    expect(out[4].content).toEqual([{ type: "tool_result", tool_use_id: "toolu_1", content: '{"slots":[]}' }]);
  });

  it("replays a stored assistant turn verbatim, thinking blocks included", () => {
    const stored = [
      { type: "thinking", thinking: "", signature: "sig" },
      { type: "tool_use", id: "toolu_1", name: "check_availability", input: {} },
    ];
    run("INSERT INTO relay_turns(tool_use_id, conversation_id, content_json, created_at) VALUES(?, ?, ?, ?)", "toolu_1", "conv", JSON.stringify(stored), new Date().toISOString());
    expect(toClaudeMessages(history)[3].content).toEqual(stored);
  });

  it("lists only spoken lines for the live transcript", () => {
    expect(displayLines(history)).toEqual([
      { speaker: "agent", text: "Thanks for calling Acme." },
      { speaker: "caller", text: "When can you come out?" },
      { speaker: "agent", text: "Friday at 9 works." },
    ]);
  });
});

describe("mock calendar hours", () => {
  const withHours = (hours: Analysis["business"]["hours"]) => ({ business: { hours } }) as unknown as Analysis;

  it("parses day ranges and 12-hour clocks", () => {
    const h = weeklyHours(withHours([
      { days: "Monday–Friday", open: "8:00 AM", close: "5:30 PM" },
      { days: "Saturday", open: "9 AM", close: "1 PM" },
    ]));
    expect(h.get(1)).toEqual({ open: 480, close: 1050 });
    expect(h.get(5)).toEqual({ open: 480, close: 1050 });
    expect(h.get(6)).toEqual({ open: 540, close: 780 });
    expect(h.has(0)).toBe(false);
  });

  it("falls back to weekdays 8 to 5 when hours cannot be read", () => {
    const h = weeklyHours(withHours([{ days: "By appointment", open: "varies", close: "varies" }]));
    expect([...h.keys()].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(h.get(3)).toEqual({ open: 480, close: 1020 });
  });
});

describe("live transcript storage", () => {
  it("hides silent caller turns", async () => {
    const { displayLines } = await import("../lib/prospect/relay");
    expect(displayLines([{ role: "user", content: "..." }, { role: "user", content: "Hi" }, { role: "user", content: " … " }])).toEqual([{ speaker: "caller", text: "Hi" }]);
  });

  it("rewrites the transcript whole, dropping a discarded provisional reply", async () => {
    const store = await import("../lib/prospect/store");
    run("INSERT INTO prospects(id, status, website, email, created_at, updated_at) VALUES('pro_t','ready','https://x.co','a@b.co','t','t')");
    const cid = store.openCall({ prospectId: "pro_t", channel: "browser" });
    store.replaceLines(cid, [{ speaker: "agent", text: "Hello" }, { speaker: "agent", text: "Speculative reply" }]);
    store.replaceLines(cid, [{ speaker: "agent", text: "Hello" }, { speaker: "caller", text: "My name is Jordan" }]);
    expect(store.linesFor(cid).map((l) => l.text)).toEqual(["Hello", "My name is Jordan"]);
    store.replaceLines(cid, [{ speaker: "agent", text: "Hello", atSecs: 0 }, { speaker: "caller", text: "My name is Jordan", atSecs: 4.5 }]);
    expect(store.linesFor(cid).map((l) => l.at_secs)).toEqual([0, 4.5]);
  });
});
