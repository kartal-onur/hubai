# @kartal-onur/hubai

HubAI is an embeddable, framework-agnostic in-app AI assistant. It packages the
tuned behavior we built for Globalmeta WorkHub so any app can reuse it:

- **Context-scoped answers**: the assistant only does what its tools allow. It does not invent data; for heavy or filtered data it points the user to the right screen instead of dumping tables.
- **In-app navigation**: a generic `navigate` tool turns "show me last week's effort" into a clickable button to the right screen with the right filter.
- **Link replies**: any tool can surface a clickable link in the chat.
- **Bring-your-own key**: a per-user key (or a shared key) is resolved server-side and never reaches the browser.
- **Production hardening built in**: Anthropic `baseURL` pinning (avoids the Netlify AI Gateway 401 trap), prompt caching on the system prefix, per-user rate limiting, and friendly error mapping.

The single real interface is a small Server-Sent-Events (SSE) contract, so the
engine runs in any Fetch-API runtime and the UI can be anything. A headless React
hook and a themable panel ship in the box.

## Packages (subpath exports)

| Import | What it is | Runs |
|--------|------------|------|
| `@kartal-onur/hubai/core` | The engine: Anthropic tool-loop, SSE protocol, `defineTool`, `createNavigateTool`. No Next/Supabase deps. | Server |
| `@kartal-onur/hubai/react` | Headless `useHubAI` hook + themable `<HubAIChat>`, `<HubAIIntroDialog>`, `<HubAIKeySettings>`. | Client |
| `@kartal-onur/hubai/supabase` | Optional adapters: identity, per-user key resolver, rate limiter. | Server |

## Install

This is a private package on GitHub Packages. Add an `.npmrc` to the consuming
project (and provide a `GITHUB_TOKEN` with `read:packages`):

```
@kartal-onur:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

```bash
npm install @kartal-onur/hubai
```

Peer deps: `@anthropic-ai/sdk` (required). `react` / `react-dom` (only for the
`/react` subpath). `@supabase/supabase-js` (only for the `/supabase` subpath).

## Quickstart (Next.js + Supabase)

**1) Server route** (`app/api/ai/chat/route.ts`):

```ts
import { createHubAI, defineTool } from "@kartal-onur/hubai/core";
import {
  supabaseContextResolver,
  supabaseKeyResolver,
  supabaseRateLimiter,
} from "@kartal-onur/hubai/supabase";
import { createClient } from "@/lib/supabase/server";

const sayHi = defineTool({
  definition: {
    name: "say_hi",
    description: "Greet the user by name.",
    input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  },
  execute: async (input) => `Hi, ${input.name}!`,
});

const hub = createHubAI({
  system: "You are a helpful in-app assistant.",
  tools: [sayHi],
  resolveContext: supabaseContextResolver(() => createClient()),
  resolveApiKey: supabaseKeyResolver(),
  rateLimiter: supabaseRateLimiter({ limit: 60 }),
});

export async function POST(req: Request) {
  return hub.handleRequest(req);
}
```

**2) Client panel** (any client component):

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { HubAIChat } from "@kartal-onur/hubai/react";
import "@kartal-onur/hubai/styles.css";

export function Assistant() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <button onClick={() => setOpen(true)}>Assistant</button>
      <HubAIChat
        open={open}
        onClose={() => setOpen(false)}
        onNavigate={(href) => router.push(href)}
        onRefresh={() => router.refresh()}
      />
    </>
  );
}
```

**3)** Add `transpilePackages: ["@kartal-onur/hubai"]` to `next.config.ts`.

That is a working assistant. Add real tools, a `createNavigateTool` route map, and
your own copy via `labels`.

## Adapt to any UI

The SSE contract is the real interface, so the UI is not locked to the shipped
panel:

- Use `useHubAI({ endpoint })` and render your own tree.
- Theme `<HubAIChat>` with CSS variables (`--hubai-bg`, `--hubai-accent`, ...), override any slot with `classNames`, swap icons, and inject all strings via `labels`.

See [docs/theming.md](docs/theming.md).

## Adapt to any backend

Not on Supabase? Implement three small interfaces (`ContextResolver`,
`ApiKeyResolver`, `RateLimiter`) and pass them to `createHubAI`. The core has no
Supabase or Next knowledge. See [docs/adapters.md](docs/adapters.md).

## Security invariants

- The Anthropic API key is resolved and used server-side only. It never crosses the SSE stream.
- `baseURL` defaults to `https://api.anthropic.com` and does not fall back to `process.env.ANTHROPIC_BASE_URL`, so a runtime-injected gateway cannot break manual keys.
- Multi-tenant isolation is the host's job: your `resolveContext` must return the correct identity and your tools must scope every query (RLS, `orgId`).
- Tool result summaries are off by default-friendly (`summaryMaxChars`); set `false` to omit them entirely.

## Docs

- [Integration guide](docs/integration-guide.md)
- [Writing tools](docs/tools.md)
- [Adapters (non-Supabase hosts)](docs/adapters.md)
- [Theming](docs/theming.md)
- [API reference](docs/api-reference.md)

## Versioning and license

Semantic Versioning. See [CHANGELOG.md](CHANGELOG.md). Proprietary and
confidential, shared with Globalmeta team members and collaborators only. See
[LICENSE](LICENSE).
