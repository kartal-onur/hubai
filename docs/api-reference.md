# API reference

## `@kartal-onur/hubai/core`

### `createHubAI<Ctx>(config): { handleRequest(req: Request): Promise<Response> }`

`HubAIConfig<Ctx>`:

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `tools` | `HubTool<Ctx>[]` | required | Tool set. |
| `system` | `string \| (ctx) => string \| Promise<string>` | required | Keep static for prompt-cache hits. |
| `resolveContext` | `(req) => Promise<Ctx \| null>` | required | `null`/throw -> 401. |
| `resolveApiKey` | `(ctx) => Promise<string \| undefined>` | `envApiKeyResolver` | `undefined` -> 400. |
| `rateLimiter` | `RateLimiter<Ctx>` | `noopRateLimiter` | blocked -> 429. |
| `model` | `string` | `"claude-sonnet-4-6"` | |
| `maxToolLoops` | `number` | `5` | |
| `maxTokens` | `number` | `4096` | |
| `baseURL` | `string` | `"https://api.anthropic.com"` | Pinned; no env fallback. |
| `summaryMaxChars` | `number \| false` | `100` | `false` omits tool status summaries. |
| `cache` | `boolean` | `true` | Prompt caching on the system prefix. |
| `onError` | `(err, ctx?) => string` | `mapAnthropicError` | Friendly message for the `error` event. |
| `messages` | `HubAIMessages` | English defaults | Override 401/400/429/empty/max-loops copy. |

### `defineTool<Ctx, I>(tool): HubTool<Ctx, I>`

`HubTool`: `{ definition: AnthropicTool; execute(input, ctx): Promise<string>;
refreshOnSuccess?; emitLink?; redactSummary? }`. See [tools.md](tools.md).

### `createNavigateTool<Ctx>(options): HubTool<Ctx>`

`options`: `{ routes: Record<string, { path; label }>; name?; description?;
screenDescription?; entityIdDescription?; buildHref?; defaultLabel? }`.

### Other exports

- `noopRateLimiter`, `envApiKeyResolver`
- `mapAnthropicError(err): string`
- `encodeSSE(event)`, `encodeDone()`, `encodeComment(text)`, `SSE_DONE`
- Types: `SSEEvent`, `HubAIContext`, `HubAIConfig`, `HubAI`, `HubTool`, `HubLink`, `ContextResolver`, `ApiKeyResolver`, `RateLimiter`, `RateLimitResult`, `HubAIMessages`, `ChatMessage`, `AnthropicTool`

### SSE contract (`SSEEvent`)

```ts
| { text: string }
| { tool_status: string; status: "executing" | "done" | "error"; summary?: string }
| { link: { href: string; label: string } }
| { refresh: true }
| { error: string }
// terminal line: data: [DONE]
```

## `@kartal-onur/hubai/react`

- `useHubAI(options): { messages, isStreaming, send, stop, clear }` — options: `{ endpoint?, storageKey?, historyLimit?, onLink?, onRefresh?, stoppedText?, fetcher? }`.
- `<HubAIChat>` — props: `{ open, onClose, endpoint?, storageKey?, historyLimit?, onNavigate?, onRefresh?, labels?, toolLabels?, icons?, className?, classNames?, style?, safeArea?, fetcher? }`.
- `<HubAIIntroDialog>` — props: `{ storageKey, onOpenChat, labels?, icons?, className?, zIndex? }`.
- `<HubAIKeySettings>` — props: `{ currentKey, onSave, onRemove, onTest, labels?, icons?, className? }`.
- `parseSSELine`, `readSSEStream` — low-level SSE helpers.
- Types: `HubAIMessage`, `NavLink`, `ToolAction`, `IconComponent`, `HubAIChatLabels`, `HubAIChatClassNames`, `HubAIChatIcons`, and the slot/icon-slot unions.

## `@kartal-onur/hubai/supabase`

- `supabaseContextResolver<S>(getClient, opts?)` — `opts`: `{ profilesTable?, idColumn?, orgColumn? }`. Returns `{ supabase, userId, orgId }`.
- `supabaseKeyResolver(opts?)` — `opts`: `{ table?, idColumn?, settingsColumn?, keyField?, fallbackEnv? }`.
- `supabaseRateLimiter(opts)` — `opts`: `{ limit, windowMs?, table?, userColumn?, createdAtColumn?, message? }`.
