// SSE wire contract — the single, framework-neutral interface between the HubAI
// server engine and any client (React hook, vanilla, another framework).

export type SSEEvent =
  | { text: string }
  | { tool_status: string; status: "executing" | "done" | "error"; summary?: string }
  | { link: { href: string; label: string } }
  | { refresh: true }
  | { error: string };

export const SSE_DONE = "[DONE]";

export function encodeSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function encodeDone(): string {
  return `data: ${SSE_DONE}\n\n`;
}

// Idle heartbeat — keeps proxies from dropping a long-running stream.
export function encodeComment(text: string): string {
  return `: ${text}\n\n`;
}
