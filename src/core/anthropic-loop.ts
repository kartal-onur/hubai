import Anthropic from "@anthropic-ai/sdk";
import type {
  ContentBlockParam,
  MessageParam,
  TextBlock,
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

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: SSEEvent) =>
        controller.enqueue(encoder.encode(encodeSSE(event)));

      try {
        const conversation: MessageParam[] = opts.messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        let loopCount = 0;
        let hasWriteAction = false;

        while (loopCount < opts.maxToolLoops) {
          loopCount++;

          const response = await opts.anthropic.messages.create({
            model: opts.model,
            max_tokens: opts.maxTokens,
            system: opts.cache
              ? [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }]
              : opts.system,
            tools: toolDefs,
            messages: conversation,
          });

          const toolUseBlocks = response.content.filter(
            (b): b is ToolUseBlock => b.type === "tool_use"
          );

          if (toolUseBlocks.length === 0) {
            const text = response.content
              .filter((b): b is TextBlock => b.type === "text")
              .map((b) => b.text)
              .join("");

            const words = text.split(" ");
            for (let i = 0; i < words.length; i++) {
              send({ text: (i > 0 ? " " : "") + (words[i] ?? "") });
            }

            if (hasWriteAction) send({ refresh: true });
            controller.enqueue(encoder.encode(encodeDone()));
            controller.close();
            return;
          }

          const toolResults: ContentBlockParam[] = [];

          for (const block of toolUseBlocks) {
            const name = block.name;
            const tool = toolMap.get(name);

            send({ tool_status: name, status: "executing" });

            let result: string;
            if (!tool) {
              result = `Unknown tool: ${name}`;
            } else {
              result = await tool.execute(
                block.input as Record<string, unknown>,
                opts.ctx
              );
              if (tool.emitLink) {
                const link = resolveLink(tool.emitLink, result);
                if (link) send({ link });
              }
              if (tool.refreshOnSuccess) hasWriteAction = true;
            }

            const summary = makeSummary(result, tool?.redactSummary, opts.summaryMaxChars);
            send({ tool_status: name, status: "done", summary });

            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result,
            });
          }

          conversation.push({ role: "assistant", content: response.content });
          conversation.push({ role: "user", content: toolResults });
        }

        send({ text: opts.maxLoopsMessage });
        controller.enqueue(encoder.encode(encodeDone()));
        controller.close();
      } catch (err) {
        send({ error: opts.onError(err) });
        controller.close();
      }
    },
  });
}
