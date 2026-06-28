# Integration guide (Next.js + Supabase)

Step by step for adding HubAI to a Next.js App Router app backed by Supabase.

## 1. Install

Pin the public GitHub source tarball in `package.json` (token-free, works on any
host including Netlify):

```jsonc
{
  "dependencies": {
    "@kartal-onur/hubai": "https://github.com/kartal-onur/hubai/archive/refs/tags/v0.1.2.tar.gz"
  }
}
```

```bash
npm install
```

No `.npmrc`, no token. The tarball ships `dist`, so there is no build step on the
consumer. (GitHub Packages would require a token even for a public package, and
Netlify reserves `GITHUB_TOKEN`, so the tarball URL is the reliable path.)

## 2. Transpile the package

`next.config.ts`:

```ts
const nextConfig = {
  transpilePackages: ["@kartal-onur/hubai"],
};
```

## 3. Define your tools

Create `src/lib/ai/tools.ts`. Author each tool with `defineTool`; put your
identity and db client on the context type. See [tools.md](tools.md).

```ts
import { createNavigateTool, defineTool, type HubTool } from "@kartal-onur/hubai/core";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ToolContext {
  supabase: SupabaseClient;
  userId: string;
  orgId: string;
}

export const TOOLS: HubTool<ToolContext>[] = [
  /* ...your read/write tools... */
  createNavigateTool<ToolContext>({
    routes: {
      reports: { path: "/dashboard/reports", label: "Open reports" },
      // ...
    },
  }),
];
```

## 4. The server route

`app/api/ai/chat/route.ts`:

```ts
import { createHubAI } from "@kartal-onur/hubai/core";
import {
  supabaseContextResolver,
  supabaseKeyResolver,
  supabaseRateLimiter,
} from "@kartal-onur/hubai/supabase";
import { createClient } from "@/lib/supabase/server";
import { TOOLS, type ToolContext } from "@/lib/ai/tools";

const hub = createHubAI<ToolContext>({
  system: "You are ...",
  tools: TOOLS,
  resolveContext: supabaseContextResolver(() => createClient()),
  resolveApiKey: supabaseKeyResolver(),
  rateLimiter: supabaseRateLimiter({ limit: 60 }),
  summaryMaxChars: false,
});

export async function POST(req: Request) {
  return hub.handleRequest(req);
}
```

`supabaseContextResolver` returns `{ supabase, userId, orgId }`. Your `createClient`
keeps the Next cookie wiring; the package never imports `next/headers`.

## 5. The UI

A thin client wrapper keeps your app's look and router:

```tsx
"use client";
import { useRouter } from "next/navigation";
import { HubAIChat } from "@kartal-onur/hubai/react";
import "@kartal-onur/hubai/styles.css";

export function Assistant({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  return (
    <HubAIChat
      open={open}
      onClose={onClose}
      storageKey="myapp_hub_ai_chat"
      onNavigate={(href) => router.push(href)}
      onRefresh={() => router.refresh()}
      labels={{ title: "Assistant" }}
    />
  );
}
```

## 6. Database expectations (Supabase adapter defaults)

- A usage table for rate limiting (default `ai_usage_log`) with `user_id` and `created_at`.
- `profiles.settings` (JSONB) holding an optional `claude_api_key`, plus `profiles.organization_id`.
- A shared fallback key in `ANTHROPIC_API_KEY` (used when a user has no personal key).

All names are configurable via the adapter options. See [adapters.md](adapters.md).

## 7. Optional pieces

- `<HubAIIntroDialog storageKey="..." onOpenChat={...} />` for a one-time intro.
- `<HubAIKeySettings currentKey={...} onSave={...} onRemove={...} onTest={...} />` for a personal-key settings panel.
