# Writing tools

A tool is an Anthropic tool definition plus a host executor. The engine calls
`execute(input, ctx)` and streams the result.

```ts
import { defineTool } from "@kartal-onur/hubai/core";

export const createTask = defineTool<ToolContext>({
  definition: {
    name: "create_task",
    description: "Create a task in a project.",
    input_schema: {
      type: "object",
      properties: {
        project_id: { type: "string" },
        title: { type: "string" },
      },
      required: ["project_id", "title"],
    },
  },
  refreshOnSuccess: true, // emit {refresh:true} so the client can refetch
  execute: async (input, ctx) => {
    const { data, error } = await ctx.supabase.from("tasks").insert({
      project_id: input.project_id,
      title: input.title,
    }).select("id, title").single();
    if (error) return `Error: ${error.message}`;
    return `Task created: "${data.title}" (${data.id})`;
  },
});
```

## Return a string

`execute` returns a plain string. That string is both what the model sees as the
tool result and (sliced) the optional status summary. Returning a string keeps
executors reusable from non-AI code paths (e.g. a webhook calling the same tool
by name).

## Per-tool behavior flags

| Flag | Effect |
|------|--------|
| `refreshOnSuccess: true` | After the loop, emit a `{refresh:true}` SSE event. Use for write actions so the UI can `router.refresh()`. |
| `emitLink: true` | Parse the result as JSON; if it has `{href}`, emit a `{link}` event. |
| `emitLink: (result) => ({href,label}) \| null` | Custom link extraction for results that are not plain `{href,label}` JSON. |
| `redactSummary: (result) => string` | Replace the streamed status summary (e.g. to strip PII). Takes precedence over `summaryMaxChars`. |

## Navigation tool

`createNavigateTool` builds a ready-made `navigate` tool from a screen map. It
returns `{href,label}` and sets `emitLink: true`, so the engine surfaces a
clickable button. No tool-name special-casing lives in the engine.

```ts
createNavigateTool<ToolContext>({
  routes: {
    reports: { path: "/dashboard/reports", label: "Open reports" },
    project_detail: { path: "/dashboard/projects", label: "Open project" },
  },
  // Append ids or query params per screen:
  buildHref: (screen, route, input) =>
    screen === "project_detail" && input.entity_id
      ? `${route.path}/${input.entity_id}`
      : route.path,
});
```

The route keys become the tool's `screen` enum. Tune the model's guidance with
`description`, `screenDescription`, and `entityIdDescription`.

## Reusing executors outside the AI loop

Because executors take `(input, ctx)` and return a string, you can build a small
dispatcher to call them by name from other code (a webhook, a cron job):

```ts
const MAP = new Map(TOOLS.map((t) => [t.definition.name, t]));
export async function runTool(name: string, input: Record<string, unknown>, ctx: ToolContext) {
  const tool = MAP.get(name);
  return tool ? tool.execute(input, ctx) : `Unknown tool: ${name}`;
}
```

## Multi-tenant safety

The engine forwards `ctx` to your tools and trusts it. Scope every query by the
identity in `ctx` (and rely on row-level security). A tool that ignores `orgId`
breaks tenant isolation; the engine cannot enforce it for you.
