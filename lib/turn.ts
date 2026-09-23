import { run } from "./db";
import { greetingFor, initialState, runTurn } from "./dialogue";
import { executeTool } from "./tools";
import {
  activeSession,
  addLanguageEvent,
  addTimeline,
  addTurn,
  createInquiry,
  inquiryById,
  loadState,
  saveState,
} from "./records";
import type { LanguageMode, SourceKind } from "./types";

export function openConversation(input: {
  origin: string;
  mode: LanguageMode;
  channel: string;
  provider: string;
  sourceKind: SourceKind;
  voiceId?: string;
}): { inquiryId: string; sessionId: string } {
  const state = initialState(input.mode);
  const created = createInquiry({
    origin: input.origin,
    language: state.language,
    lock: state.lock,
    channel: input.channel,
    provider: input.provider,
    sourceKind: input.sourceKind,
    voiceId: input.voiceId,
  });
  const hello = greetingFor(state);
  addTurn({
    inquiryId: created.inquiryId,
    sessionId: created.sessionId,
    speaker: "agent",
    text: hello.say,
    language: state.language,
    sourceKind: input.sourceKind,
    translation: hello.sayEn ? { text: hello.sayEn, status: "generated", source: "authored_pair" } : undefined,
  });
  addTimeline({
    inquiryId: created.inquiryId,
    kind: "conversation_started",
    title: input.sourceKind === "simulated_replay" ? "Simulated replay started" : "Conversation started",
    detail: input.channel,
    sourceKind: input.sourceKind,
  });
  return created;
}

export async function customerTurn(
  inquiryId: string,
  text: string,
  sourceKind?: SourceKind,
  callerTranslation?: string,
): Promise<{ say: string; language: string }> {
  const inquiry = inquiryById(inquiryId);
  if (!inquiry) throw new Error("Inquiry not found");
  const session = activeSession(inquiryId);
  if (!session) throw new Error("Session not found");
  const kind = sourceKind ?? session.source_kind;
  const state = loadState(inquiry);
  const callerId = addTurn({
    inquiryId,
    sessionId: session.id,
    speaker: "caller",
    text,
    language: state.language,
    sourceKind: kind,
    translation: callerTranslation ? { text: callerTranslation, status: "generated", source: "authored_pair" } : undefined,
  });
  const outcome = await runTurn({
    state,
    text,
    mode: "auto",
    inquiryId,
    exec: (call) =>
      executeTool({
        inquiryId,
        sessionId: session.id,
        sourceKind: kind,
        delivery: kind === "live" ? "connected" : "simulated",
        call,
      }),
  });
  if (outcome.languageEvent) {
    addLanguageEvent({
      inquiryId,
      sessionId: session.id,
      from: outcome.languageEvent.from,
      to: outcome.languageEvent.to,
      reason: outcome.languageEvent.reason,
      sourceKind: kind,
    });
    addTimeline({
      inquiryId,
      kind: "language_changed",
      title: `Language changed to ${outcome.languageEvent.to}`,
      detail: outcome.languageEvent.reason,
      sourceKind: kind,
    });
  }
  saveState(inquiryId, outcome.state);
  run("UPDATE transcript_turns SET language = ? WHERE id = ?", outcome.state.language, callerId);
  addTurn({
    inquiryId,
    sessionId: session.id,
    speaker: "agent",
    text: outcome.say,
    language: outcome.state.language,
    sourceKind: kind,
    translation: outcome.sayEn ? { text: outcome.sayEn, status: "generated", source: "authored_pair" } : undefined,
  });
  return { say: outcome.say, language: outcome.state.language };
}

export function endSession(inquiryId: string): void {
  const session = activeSession(inquiryId);
  if (!session) return;
  run("UPDATE sessions SET status = 'completed', ended_at = ? WHERE id = ?", new Date().toISOString(), session.id);
}
