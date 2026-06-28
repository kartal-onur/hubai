// @kartal-onur/hubai/react — headless hook + themable UI over the SSE contract.

export { useHubAI } from "./use-hub-ai";
export type { UseHubAIOptions, UseHubAIResult } from "./use-hub-ai";

export { HubAIChat } from "./hub-ai-chat";
export type { HubAIChatProps } from "./hub-ai-chat";

export { HubAIIntroDialog } from "./hub-ai-intro-dialog";
export type { HubAIIntroDialogProps, HubAIIntroLabels } from "./hub-ai-intro-dialog";

export { HubAIKeySettings } from "./hub-ai-settings-form";
export type {
  HubAIKeySettingsProps,
  HubAIKeySettingsLabels,
} from "./hub-ai-settings-form";

export { parseSSELine, readSSEStream } from "./sse-client";
export type { ParsedLine, SSEHandlers } from "./sse-client";

export type {
  HubAIMessage,
  NavLink,
  ToolAction,
  IconComponent,
  IconProps,
  HubAIChatLabels,
  HubAIChatClassNames,
  HubAIChatIcons,
  HubAIChatSlot,
  HubAIChatIconSlot,
} from "./types";
