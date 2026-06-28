import type { HubAIContext, HubTool } from "./types";

// Identity helper for authoring tools with full type inference on ctx/input.
export function defineTool<Ctx extends HubAIContext = HubAIContext, I = Record<string, unknown>>(
  tool: HubTool<Ctx, I>
): HubTool<Ctx, I> {
  return tool;
}
