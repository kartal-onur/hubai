import Anthropic from "@anthropic-ai/sdk";
import type {
  ApiKeyResolver,
  ChatMessage,
  HubAI,
  HubAIConfig,
  HubAIContext,
} from "./types";
import { runToolLoop } from "./anthropic-loop";
import { envApiKeyResolver, noopRateLimiter } from "./rate-limiter";
import { mapAnthropicError } from "./errors";

const DEFAULT_BASE_URL = "https://api.anthropic.com";
const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_MAX_TOOL_LOOPS = 5;
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_SUMMARY_MAX_CHARS = 100;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

// Build a request handler that runs the Anthropic tool-loop and streams SSE.
// Framework-agnostic: `handleRequest(req: Request)` returns a streaming
// `Response`, so it drops into Next route handlers, Netlify Functions v2, etc.
export function createHubAI<Ctx extends HubAIContext = HubAIContext>(
  config: HubAIConfig<Ctx>
): HubAI {
  const resolveApiKey: ApiKeyResolver<Ctx> =
    config.resolveApiKey ?? (envApiKeyResolver as ApiKeyResolver<Ctx>);
  const rateLimiter = config.rateLimiter ?? noopRateLimiter;
  const onError = config.onError ?? ((err: unknown) => mapAnthropicError(err));
  const msg = config.messages ?? {};

  return {
    async handleRequest(req: Request): Promise<Response> {
      try {
        // 1) Identity (host owns auth). null/throw -> 401.
        let ctx: Ctx | null;
        try {
          ctx = await config.resolveContext(req);
        } catch {
          ctx = null;
        }
        if (!ctx) {
          return new Response(msg.unauthorized ?? "Unauthorized", { status: 401 });
        }

        // 2) API key. undefined -> 400.
        const apiKey = await resolveApiKey(ctx);
        if (!apiKey) {
          return new Response(msg.missingKey ?? "AI assistant is not configured.", {
            status: 400,
          });
        }

        // 3) Rate limit. blocked -> 429.
        const rl = await rateLimiter.check(ctx);
        if (!rl.allowed) {
          return new Response(
            rl.message ?? msg.rateLimited ?? "Rate limit reached. Please try again later.",
            { status: 429 }
          );
        }
        await rateLimiter.record(ctx);

        // 4) Parse the conversation.
        let body: unknown = null;
        try {
          body = await req.json();
        } catch {
          body = null;
        }
        const messages = (body as { messages?: ChatMessage[] } | null)?.messages;
        if (!messages || messages.length === 0) {
          return new Response(msg.emptyMessages ?? "Messages required", { status: 400 });
        }

        // 5) System prompt (resolved once; keep it static for prompt-cache hits).
        const system =
          typeof config.system === "function" ? await config.system(ctx) : config.system;

        // baseURL is pinned by default so a runtime-injected ANTHROPIC_BASE_URL
        // (e.g. Netlify AI Gateway) cannot break manual keys with a 401.
        const anthropic = new Anthropic({
          apiKey,
          baseURL: config.baseURL ?? DEFAULT_BASE_URL,
        });

        const ctxForError = ctx;
        const stream = runToolLoop<Ctx>({
          anthropic,
          model: config.model ?? DEFAULT_MODEL,
          maxTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
          maxToolLoops: config.maxToolLoops ?? DEFAULT_MAX_TOOL_LOOPS,
          system,
          cache: config.cache ?? true,
          summaryMaxChars: config.summaryMaxChars ?? DEFAULT_SUMMARY_MAX_CHARS,
          tools: config.tools,
          ctx,
          messages,
          onError: (err) => onError(err, ctxForError),
          maxLoopsMessage: msg.maxLoops ?? "Reached the maximum number of steps.",
          signal: req.signal,
        });

        return new Response(stream, { headers: SSE_HEADERS });
      } catch (err) {
        // Adapter/system failure before streaming: never leak raw errors or
        // stacks; log server-side and return a generic 500.
        if (typeof console !== "undefined") console.error("[hubai] handleRequest:", err);
        return new Response(msg.serverError ?? "Internal server error", { status: 500 });
      }
    },
  };
}
