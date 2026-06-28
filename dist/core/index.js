import Anthropic2 from '@anthropic-ai/sdk';

// src/core/create-hub-ai.ts

// src/core/sse.ts
var SSE_DONE = "[DONE]";
function encodeSSE(event) {
  return `data: ${JSON.stringify(event)}

`;
}
function encodeDone() {
  return `data: ${SSE_DONE}

`;
}
function encodeComment(text) {
  return `: ${text}

`;
}

// src/core/anthropic-loop.ts
function resolveLink(emitLink, result) {
  if (typeof emitLink === "function") return emitLink(result);
  try {
    const parsed = JSON.parse(result);
    if (parsed && typeof parsed.href === "string") {
      return {
        href: parsed.href,
        label: typeof parsed.label === "string" ? parsed.label : "Open"
      };
    }
  } catch {
  }
  return null;
}
function makeSummary(result, redact, maxChars) {
  if (redact) return redact(result);
  if (maxChars === false) return void 0;
  return result.slice(0, maxChars);
}
function runToolLoop(opts) {
  const encoder = new TextEncoder();
  const toolMap = new Map(opts.tools.map((t) => [t.definition.name, t]));
  const toolDefs = opts.tools.map((t) => t.definition);
  const ac = new AbortController();
  if (opts.signal) {
    if (opts.signal.aborted) ac.abort();
    else opts.signal.addEventListener("abort", () => ac.abort(), { once: true });
  }
  return new ReadableStream({
    async start(controller) {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
        }
      };
      const send = (event) => {
        if (closed) return;
        controller.enqueue(encoder.encode(encodeSSE(event)));
      };
      const streamText = (text) => {
        if (!text) return;
        const words = text.split(" ");
        for (let i = 0; i < words.length; i++) {
          send({ text: (i > 0 ? " " : "") + (words[i] ?? "") });
        }
      };
      try {
        const conversation = opts.messages.map((m) => ({
          role: m.role,
          content: m.content
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
              system: opts.cache ? [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }] : opts.system,
              tools: toolDefs,
              messages: conversation
            },
            { signal: ac.signal }
          );
          const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
          streamText(text);
          const toolUseBlocks = response.content.filter(
            (b) => b.type === "tool_use"
          );
          if (toolUseBlocks.length === 0) {
            if (hasWriteAction) send({ refresh: true });
            if (!closed) controller.enqueue(encoder.encode(encodeDone()));
            return close();
          }
          const toolResults = [];
          for (const block of toolUseBlocks) {
            if (ac.signal.aborted) return close();
            const name = block.name;
            const tool = toolMap.get(name);
            send({ tool_status: name, status: "executing" });
            let result;
            let isError = false;
            if (!tool) {
              result = `Unknown tool: ${name}`;
              isError = true;
            } else {
              try {
                result = await tool.execute(
                  block.input,
                  opts.ctx
                );
                if (tool.emitLink) {
                  const link = resolveLink(tool.emitLink, result);
                  if (link) send({ link });
                }
                if (tool.refreshOnSuccess) hasWriteAction = true;
              } catch (err) {
                isError = true;
                result = opts.onError(err);
              }
            }
            const summary = makeSummary(result, tool?.redactSummary, opts.summaryMaxChars);
            send({ tool_status: name, status: isError ? "error" : "done", summary });
            const toolResult = {
              type: "tool_result",
              tool_use_id: block.id,
              content: result
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
        if (ac.signal.aborted) return close();
        send({ error: opts.onError(err) });
        return close();
      }
    },
    cancel() {
      ac.abort();
    }
  });
}

// src/core/rate-limiter.ts
var noopRateLimiter = {
  check: async () => ({ allowed: true }),
  record: async () => {
  }
};
var envApiKeyResolver = async () => {
  if (typeof process !== "undefined" && process.env) {
    return process.env.ANTHROPIC_API_KEY;
  }
  return void 0;
};

// src/core/errors.ts
function mapAnthropicError(err) {
  const raw = err instanceof Error ? err.message : String(err);
  const isAuth = raw.includes("authentication_error") || raw.includes("invalid x-api-key");
  if (isAuth) {
    return "The AI service is unavailable (invalid API key). Please contact your administrator.";
  }
  if (typeof console !== "undefined") console.error("[hubai] error:", raw);
  return "An unexpected error occurred. Please try again.";
}

