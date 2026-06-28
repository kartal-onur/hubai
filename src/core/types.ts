// Core public types. The engine has ZERO knowledge of Supabase/Next; everything
// app-specific is injected through these interfaces.

import type { Tool as AnthropicTool } from "@anthropic-ai/sdk/resources/messages";

export type { AnthropicTool };

/**
 * Identity the engine knows about. Hosts extend this with whatever their tools
 * need (db client, locale, role) via the generic Ctx parameter; the engine treats
 * those extra fields as opaque and just forwards ctx to tools/resolvers.
 */
export interface HubAIContext {
  userId: string;
  orgId?: string;
}

export interface HubLink {
  href: string;
  label: string;
}

/** A tool: an Anthropic definition plus a host-supplied executor. */
export interface HubTool<Ctx extends HubAIContext = HubAIContext, I = Record<string, unknown>> {
  definition: AnthropicTool;
  /** Returns a plain string (kept simple so non-AI callers can reuse executors). */
  execute: (input: I, ctx: Ctx) => Promise<string>;
  /** Write-action: emit a `{refresh:true}` event after the loop if this ran. */
  refreshOnSuccess?: boolean;
  /**
   * Surface the result as a clickable `{link}` event. `true` = parse the result
   * as JSON and emit when it carries `{href}`. A function returns a link or null.
   */
  emitLink?: boolean | ((result: string) => HubLink | null);
  /** Replace the streamed `tool_status.summary` (e.g. to strip PII). */
  redactSummary?: (result: string) => string;
}

/** Host does its own auth and returns identity. `null` -> 401. */
export type ContextResolver<Ctx extends HubAIContext = HubAIContext> = (
  req: Request
) => Promise<Ctx | null>;

/** Resolve the Anthropic key for this request. `undefined` -> 400. */
export type ApiKeyResolver<Ctx extends HubAIContext = HubAIContext> = (
  ctx: Ctx
) => Promise<string | undefined>;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
  message?: string;
}

export interface RateLimiter<Ctx extends HubAIContext = HubAIContext> {
  check: (ctx: Ctx) => Promise<RateLimitResult>;
  record: (ctx: Ctx) => Promise<void>;
}

/** Overridable HTTP error/status messages (host supplies localized copy). */
export interface HubAIMessages {
  unauthorized?: string;
  missingKey?: string;
  rateLimited?: string;
  emptyMessages?: string;
  maxLoops?: string;
  serverError?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface HubAIConfig<Ctx extends HubAIContext = HubAIContext> {
  tools: HubTool<Ctx>[];
  /** Static string is cached; a function lets the host vary it (disables cache benefit). */
  system: string | ((ctx: Ctx) => string | Promise<string>);
  resolveContext: ContextResolver<Ctx>;
  resolveApiKey?: ApiKeyResolver<Ctx>;
  rateLimiter?: RateLimiter<Ctx>;
  model?: string;
  maxToolLoops?: number;
  maxTokens?: number;
  /** Pinned to the official API by default; protects Netlify hosts from gateway injection. */
  baseURL?: string;
  /** Max chars of each tool result streamed as a status summary. `false` = omit (safer for PII). */
  summaryMaxChars?: number | false;
  /** Prompt caching on the system prefix. Default true. */
  cache?: boolean;
  onError?: (err: unknown, ctx?: Ctx) => string;
  messages?: HubAIMessages;
}

export interface HubAI {
  handleRequest: (req: Request) => Promise<Response>;
}
