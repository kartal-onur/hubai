"use client";

// HubAI slide-over chat panel. Self-contained styling via CSS custom properties
// with sensible fallbacks (works even without importing the optional styles.css).
// Theme with CSS variables, override per-slot with classNames, swap icons, and
// inject all copy via labels. Navigation is router-agnostic (onNavigate).

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { useHubAI } from "./use-hub-ai";
import type {
  HubAIChatClassNames,
  HubAIChatIcons,
  HubAIChatLabels,
  NavLink,
} from "./types";
import {
  ArrowUpRightIcon,
  BotIcon,
  CheckIcon,
  CloseIcon,
  SendIcon,
  SparklesIcon,
  SpinnerIcon,
  StopIcon,
  TrashIcon,
} from "./icons";

export interface HubAIChatProps {
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

const DEFAULT_LABELS: HubAIChatLabels = {
  title: "Hub AI",
  poweredBy: "powered by Claude",
  emptyTitle: "Hi, I'm Hub",
  emptyHint: "Ask me anything, or tell me what to do.",
  inputPlaceholder: "Ask or do something...",
  stopped: "(stopped)",
  clearTitle: "Clear chat",
  closeTitle: "Close",
  defaultLinkLabel: "Open",
  loadingError: "Something went wrong.",
};

const V = {
  bg: "var(--hubai-bg, #ffffff)",
  fg: "var(--hubai-fg, #0a0a0a)",
  border: "var(--hubai-border, rgba(0,0,0,0.08))",
  headerBg: "var(--hubai-header-bg, #0a0a0a)",
  headerFg: "var(--hubai-header-fg, #fafafa)",
  userBg: "var(--hubai-user-bg, #0a0a0a)",
  userFg: "var(--hubai-user-fg, #fafafa)",
  asstBg: "var(--hubai-assistant-bg, #f4f4f5)",
  asstFg: "var(--hubai-assistant-fg, #0a0a0a)",
  mutedFg: "var(--hubai-muted-fg, #71717a)",
  accent: "var(--hubai-accent, #ff3b30)",
  radius: "var(--hubai-radius, 16px)",
  width: "var(--hubai-width, 420px)",
};

const cn = (...xs: Array<string | undefined | false>): string =>
  xs.filter(Boolean).join(" ");

export function HubAIChat(props: HubAIChatProps) {
  const {
    open,
    onClose,
    endpoint = "/api/ai/chat",
    storageKey,
    historyLimit,
    onNavigate,
    onRefresh,
    toolLabels,
    icons,
    className,
    classNames = {},
    style,
    safeArea = true,
    fetcher,
  } = props;

  const labels = { ...DEFAULT_LABELS, ...props.labels };

  const { messages, isStreaming, send, stop, clear } = useHubAI({
    endpoint,
    storageKey,
    historyLimit,
    onRefresh,
    fetcher,
    stoppedText: labels.stopped,
  });

  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [open]);

  const navigate = useCallback(
    (link: NavLink) => {
      if (onNavigate) onNavigate(link.href);
      else if (typeof window !== "undefined") window.location.href = link.href;
      onClose();
    },
    [onNavigate, onClose]
  );

