import type { ComponentType } from "react";

export interface ToolAction {
  tool: string;
  status: "executing" | "done" | "error";
  summary?: string;
}

export interface NavLink {
  href: string;
  label: string;
}

export interface HubAIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolActions?: ToolAction[];
  links?: NavLink[];
}

export interface IconProps {
  className?: string;
  size?: number;
}

export type IconComponent = ComponentType<IconProps>;

// Every visible string is injectable so the host controls language/copy.
export interface HubAIChatLabels {
  title: string;
  poweredBy: string;
  emptyTitle: string;
  emptyHint: string;
  inputPlaceholder: string;
  stopped: string;
  clearTitle: string;
  closeTitle: string;
  defaultLinkLabel: string;
  loadingError: string;
}

export type HubAIChatSlot =
  | "root"
  | "header"
  | "title"
  | "messages"
  | "messageRow"
  | "userBubble"
  | "assistantBubble"
  | "toolChip"
  | "linkButton"
  | "inputArea"
  | "input"
  | "sendButton"
  | "stopButton"
  | "closeButton"
  | "clearButton";

export type HubAIChatClassNames = Partial<Record<HubAIChatSlot, string>>;

export type HubAIChatIconSlot =
  | "sparkles"
  | "bot"
  | "send"
  | "stop"
  | "close"
  | "clear"
  | "link"
  | "loading"
  | "check";

export type HubAIChatIcons = Partial<Record<HubAIChatIconSlot, IconComponent>>;
