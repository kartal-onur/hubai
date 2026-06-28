import type { SSEEvent } from "../core/sse";

export type ParsedLine =
  | { type: "event"; event: SSEEvent }
  | { type: "done" }
  | null;

// Parse a single SSE wire line into an event. Pure + unit-testable.
export function parseSSELine(line: string): ParsedLine {
  if (!line.startsWith("data: ")) return null;
  const data = line.slice(6);
  if (data === "[DONE]") return { type: "done" };
  try {
    return { type: "event", event: JSON.parse(data) as SSEEvent };
  } catch {
    return null;
  }
}

export interface SSEHandlers {
  onText: (chunk: string) => void;
  onToolStatus: (status: {
    tool: string;
    status: "executing" | "done" | "error";
    summary?: string;
  }) => void;
  onLink: (link: { href: string; label: string }) => void;
  onRefresh: () => void;
  onError: (message: string) => void;
}

// Read an SSE Response body to completion, dispatching parsed events.
export async function readSSEStream(
  body: ReadableStream<Uint8Array>,
  handlers: SSEHandlers
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    // Keep the last (possibly partial) line in the buffer.
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const parsed = parseSSELine(line);
      if (!parsed) continue;
      if (parsed.type === "done") return;

      const event = parsed.event;
      if ("tool_status" in event) {
        handlers.onToolStatus({
          tool: event.tool_status,
          status: event.status,
          summary: event.summary,
        });
      } else if ("link" in event) {
        handlers.onLink(event.link);
      } else if ("refresh" in event) {
        handlers.onRefresh();
      } else if ("text" in event) {
        handlers.onText(event.text);
      } else if ("error" in event) {
        handlers.onError(event.error);
      }
    }
  }
}