  const submit = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    void send(text);
  }, [input, isStreaming, send]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  if (!open) return null;

  const Sparkles = icons?.sparkles ?? SparklesIcon;
  const Bot = icons?.bot ?? BotIcon;
  const Send = icons?.send ?? SendIcon;
  const Stop = icons?.stop ?? StopIcon;
  const Close = icons?.close ?? CloseIcon;
  const Clear = icons?.clear ?? TrashIcon;
  const LinkArrow = icons?.link ?? ArrowUpRightIcon;
  const Loading = icons?.loading ?? SpinnerIcon;
  const Check = icons?.check ?? CheckIcon;

  return (
    <div
      className={cn("hubai-root", className, classNames.root)}
      style={{
        position: "fixed",
        top: 0,
        bottom: 0,
        right: 0,
        zIndex: 50,
        width: `min(100%, ${V.width})`,
        display: "flex",
        flexDirection: "column",
        background: V.bg,
        color: V.fg,
        borderLeft: `1px solid ${V.border}`,
        boxShadow: "0 10px 40px rgba(0,0,0,0.18)",
        fontFamily: "var(--hubai-font, inherit)",
        ...style,
      }}
      role="dialog"
      aria-label={labels.title}
    >
      {/* Header */}
      <div
        className={cn("hubai-header", classNames.header)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          paddingTop: safeArea
            ? "calc(12px + env(safe-area-inset-top))"
            : "12px",
          background: V.headerBg,
          color: V.headerFg,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={16} />
          <span className={classNames.title} style={{ fontSize: 14, fontWeight: 600 }}>
            {labels.title}
          </span>
          <span style={{ fontSize: 12, opacity: 0.6 }}>{labels.poweredBy}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            type="button"
            onClick={clear}
            disabled={messages.length === 0 || isStreaming}
            title={labels.clearTitle}
            aria-label={labels.clearTitle}
            className={cn("hubai-icon-btn", classNames.clearButton)}
            style={iconBtnStyle(messages.length === 0)}
          >
            <Clear size={16} />
          </button>
          <button
            type="button"
            onClick={onClose}
            title={labels.closeTitle}
            aria-label={labels.closeTitle}
            className={cn("hubai-icon-btn", classNames.closeButton)}
            style={iconBtnStyle(false)}
          >
            <Close size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        className={cn("hubai-messages", classNames.messages)}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "0 24px",
              color: V.mutedFg,
            }}
          >
            <div
              style={{
                height: 48,
                width: 48,
                borderRadius: 16,
                background: V.asstBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Bot size={24} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 500, color: V.fg, margin: 0 }}>
              {labels.emptyTitle}
            </p>
            <p style={{ fontSize: 12, marginTop: 4, lineHeight: 1.6 }}>
              {labels.emptyHint}
            </p>
          </div>
        )}

        {messages.map((message) => {
          const isUser = message.role === "user";
          return (
            <div
              key={message.id}
              className={cn("hubai-row", classNames.messageRow)}
              style={{
                display: "flex",
                gap: 10,
                justifyContent: isUser ? "flex-end" : "flex-start",
              }}
            >
              {!isUser && (
                <div
                  style={{
                    height: 24,
                    width: 24,
                    borderRadius: 8,
                    background: V.headerBg,
                    color: V.headerFg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  <Sparkles size={12} />
                </div>
              )}
              <div style={{ maxWidth: "85%", display: "flex", flexDirection: "column", gap: 6 }}>
                {/* Tool chips */}
                {message.toolActions && message.toolActions.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {message.toolActions.map((action) => (
                      <span
                        key={action.tool}
                        className={cn("hubai-chip", classNames.toolChip)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 10,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: V.asstBg,
                          color: V.mutedFg,
                        }}
                      >
                        {action.status === "executing" ? (
                          <Loading size={10} className="hubai-spin" />
                        ) : (
                          <Check size={10} />
                        )}
                        {toolLabels?.[action.tool] ?? action.tool}
                      </span>
                    ))}
                  </div>
                )}

                {/* Bubble */}
                <div
                  className={cn(
                    "hubai-bubble",
                    isUser ? classNames.userBubble : classNames.assistantBubble
                  )}
                  style={{
                    borderRadius: V.radius,
                    padding: "10px 14px",
                    fontSize: 14,
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    background: isUser ? V.userBg : V.asstBg,
                    color: isUser ? V.userFg : V.asstFg,
                    borderBottomRightRadius: isUser ? 6 : V.radius,
                    borderBottomLeftRadius: isUser ? V.radius : 6,
                  }}
                >
                  {message.content || (
                    <span style={{ display: "inline-flex", color: V.mutedFg }}>
                      <Loading size={12} className="hubai-spin" />
                    </span>
                  )}
                </div>

                {/* Navigation buttons */}
                {message.links && message.links.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {message.links.map((link) => (
                      <button
                        type="button"
                        key={link.href}
                        onClick={() => navigate(link)}
                        className={cn("hubai-link-btn", classNames.linkButton)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 500,
                          padding: "6px 12px",
                          borderRadius: 10,
                          border: "none",
                          cursor: "pointer",
                          background: V.userBg,
                          color: V.userFg,
                        }}
                      >
                        {link.label || labels.defaultLinkLabel}
                        <LinkArrow size={12} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div
        className={cn("hubai-input-area", classNames.inputArea)}
        style={{ padding: 12, borderTop: `1px solid ${V.border}` }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
            background: V.asstBg,
            borderRadius: 12,
            padding: "8px 12px",
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={labels.inputPlaceholder}
            rows={1}
            className={classNames.input}
            style={
              {
                flex: 1,
                resize: "none",
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: 14,
                color: V.fg,
                maxHeight: 96,
                fontFamily: "inherit",
                fieldSizing: "content",
              } as CSSProperties
            }
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={stop}
              aria-label={labels.stopped}
              className={cn("hubai-send-btn", classNames.stopButton)}
              style={sendBtnStyle(V.accent, V.userFg, false)}
            >
              <Stop size={12} />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!input.trim()}
              aria-label="Send"
              className={cn("hubai-send-btn", classNames.sendButton)}
              style={sendBtnStyle(V.userBg, V.userFg, !input.trim())}
            >
              <Send size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function iconBtnStyle(disabled: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
    borderRadius: 6,
    border: "none",
    background: "transparent",
    color: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
  };
}

function sendBtnStyle(bg: string, fg: string, disabled: boolean): CSSProperties {
  return {
    height: 28,
    width: 28,
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    border: "none",
    background: bg,
    color: fg,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };
}
