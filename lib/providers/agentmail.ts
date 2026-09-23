import { mailConfigured } from "./status";

export type Delivery = {
  status: "simulated" | "sent" | "failed";
  provider: "simulated" | "agentmail";
  messageId?: string;
  threadId?: string;
  error?: string;
};

export async function deliverEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
  mode: "simulated" | "connected";
}): Promise<Delivery> {
  if (input.mode === "simulated") {
    return { status: "simulated", provider: "simulated" };
  }
  const allowed = process.env.TEST_CUSTOMER_EMAIL?.trim().toLowerCase();
  if (!mailConfigured() || !process.env.AGENTMAIL_API_KEY || !process.env.AGENTMAIL_INBOX_ID) {
    return { status: "failed", provider: "agentmail", error: "AgentMail is not configured. The message was not sent." };
  }
  if (!allowed) {
    return { status: "failed", provider: "agentmail", error: "TEST_CUSTOMER_EMAIL is not set. The message was not sent." };
  }
  if (input.to.trim().toLowerCase() !== allowed) {
    return {
      status: "failed",
      provider: "agentmail",
      error: "Recipient is not the designated test address. The message was not sent.",
    };
  }
  try {
    const response = await fetch(
      `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(process.env.AGENTMAIL_INBOX_ID)}/messages/send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.AGENTMAIL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: [input.to],
          subject: input.subject,
          text: input.text,
          html: input.html,
          labels: ["palmetto-demo"],
        }),
      },
    );
    const body = (await response.json().catch(() => ({}))) as {
      message_id?: string;
      thread_id?: string;
      message?: string;
    };
    if (!response.ok) {
      return {
        status: "failed",
        provider: "agentmail",
        error: `AgentMail returned ${response.status}. The message was not sent.`,
      };
    }
    return {
      status: "sent",
      provider: "agentmail",
      messageId: body.message_id,
      threadId: body.thread_id,
    };
  } catch {
    return { status: "failed", provider: "agentmail", error: "AgentMail request failed. The message was not sent." };
  }
}
