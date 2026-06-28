import * as react from 'react';
import { ComponentType, CSSProperties } from 'react';
import { S as SSEEvent } from '../sse-GDFDMgTd.js';

interface ToolAction {
    tool: string;
    status: "executing" | "done" | "error";
    summary?: string;
}
interface NavLink {
    href: string;
    label: string;
}
interface HubAIMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    toolActions?: ToolAction[];
    links?: NavLink[];
}
interface IconProps {
    className?: string;
    size?: number;
}
type IconComponent = ComponentType<IconProps>;
interface HubAIChatLabels {
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
type HubAIChatSlot = "root" | "header" | "title" | "messages" | "messageRow" | "userBubble" | "assistantBubble" | "toolChip" | "linkButton" | "inputArea" | "input" | "sendButton" | "stopButton" | "closeButton" | "clearButton";
type HubAIChatClassNames = Partial<Record<HubAIChatSlot, string>>;
type HubAIChatIconSlot = "sparkles" | "bot" | "send" | "stop" | "close" | "clear" | "link" | "loading" | "check";
type HubAIChatIcons = Partial<Record<HubAIChatIconSlot, IconComponent>>;

interface UseHubAIOptions {
    /** Server endpoint that runs createHubAI().handleRequest. Default "/api/ai/chat". */
    endpoint?: string;
    /** localStorage key for chat history. Omit to disable persistence. */
    storageKey?: string;
    /** Max messages kept in storage. Default 100. */
    historyLimit?: number;
    /** Called for each navigation link the assistant emits. */
    onLink?: (link: NavLink) => void;
    /** Called once after a stream that performed a write action (e.g. router.refresh). */
    onRefresh?: () => void;
    /** Text shown when the user stops a stream with no content yet. */
    stoppedText?: string;
    /** Inject a custom fetch (auth headers, SSR, tests). Default global fetch. */
    fetcher?: typeof fetch;
}
interface UseHubAIResult {
    messages: HubAIMessage[];
    isStreaming: boolean;
    send: (text: string) => Promise<void>;
    stop: () => void;
    clear: () => void;
}
declare function useHubAI(options?: UseHubAIOptions): UseHubAIResult;

interface HubAIChatProps {
    open: boolean;
    onClose: () => void;
    endpoint?: string;
    storageKey?: string;
    historyLimit?: number;
    /** Router-agnostic navigation. Default: window.location.href = href. */
    onNavigate?: (href: string) => void;
    /** Called once after a write-action stream (e.g. router.refresh). */
    onRefresh?: () => void;
    labels?: Partial<HubAIChatLabels>;
    /** Map raw tool name -> human label for the status chips. */
    toolLabels?: Record<string, string>;
    icons?: HubAIChatIcons;
    className?: string;
    classNames?: HubAIChatClassNames;
    style?: CSSProperties;
    /** PWA standalone header padding. Default true. */
    safeArea?: boolean;
    fetcher?: typeof fetch;
}
declare function HubAIChat(props: HubAIChatProps): react.JSX.Element | null;

interface HubAIIntroLabels {
    title: string;
    body: string;
    hint?: string;
    openButton: string;
    laterButton: string;
    closeTitle: string;
}
interface HubAIIntroDialogProps {
    /** localStorage key that records "seen". Bump it to re-announce. */
    storageKey: string;
    onOpenChat: () => void;
    labels?: Partial<HubAIIntroLabels>;
    icons?: {
        sparkles?: IconComponent;
        close?: IconComponent;
        arrow?: IconComponent;
    };
    className?: string;
    zIndex?: number;
}
declare function HubAIIntroDialog(props: HubAIIntroDialogProps): react.JSX.Element | null;

interface HubAIKeySettingsLabels {
    title: string;
    description: string;
    connected: string;
    notConfigured: string;
    keyLabel: string;
    placeholder: string;
    currentPrefix: string;
    help: string;
    save: string;
    saving: string;
    test: string;
    testing: string;
    remove: string;
    testSuccess: string;
    testError: string;
}
interface HubAIKeySettingsProps {
    currentKey: string | null;
    onSave: (key: string) => Promise<void>;
    onRemove: () => Promise<void>;
    /** Returns true on a successful connection test. */
    onTest: () => Promise<boolean>;
    labels?: Partial<HubAIKeySettingsLabels>;
    icons?: {
        sparkles?: IconComponent;
    };
    className?: string;
}
declare function HubAIKeySettings(props: HubAIKeySettingsProps): react.JSX.Element;

type ParsedLine = {
    type: "event";
    event: SSEEvent;
} | {
    type: "done";
} | {
    type: "parse_error";
    raw: string;
} | null;
declare function parseSSELine(line: string): ParsedLine;
interface SSEHandlers {
    onText: (chunk: string) => void;
    onToolStatus: (status: {
        tool: string;
        status: "executing" | "done" | "error";
        summary?: string;
    }) => void;
    onLink: (link: {
        href: string;
        label: string;
    }) => void;
    onRefresh: () => void;
    onError: (message: string) => void;
}
declare function readSSEStream(body: ReadableStream<Uint8Array>, handlers: SSEHandlers): Promise<void>;

export { HubAIChat, type HubAIChatClassNames, type HubAIChatIconSlot, type HubAIChatIcons, type HubAIChatLabels, type HubAIChatProps, type HubAIChatSlot, HubAIIntroDialog, type HubAIIntroDialogProps, type HubAIIntroLabels, HubAIKeySettings, type HubAIKeySettingsLabels, type HubAIKeySettingsProps, type HubAIMessage, type IconComponent, type IconProps, type NavLink, type ParsedLine, type SSEHandlers, type ToolAction, type UseHubAIOptions, type UseHubAIResult, parseSSELine, readSSEStream, useHubAI };
