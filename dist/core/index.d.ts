import { H as HubAIContext, a as HubAIConfig, b as HubAI, c as HubTool, A as ApiKeyResolver, R as RateLimiter } from '../types-TSdO-PR8.js';
export { C as ChatMessage, d as ContextResolver, e as HubAIMessages, f as HubLink, g as RateLimitResult } from '../types-TSdO-PR8.js';
export { S as SSEEvent, a as SSE_DONE, e as encodeComment, b as encodeDone, c as encodeSSE } from '../sse-GDFDMgTd.js';
export { Tool as AnthropicTool } from '@anthropic-ai/sdk/resources/messages';

declare function createHubAI<Ctx extends HubAIContext = HubAIContext>(config: HubAIConfig<Ctx>): HubAI;

declare function defineTool<Ctx extends HubAIContext = HubAIContext, I = Record<string, unknown>>(tool: HubTool<Ctx, I>): HubTool<Ctx, I>;

interface NavigateRoute {
    path: string;
    label: string;
}
interface NavigateToolOptions {
    /** screen key -> route. The keys define the tool's `screen` enum. */
    routes: Record<string, NavigateRoute>;
    name?: string;
    description?: string;
    screenDescription?: string;
    entityIdDescription?: string;
    /** Build the final href (e.g. append an id or query). Defaults to `route.path`. */
    buildHref?: (screen: string, route: NavigateRoute, input: Record<string, unknown>) => string;
    defaultLabel?: string;
}
declare function createNavigateTool<Ctx extends HubAIContext = HubAIContext>(opts: NavigateToolOptions): HubTool<Ctx>;

declare const noopRateLimiter: RateLimiter;
declare const envApiKeyResolver: ApiKeyResolver;

declare function mapAnthropicError(err: unknown): string;

export { ApiKeyResolver, HubAI, HubAIConfig, HubAIContext, HubTool, type NavigateRoute, type NavigateToolOptions, RateLimiter, createHubAI, createNavigateTool, defineTool, envApiKeyResolver, mapAnthropicError, noopRateLimiter };
