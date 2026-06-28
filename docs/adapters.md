# Adapters (non-Supabase hosts)

The core knows nothing about Supabase or Next. It depends on three small
interfaces you inject into `createHubAI`. The Supabase package is just one
implementation; write your own for any backend.

## ContextResolver

Do your own auth and return identity plus whatever your tools need. Return `null`
(or throw) to produce a 401.

```ts
import type { ContextResolver } from "@kartal-onur/hubai/core";

interface Ctx { userId: string; orgId: string; db: MyDb }

const resolveContext: ContextResolver<Ctx> = async (req) => {
  const session = await getSession(req);          // your auth
  if (!session) return null;                       // -> 401
  return { userId: session.userId, orgId: session.orgId, db: myDb };
};
```

## ApiKeyResolver

Return the Anthropic key for this request, or `undefined` for a 400. The default
`envApiKeyResolver` reads `process.env.ANTHROPIC_API_KEY`.

```ts
const resolveApiKey = async (ctx: Ctx) =>
  (await ctx.db.getUserKey(ctx.userId)) ?? process.env.ANTHROPIC_API_KEY;
```

The key is used only to construct the server-side Anthropic client. It never
reaches the browser.

## RateLimiter

`check` decides whether to allow the request; `record` logs it. The default is a
no-op (`noopRateLimiter`).

```ts
import type { RateLimiter } from "@kartal-onur/hubai/core";

const rateLimiter: RateLimiter<Ctx> = {
  check: async (ctx) => {
    const count = await ctx.db.countRequestsLastHour(ctx.userId);
    return count < 60 ? { allowed: true } : { allowed: false, message: "Rate limit reached." };
  },
  record: async (ctx) => ctx.db.logRequest(ctx.userId),
};
```

## Wire it up

```ts
const hub = createHubAI<Ctx>({
  system: "...",
  tools,
  resolveContext,
  resolveApiKey,
  rateLimiter,
});
```

## Other runtimes

`handleRequest(req: Request): Promise<Response>` is Web-standard, so it drops into:

- **Next.js App Router**: `export async function POST(req) { return hub.handleRequest(req); }`
- **Netlify Functions v2**: `export default (req) => hub.handleRequest(req); export const config = { path: "/api/ai/chat" };`
- **Cloudflare / Deno / Bun**: wire `fetch` to `hub.handleRequest`.

On runtimes without `process.env` (e.g. Workers), supply your own `resolveApiKey`
that reads the platform's env instead of relying on `envApiKeyResolver`.
