import Anthropic from "@anthropic-ai/sdk";
import type {
  ContentBlockParam,
  MessageParam,
  TextBlock,
  ToolResultBlockParam,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages";
import type { ChatMessage, HubAIContext, HubLink, HubTool } from "./types";
import { encodeDone, encodeSSE, type SSEEvent } from "./sse";

interface RunLoopOptions<Ctx extends HubAIContext> {
  anthropic: Anthropic;
  model: string;
  maxTokens: number;
  maxToolLoops: number;
  system: string;
  cache: boolean;
  summaryMaxChars: number | false;
  tools: HubTool<Ctx>[];
  ctx: Ctx;
  messages: ChatMessage[];
  onError: (err: unknown) => string;
  maxLoopsMessage: string;
  /** Aborts the Anthropic call and stops the loop on client disconnect. */
  signal?: AbortSignal;
}

function resolveLink(
  emitLink: NonNullable<HubTool["emitLink"]>,
  result: string
): HubLink | null {
  if (typeof emitLink === "function") return emitLink(result);
  try {
    const parsed = JSON.parse(result) as { href?: unknown; label?: unknown };
    if (parsed && typeof parsed.href === "string") {
      return {
        href: parsed.href,
        label: typeof parsed.label === "string" ? parsed.label : "Open",
      };
    }
  } catch {
    // Not a link payload — ignore.
  }
  return null;
}

function makeSummary(
  result: string,
  redact: HubTool["redactSummary"],
  maxChars: number | false
): string | undefined {
  if (redact) return redact(result);
  if (maxChars === false) return undefined;
  return result.slice(0, maxChars);
}

// The Anthropic tool-use loop, emitting the SSE wire contract. Runtime-agnostic:
// returns a Web ReadableStream that drops into any Fetch-API host.
export function runToolLoop<Ctx extends HubAIContext>(
  opts: RunLoopOptions<Ctx>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const toolMap = new Map(opts.tools.map((t) => [t.definition.name, t]));
  const toolDefs = opts.tools.map((t) => t.definition);

  // Internal controller so a client disconnect (stream cancel) aborts the
  // in-flight Anthropic call and stops further loops / tool side effects.
  const ac = new AbortController();
  if (opts.signal) {
    if (opts.signal.aborted) ac.abort();
    else opts.signal.addEventListener("abort", () => ac.abort(), { once: true });
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      const send = (event: SSEEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(encodeSSE(event)));
      };
      const streamText = (text: string) => {
        if (!text) return;
        const words = text.split(" ");
        for (let i = 0; i < words.length; i++) {
          send({ text: (i > 0 ? " " : "") + (words[i] ?? "") });
        }
      };

      try {
        const conversation: MessageParam[] = opts.messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        let loopCount = 0;
        let hasWriteAction = false;

        while (loopCount < opts.maxToolLoops) {
          if (ac.signal.aborted) return close();
          loopCount++;

          const response = await opts.anthropic.messages.create(
            {
              model: opts.model,
              max_tokens: opts.maxTokens,
              system: opts.cache
                ? [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }]
                : opts.system,
              tools: toolDefs,
              messages: conversation,
            },
            { signal: ac.signal }
          );

          // Stream any assistant text in this turn (interleaved with a tool call,
          // or the final answer). Done once per turn so it is never dropped.
          const text = response.content
            .filter((b): b is TextBlock => b.type === "text")
            .map((b) => b.text)
            .join("");
          streamText(text);

          const toolUseBlocks = response.content.filter(
            (b): b is ToolUseBlock => b.type === "tool_use"
          );

          if (toolUseBlocks.length === 0) {
            if (hasWriteAction) send({ refresh: true });
            if (!closed) controller.enqueue(encoder.encode(encodeDone()));
            return close();
          }

          const toolResults: ContentBlockParam[] = [];

          for (const block of toolUseBlocks) {
            if (ac.signal.aborted) return close();
            const name = block.name;
            const tool = toolMap.get(name);

            send({ tool_status: name, status: "executing" });

            let result: string;
            let isError = false;
            if (!tool) {
              result = `Unknown tool: ${name}`;
              isError = true;
            } else {
              try {
                result = await tool.execute(
                  block.input as Record<string, unknown>,
                  opts.ctx
                );
                if (tool.emitLink) {
                  const link = resolveLink(tool.emitLink, result);
                  if (link) send({ link });
                }
                if (tool.refreshOnSuccess) hasWriteAction = true;
              } catch (err) {
                // A throwing tool must not kill the stream: return it to the
                // model as an is_error tool_result so it can recover, and keep
                // the conversation valid (every tool_use gets a tool_result).
                isError = true;
                result = opts.onError(err);
              }
            }

            const summary = makeSummary(result, tool?.redactSummary, opts.summaryMaxChars);
            send({ tool_status: name, status: isError ? "error" : "done", summary });

            const toolResult: ToolResultBlockParam = {
              type: "tool_result",
              tool_use_id: block.id,
              content: result,
            };
            if (isError) toolResult.is_error = true;
            toolResults.push(toolResult);
          }

          conversation.push({ role: "assistant", content: response.content });
          conversation.push({ role: "user", content: toolResults });
        }

        send({ text: opts.maxLoopsMessage });
        if (!closed) controller.enqueue(encoder.encode(encodeDone()));
        return close();
      } catch (err) {
        // Client disconnect / cancel: just close, do not emit on a dead stream.
        if (ac.signal.aborted) return close();
        send({ error: opts.onError(err) });
        return close();
      }
    },
    cancel() {
      ac.abort();
    },
  });
}