// src/core/create-hub-ai.ts
var DEFAULT_BASE_URL = "https://api.anthropic.com";
var DEFAULT_MODEL = "claude-sonnet-4-6";
var DEFAULT_MAX_TOOL_LOOPS = 5;
var DEFAULT_MAX_TOKENS = 4096;
var DEFAULT_SUMMARY_MAX_CHARS = 100;
var SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no"
};
function createHubAI(config) {
  const resolveApiKey = config.resolveApiKey ?? envApiKeyResolver;
  const rateLimiter = config.rateLimiter ?? noopRateLimiter;
  const onError = config.onError ?? ((err) => mapAnthropicError(err));
  const msg = config.messages ?? {};
  return {
    async handleRequest(req) {
      try {
        let ctx;
        try {
          ctx = await config.resolveContext(req);
        } catch {
          ctx = null;
        }
        if (!ctx) {
          return new Response(msg.unauthorized ?? "Unauthorized", { status: 401 });
        }
        const apiKey = await resolveApiKey(ctx);
        if (!apiKey) {
          return new Response(msg.missingKey ?? "AI assistant is not configured.", {
            status: 400
          });
        }
        const rl = await rateLimiter.check(ctx);
        if (!rl.allowed) {
          return new Response(
            rl.message ?? msg.rateLimited ?? "Rate limit reached. Please try again later.",
            { status: 429 }
          );
        }
        await rateLimiter.record(ctx);
        let body = null;
        try {
          body = await req.json();
        } catch {
          body = null;
        }
        const messages = body?.messages;
        if (!messages || messages.length === 0) {
          return new Response(msg.emptyMessages ?? "Messages required", { status: 400 });
        }
        const system = typeof config.system === "function" ? await config.system(ctx) : config.system;
        const anthropic = new Anthropic2({
          apiKey,
          baseURL: config.baseURL ?? DEFAULT_BASE_URL
        });
        const ctxForError = ctx;
        const stream = runToolLoop({
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
          signal: req.signal
        });
        return new Response(stream, { headers: SSE_HEADERS });
      } catch (err) {
        if (typeof console !== "undefined") console.error("[hubai] handleRequest:", err);
        return new Response(msg.serverError ?? "Internal server error", { status: 500 });
      }
    }
  };
}

// src/core/define-tool.ts
function defineTool(tool) {
  return tool;
}

// src/core/navigate-tool.ts
var DEFAULT_DESCRIPTION = "Navigate the user to the right screen inside the app (renders a clickable button). For questions that need a lot of data or filtering, use this instead of producing a long table: the user sees real data on the screen with date/person filters. After navigating, explain in 1-2 sentences which screen and which filter to use.";
function createNavigateTool(opts) {
  const screens = Object.keys(opts.routes);
  const definition = {
    name: opts.name ?? "navigate",
    description: opts.description ?? DEFAULT_DESCRIPTION,
    input_schema: {
      type: "object",
      properties: {
        screen: {
          type: "string",
          enum: screens,
          description: opts.screenDescription ?? "Target screen."
        },
        entity_id: {
          type: "string",
          description: opts.entityIdDescription ?? "Record id for detail or filtered screens."
        },
        label: { type: "string", description: "Button text." }
      },
      required: ["screen"]
    }
  };
  return {
    definition,
    emitLink: true,
    execute: async (input) => {
      const screen = input.screen;
      const route = opts.routes[screen];
      if (!route) return JSON.stringify({ error: `Unknown screen: ${screen}` });
      const href = opts.buildHref ? opts.buildHref(screen, route, input) : route.path;
      const label = input.label || route.label || opts.defaultLabel || "Open";
      const link = { href, label };
      return JSON.stringify(link);
    }
  };
}

export { SSE_DONE, createHubAI, createNavigateTool, defineTool, encodeComment, encodeDone, encodeSSE, envApiKeyResolver, mapAnthropicError, noopRateLimiter };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map