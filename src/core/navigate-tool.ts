import type { AnthropicTool, HubAIContext, HubLink, HubTool } from "./types";

export interface NavigateRoute {
  path: string;
  label: string;
}

export interface NavigateToolOptions {
  /** screen key -> route. The keys define the tool's `screen` enum. */
  routes: Record<string, NavigateRoute>;
  name?: string;
  description?: string;
  screenDescription?: string;
  entityIdDescription?: string;
  /** Build the final href (e.g. append an id or query). Defaults to `route.path`. */
  buildHref?: (
    screen: string,
    route: NavigateRoute,
    input: Record<string, unknown>
  ) => string;
  defaultLabel?: string;
}

const DEFAULT_DESCRIPTION =
  "Navigate the user to the right screen inside the app (renders a clickable button). For questions that need a lot of data or filtering, use this instead of producing a long table: the user sees real data on the screen with date/person filters. After navigating, explain in 1-2 sentences which screen and which filter to use.";

// Generic factory for the in-app navigation tool. The result returns a JSON
// `{href,label}` payload and opts into `emitLink`, so the engine surfaces it as a
// clickable `{link}` SSE event without any tool-name-specific logic in core.
export function createNavigateTool<Ctx extends HubAIContext = HubAIContext>(
  opts: NavigateToolOptions
): HubTool<Ctx> {
  const screens = Object.keys(opts.routes);

  const definition: AnthropicTool = {
    name: opts.name ?? "navigate",
    description: opts.description ?? DEFAULT_DESCRIPTION,
    input_schema: {
      type: "object" as const,
      properties: {
        screen: {
          type: "string",
          enum: screens,
          description: opts.screenDescription ?? "Target screen.",
        },
        entity_id: {
          type: "string",
          description:
            opts.entityIdDescription ?? "Record id for detail or filtered screens.",
        },
        label: { type: "string", description: "Button text." },
      },
      required: ["screen"],
    },
  };

  return {
    definition,
    emitLink: true,
    execute: async (input) => {
      const screen = input.screen as string;
      const route = opts.routes[screen];
      if (!route) return JSON.stringify({ error: `Unknown screen: ${screen}` });
      const href = opts.buildHref ? opts.buildHref(screen, route, input) : route.path;
      const label =
        (input.label as string) || route.label || opts.defaultLabel || "Open";
      const link: HubLink = { href, label };
      return JSON.stringify(link);
    },
  };
}
