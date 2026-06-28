"use client";
import { useState, useRef, useCallback, useEffect } from 'react';
import { jsxs, jsx, Fragment } from 'react/jsx-runtime';

// src/react/use-hub-ai.ts

// src/react/sse-client.ts
function parseSSELine(line) {
  if (!line.startsWith("data: ")) return null;
  const data = line.slice(6);
  if (data === "[DONE]") return { type: "done" };
  try {
    return { type: "event", event: JSON.parse(data) };
  } catch {
    return { type: "parse_error", raw: data };
  }
}
async function readSSEStream(body, handlers) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const parsed = parseSSELine(line);
      if (!parsed) continue;
      if (parsed.type === "done") return;
      if (parsed.type === "parse_error") {
        if (typeof console !== "undefined") {
          console.warn("[hubai] dropped malformed SSE frame:", parsed.raw);
        }
        continue;
      }
      const event = parsed.event;
      if ("tool_status" in event) {
        handlers.onToolStatus({
          tool: event.tool_status,
          status: event.status,
          summary: event.summary
        });
      } else if ("link" in event) {
        handlers.onLink(event.link);
      } else if ("refresh" in event) {
        handlers.onRefresh();
      } else if ("text" in event) {
        handlers.onText(event.text);
      } else if ("error" in event) {
        handlers.onError(event.error);
      }
    }
  }
}

// src/react/use-hub-ai.ts
var randomId = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
var isSendable = (m) => m.role === "user" || m.content.trim() !== "";
function useHubAI(options = {}) {
  const {
    endpoint = "/api/ai/chat",
    storageKey,
    historyLimit = 100,
    stoppedText = "(stopped)",
    fetcher
  } = options;
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef(null);
  const hydratedRef = useRef(false);
  const prevKeyRef = useRef(storageKey);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const streamingRef = useRef(false);
  streamingRef.current = isStreaming;
  const onLinkRef = useRef(options.onLink);
  onLinkRef.current = options.onLink;
  const onRefreshRef = useRef(options.onRefresh);
  onRefreshRef.current = options.onRefresh;
  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);
  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    if (!storageKey) return;
    try {
      localStorage.removeItem(storageKey);
    } catch {
    }
  }, [storageKey]);
  useEffect(() => {
    if (storageKey) {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
        }
      } catch {
      }
    }
    hydratedRef.current = true;
  }, [storageKey]);
  useEffect(() => {
    if (prevKeyRef.current !== storageKey) {
      prevKeyRef.current = storageKey;
      return;
    }
    if (!hydratedRef.current || !storageKey) return;
    try {
      const toStore = messages.filter(isSendable).slice(-historyLimit);
      localStorage.setItem(storageKey, JSON.stringify(toStore));
    } catch {
    }
  }, [messages, storageKey, historyLimit]);
  const send = useCallback(
    async (text) => {
      const content = text.trim();
      if (!content || streamingRef.current) return;
      const userMessage = { id: randomId(), role: "user", content };
      const assistantId = randomId();
      const assistantMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        toolActions: []
      };
      const apiMessages = [...messagesRef.current, userMessage].filter(isSendable).map((m) => ({ role: m.role, content: m.content }));
      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);
      const updateAssistant = (fn) => setMessages((prev) => prev.map((m) => m.id === assistantId ? fn(m) : m));
      let needsRefresh = false;
      let accumulated = "";
      const controller = new AbortController();
      abortRef.current = controller;
      const fetchFn = fetcher ?? fetch;
      try {
        const response = await fetchFn(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages }),
          signal: controller.signal
        });
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(errText || "Request failed");
        }
        if (!response.body) throw new Error("No response body");
        await readSSEStream(response.body, {
          onToolStatus: ({ tool, status, summary }) => updateAssistant((m) => {
            const existing = m.toolActions ?? [];
            const idx = existing.findIndex((a) => a.tool === tool);
            const action = { tool, status, summary };
            const toolActions = idx >= 0 ? existing.map((a, i) => i === idx ? action : a) : [...existing, action];
            return { ...m, toolActions };
          }),
          onLink: (link) => {
            onLinkRef.current?.(link);
            updateAssistant((m) => {
              const existing = m.links ?? [];
              if (existing.some((l) => l.href === link.href)) return m;
              return { ...m, links: [...existing, link] };
            });
          },
          onRefresh: () => {
            needsRefresh = true;
          },
          onText: (chunk) => {
            accumulated += chunk;
            updateAssistant((m) => ({ ...m, content: accumulated }));
          },
          onError: (message) => {
            accumulated = message;
            updateAssistant((m) => ({ ...m, content: message }));
          }
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          updateAssistant((m) => ({ ...m, content: m.content || stoppedText }));
        } else {
          const errMsg = err instanceof Error ? err.message : "Connection error";
          updateAssistant((m) => ({ ...m, content: errMsg }));
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
        const stillPresent = messagesRef.current.some((m) => m.id === assistantId);
        if (needsRefresh && stillPresent) onRefreshRef.current?.();
      }
    },
    [endpoint, fetcher, stoppedText]
  );
  return { messages, isStreaming, send, stop, clear };
}
function svg(path, extraProps) {
  return function Icon({ className, size = 16 }) {
    return /* @__PURE__ */ jsx(
      "svg",
      {
        className,
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": "true",
        ...extraProps,
        children: path
      }
    );
  };
}
var SparklesIcon = svg(
  /* @__PURE__ */ jsx("path", { d: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" })
);
var BotIcon = svg(
  /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("rect", { x: "4", y: "8", width: "16", height: "11", rx: "2" }),
    /* @__PURE__ */ jsx("path", { d: "M12 3v3M9 13h.01M15 13h.01" })
  ] })
);
var SendIcon = svg(/* @__PURE__ */ jsx("path", { d: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" }));
var StopIcon = svg(
  /* @__PURE__ */ jsx("rect", { x: "6", y: "6", width: "12", height: "12", rx: "1.5", fill: "currentColor", stroke: "none" })
);
var CloseIcon = svg(/* @__PURE__ */ jsx("path", { d: "M18 6L6 18M6 6l12 12" }));
var TrashIcon = svg(
  /* @__PURE__ */ jsx("path", { d: "M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" })
);
var ArrowUpRightIcon = svg(/* @__PURE__ */ jsx("path", { d: "M7 17L17 7M7 7h10v10" }));
var SpinnerIcon = svg(
  /* @__PURE__ */ jsx("path", { d: "M21 12a9 9 0 11-6.219-8.56" })
);
var CheckIcon = svg(/* @__PURE__ */ jsx("path", { d: "M20 6L9 17l-5-5" }));
var DEFAULT_LABELS = {
  title: "Hub AI",
  poweredBy: "powered by Claude",
  emptyTitle: "Hi, I'm Hub",
  emptyHint: "Ask me anything, or tell me what to do.",
  inputPlaceholder: "Ask or do something...",
  stopped: "(stopped)",
  clearTitle: "Clear chat",
  closeTitle: "Close",
  defaultLinkLabel: "Open",
  loadingError: "Something went wrong."
};
var V = {
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
  width: "var(--hubai-width, 420px)"
};
var cn = (...xs) => xs.filter(Boolean).join(" ");
function HubAIChat(props) {
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
    fetcher
  } = props;
  const labels = { ...DEFAULT_LABELS, ...props.labels };
  const { messages, isStreaming, send, stop, clear } = useHubAI({
    endpoint,
    storageKey,
    historyLimit,
    onRefresh,
    fetcher,
    stoppedText: labels.stopped
  });
  const [input, setInput] = useState("");
  const endRef = useRef(null);
  const inputRef = useRef(null);
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
    (link) => {
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
  const onKeyDown = (e) => {
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
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: cn("hubai-root", className, classNames.root),
      style: {
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
        ...style
      },
      role: "dialog",
      "aria-label": labels.title,
      children: [
        /* @__PURE__ */ jsxs(
          "div",
          {
            className: cn("hubai-header", classNames.header),
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              paddingTop: safeArea ? "calc(12px + env(safe-area-inset-top))" : "12px",
              background: V.headerBg,
              color: V.headerFg
            },
            children: [
              /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
                /* @__PURE__ */ jsx(Sparkles, { size: 16 }),
                /* @__PURE__ */ jsx("span", { className: classNames.title, style: { fontSize: 14, fontWeight: 600 }, children: labels.title }),
                /* @__PURE__ */ jsx("span", { style: { fontSize: 12, opacity: 0.6 }, children: labels.poweredBy })
              ] }),
              /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 4 }, children: [
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: clear,
                    disabled: messages.length === 0 || isStreaming,
                    title: labels.clearTitle,
                    "aria-label": labels.clearTitle,
                    className: cn("hubai-icon-btn", classNames.clearButton),
                    style: iconBtnStyle(messages.length === 0),
                    children: /* @__PURE__ */ jsx(Clear, { size: 16 })
                  }
                ),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: onClose,
                    title: labels.closeTitle,
                    "aria-label": labels.closeTitle,
                    className: cn("hubai-icon-btn", classNames.closeButton),
                    style: iconBtnStyle(false),
                    children: /* @__PURE__ */ jsx(Close, { size: 16 })
                  }
                )
              ] })
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          "div",
          {
            className: cn("hubai-messages", classNames.messages),
            style: {
              flex: 1,
              overflowY: "auto",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 16
            },
            children: [
              messages.length === 0 && /* @__PURE__ */ jsxs(
                "div",
                {
                  style: {
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    padding: "0 24px",
                    color: V.mutedFg
                  },
                  children: [
                    /* @__PURE__ */ jsx(
                      "div",
                      {
                        style: {
                          height: 48,
                          width: 48,
                          borderRadius: 16,
                          background: V.asstBg,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginBottom: 16
                        },
                        children: /* @__PURE__ */ jsx(Bot, { size: 24 })
                      }
                    ),
                    /* @__PURE__ */ jsx("p", { style: { fontSize: 14, fontWeight: 500, color: V.fg, margin: 0 }, children: labels.emptyTitle }),
                    /* @__PURE__ */ jsx("p", { style: { fontSize: 12, marginTop: 4, lineHeight: 1.6 }, children: labels.emptyHint })
                  ]
                }
              ),
              messages.map((message) => {
                const isUser = message.role === "user";
                return /* @__PURE__ */ jsxs(
                  "div",
                  {
                    className: cn("hubai-row", classNames.messageRow),
                    style: {
                      display: "flex",
                      gap: 10,
                      justifyContent: isUser ? "flex-end" : "flex-start"
                    },
                    children: [
                      !isUser && /* @__PURE__ */ jsx(
                        "div",
                        {
                          style: {
                            height: 24,
                            width: 24,
                            borderRadius: 8,
                            background: V.headerBg,
                            color: V.headerFg,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            marginTop: 2
                          },
                          children: /* @__PURE__ */ jsx(Sparkles, { size: 12 })
                        }
                      ),
                      /* @__PURE__ */ jsxs("div", { style: { maxWidth: "85%", display: "flex", flexDirection: "column", gap: 6 }, children: [
                        message.toolActions && message.toolActions.length > 0 && /* @__PURE__ */ jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 4 }, children: message.toolActions.map((action) => /* @__PURE__ */ jsxs(
                          "span",
                          {
                            className: cn("hubai-chip", classNames.toolChip),
                            style: {
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              fontSize: 10,
                              padding: "2px 8px",
                              borderRadius: 999,
                              background: V.asstBg,
                              color: V.mutedFg
                            },
                            children: [
                              action.status === "executing" ? /* @__PURE__ */ jsx(Loading, { size: 10, className: "hubai-spin" }) : /* @__PURE__ */ jsx(Check, { size: 10 }),
                              toolLabels?.[action.tool] ?? action.tool
                            ]
                          },
                          action.tool
                        )) }),
                        /* @__PURE__ */ jsx(
                          "div",
                          {
                            className: cn(
                              "hubai-bubble",
                              isUser ? classNames.userBubble : classNames.assistantBubble
                            ),
                            style: {
                              borderRadius: V.radius,
                              padding: "10px 14px",
                              fontSize: 14,
                              lineHeight: 1.6,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              background: isUser ? V.userBg : V.asstBg,
                              color: isUser ? V.userFg : V.asstFg,
                              borderBottomRightRadius: isUser ? 6 : V.radius,
                              borderBottomLeftRadius: isUser ? V.radius : 6
                            },
                            children: message.content || /* @__PURE__ */ jsx("span", { style: { display: "inline-flex", color: V.mutedFg }, children: /* @__PURE__ */ jsx(Loading, { size: 12, className: "hubai-spin" }) })
                          }
                        ),
                        message.links && message.links.length > 0 && /* @__PURE__ */ jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 }, children: message.links.map((link) => /* @__PURE__ */ jsxs(
                          "button",
                          {
                            type: "button",
                            onClick: () => navigate(link),
                            className: cn("hubai-link-btn", classNames.linkButton),
                            style: {
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
                              color: V.userFg
                            },
                            children: [
                              link.label || labels.defaultLinkLabel,
                              /* @__PURE__ */ jsx(LinkArrow, { size: 12 })
                            ]
                          },
                          link.href
                        )) })
                      ] })
                    ]
                  },
                  message.id
                );
              }),
              /* @__PURE__ */ jsx("div", { ref: endRef })
            ]
          }
        ),
        /* @__PURE__ */ jsx(
          "div",
          {
            className: cn("hubai-input-area", classNames.inputArea),
            style: { padding: 12, borderTop: `1px solid ${V.border}` },
            children: /* @__PURE__ */ jsxs(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 8,
                  background: V.asstBg,
                  borderRadius: 12,
                  padding: "8px 12px"
                },
                children: [
                  /* @__PURE__ */ jsx(
                    "textarea",
                    {
                      ref: inputRef,
                      value: input,
                      onChange: (e) => setInput(e.target.value),
                      onKeyDown,
                      placeholder: labels.inputPlaceholder,
                      rows: 1,
                      className: classNames.input,
                      style: {
                        flex: 1,
                        resize: "none",
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        fontSize: 14,
                        color: V.fg,
                        maxHeight: 96,
                        fontFamily: "inherit",
                        fieldSizing: "content"
                      }
                    }
                  ),
                  isStreaming ? /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      onClick: stop,
                      "aria-label": labels.stopped,
                      className: cn("hubai-send-btn", classNames.stopButton),
                      style: sendBtnStyle(V.accent, V.userFg, false),
                      children: /* @__PURE__ */ jsx(Stop, { size: 12 })
                    }
                  ) : /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      onClick: submit,
                      disabled: !input.trim(),
                      "aria-label": "Send",
                      className: cn("hubai-send-btn", classNames.sendButton),
                      style: sendBtnStyle(V.userBg, V.userFg, !input.trim()),
                      children: /* @__PURE__ */ jsx(Send, { size: 14 })
                    }
                  )
                ]
              }
            )
          }
        )
      ]
    }
  );
}
function iconBtnStyle(disabled) {
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
    opacity: disabled ? 0.4 : 1
  };
}
function sendBtnStyle(bg, fg, disabled) {
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
    opacity: disabled ? 0.5 : 1
  };
}
var DEFAULT_LABELS2 = {
  title: "Hub AI is live",
  body: "You now have a built-in assistant. Create tasks, add records, log time, or just ask a question and it will take you to the right screen.",
  hint: "Open it any time from the assistant button.",
  openButton: "Open Hub AI",
  laterButton: "Later",
  closeTitle: "Close"
};
var V2 = {
  bg: "var(--hubai-bg, #ffffff)",
  fg: "var(--hubai-fg, #0a0a0a)",
  headerBg: "var(--hubai-header-bg, #0a0a0a)",
  headerFg: "var(--hubai-header-fg, #fafafa)",
  mutedFg: "var(--hubai-muted-fg, #71717a)",
  userBg: "var(--hubai-user-bg, #0a0a0a)",
  userFg: "var(--hubai-user-fg, #fafafa)"
};
function HubAIIntroDialog(props) {
  const { storageKey, onOpenChat, className, zIndex = 60 } = props;
  const labels = { ...DEFAULT_LABELS2, ...props.labels };
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(storageKey)) setOpen(true);
    } catch {
    }
  }, [storageKey]);
  const dismiss = () => {
    try {
      localStorage.setItem(storageKey, (/* @__PURE__ */ new Date()).toISOString());
    } catch {
    }
    setOpen(false);
  };
  const openChat = () => {
    dismiss();
    onOpenChat();
  };
  if (!open) return null;
  const Sparkles = props.icons?.sparkles ?? SparklesIcon;
  const Close = props.icons?.close ?? CloseIcon;
  const Arrow = props.icons?.arrow ?? ArrowUpRightIcon;
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className,
      role: "dialog",
      "aria-modal": "true",
      style: {
        position: "fixed",
        inset: 0,
        zIndex,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16
      },
      children: [
        /* @__PURE__ */ jsx(
          "div",
          {
            onClick: dismiss,
            style: {
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.4)",
              backdropFilter: "blur(2px)"
            }
          }
        ),
        /* @__PURE__ */ jsxs(
          "div",
          {
            className: "hubai-intro-card",
            style: {
              position: "relative",
              width: "100%",
              maxWidth: 384,
              background: V2.bg,
              color: V2.fg,
              borderRadius: 16,
              padding: 24,
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              fontFamily: "var(--hubai-font, inherit)"
            },
            children: [
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: dismiss,
                  "aria-label": labels.closeTitle,
                  className: "hubai-icon-btn",
                  style: {
                    position: "absolute",
                    right: 12,
                    top: 12,
                    padding: 4,
                    borderRadius: 8,
                    border: "none",
                    background: "transparent",
                    color: V2.mutedFg,
                    cursor: "pointer"
                  },
                  children: /* @__PURE__ */ jsx(Close, { size: 16 })
                }
              ),
              /* @__PURE__ */ jsx(
                "div",
                {
                  style: {
                    marginBottom: 16,
                    height: 48,
                    width: 48,
                    borderRadius: 16,
                    background: V2.headerBg,
                    color: V2.headerFg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  },
                  children: /* @__PURE__ */ jsx(Sparkles, { size: 24 })
                }
              ),
              /* @__PURE__ */ jsx("h2", { style: { fontSize: 18, fontWeight: 600, margin: 0 }, children: labels.title }),
              /* @__PURE__ */ jsx("p", { style: { marginTop: 8, fontSize: 14, lineHeight: 1.6, color: V2.mutedFg }, children: labels.body }),
              labels.hint && /* @__PURE__ */ jsx("p", { style: { marginTop: 12, fontSize: 12, lineHeight: 1.6, color: V2.mutedFg }, children: labels.hint }),
              /* @__PURE__ */ jsxs("div", { style: { marginTop: 20, display: "flex", alignItems: "center", gap: 8 }, children: [
                /* @__PURE__ */ jsxs(
                  "button",
                  {
                    type: "button",
                    onClick: openChat,
                    className: "hubai-link-btn",
                    style: {
                      flex: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      borderRadius: 12,
                      border: "none",
                      background: V2.userBg,
                      color: V2.userFg,
                      padding: "10px 16px",
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: "pointer"
                    },
                    children: [
                      labels.openButton,
                      /* @__PURE__ */ jsx(Arrow, { size: 14 })
                    ]
                  }
                ),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: dismiss,
                    style: {
                      borderRadius: 12,
                      border: "none",
                      background: "transparent",
                      color: V2.mutedFg,
                      padding: "10px 16px",
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: "pointer"
                    },
                    children: labels.laterButton
                  }
                )
              ] })
            ]
          }
        )
      ]
    }
  );
}
var DEFAULT_LABELS3 = {
  title: "Claude AI Assistant",
  description: "Connect your personal Claude API key to use the assistant.",
  connected: "Connected",
  notConfigured: "Not configured",
  keyLabel: "API Key",
  placeholder: "sk-ant-api03-...",
  currentPrefix: "Current:",
  help: "The key is stored server-side and never sent to the client.",
  save: "Save",
  saving: "Saving...",
  test: "Test connection",
  testing: "Testing...",
  remove: "Remove",
  testSuccess: "Connection successful.",
  testError: "Connection failed. Check the key."
};
var V3 = {
  bg: "var(--hubai-bg, #ffffff)",
  fg: "var(--hubai-fg, #0a0a0a)",
  border: "var(--hubai-border, rgba(0,0,0,0.08))",
  mutedFg: "var(--hubai-muted-fg, #71717a)",
  asstBg: "var(--hubai-assistant-bg, #f4f4f5)",
  accent: "var(--hubai-accent, #ff3b30)"
};
function HubAIKeySettings(props) {
  const { currentKey, onSave, onRemove, onTest, className } = props;
  const labels = { ...DEFAULT_LABELS3, ...props.labels };
  const Sparkles = props.icons?.sparkles ?? SparklesIcon;
  const [apiKey, setApiKey] = useState("");
  const [pending, setPending] = useState(false);
  const [test, setTest] = useState("idle");
  const hasKey = !!currentKey;
  const masked = currentKey ? `${currentKey.slice(0, 10)}...${currentKey.slice(-4)}` : "";
  const save = async () => {
    if (!apiKey.trim()) return;
    setPending(true);
    try {
      await onSave(apiKey.trim());
      setApiKey("");
      setTest("idle");
    } catch {
    } finally {
      setPending(false);
    }
  };
  const remove = async () => {
    setPending(true);
    try {
      await onRemove();
      setApiKey("");
      setTest("idle");
    } catch {
    } finally {
      setPending(false);
    }
  };
  const runTest = async () => {
    setTest("testing");
    try {
      setTest(await onTest() ? "success" : "error");
    } catch {
      setTest("error");
    }
  };
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className,
      style: {
        background: V3.bg,
        color: V3.fg,
        border: `1px solid ${V3.border}`,
        borderRadius: 16,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        fontFamily: "var(--hubai-font, inherit)"
      },
      children: [
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 12 }, children: [
          /* @__PURE__ */ jsx(
            "div",
            {
              style: {
                padding: 8,
                borderRadius: 12,
                background: V3.asstBg,
                display: "flex"
              },
              children: /* @__PURE__ */ jsx(Sparkles, { size: 20 })
            }
          ),
          /* @__PURE__ */ jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [
            /* @__PURE__ */ jsx("h3", { style: { fontSize: 14, fontWeight: 600, margin: 0 }, children: labels.title }),
            /* @__PURE__ */ jsx("p", { style: { fontSize: 12, color: V3.mutedFg, margin: "2px 0 0" }, children: labels.description })
          ] }),
          /* @__PURE__ */ jsx(
            "span",
            {
              style: {
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 999,
                background: V3.asstBg,
                color: hasKey ? V3.fg : V3.mutedFg,
                whiteSpace: "nowrap"
              },
              children: hasKey ? labels.connected : labels.notConfigured
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: [
          /* @__PURE__ */ jsx("label", { style: { fontSize: 12, color: V3.mutedFg }, children: labels.keyLabel }),
          hasKey && /* @__PURE__ */ jsxs("p", { style: { fontSize: 12, color: V3.mutedFg, margin: 0, fontFamily: "monospace" }, children: [
            labels.currentPrefix,
            " ",
            masked
          ] }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "password",
              value: apiKey,
              onChange: (e) => setApiKey(e.target.value),
              placeholder: labels.placeholder,
              disabled: pending,
              style: {
                fontFamily: "monospace",
                fontSize: 13,
                padding: "8px 12px",
                borderRadius: 10,
                border: `1px solid ${V3.border}`,
                background: V3.bg,
                color: V3.fg,
                outline: "none"
              }
            }
          ),
          /* @__PURE__ */ jsx("p", { style: { fontSize: 11, color: V3.mutedFg, margin: 0 }, children: labels.help })
        ] }),
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }, children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: save,
              disabled: !apiKey.trim() || pending,
              style: primaryBtn(!apiKey.trim() || pending),
              children: pending ? labels.saving : labels.save
            }
          ),
          hasKey && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: runTest,
                disabled: test === "testing",
                style: ghostBtn(V3.border, V3.fg),
                children: /* @__PURE__ */ jsxs("span", { style: { display: "inline-flex", alignItems: "center", gap: 6 }, children: [
                  test === "testing" && /* @__PURE__ */ jsx(SpinnerIcon, { size: 12, className: "hubai-spin" }),
                  test === "testing" ? labels.testing : labels.test
                ] })
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: remove,
                disabled: pending,
                style: ghostBtn("transparent", V3.mutedFg),
                children: labels.remove
              }
            )
          ] })
        ] }),
        test === "success" && /* @__PURE__ */ jsxs("div", { style: statusBox("rgba(22,163,74,0.1)", "#16a34a"), children: [
          /* @__PURE__ */ jsx(CheckIcon, { size: 14 }),
          " ",
          labels.testSuccess
        ] }),
        test === "error" && /* @__PURE__ */ jsxs("div", { style: statusBox("rgba(255,59,48,0.08)", V3.accent), children: [
          /* @__PURE__ */ jsx(CloseIcon, { size: 14 }),
          " ",
          labels.testError
        ] })
      ]
    }
  );
}
function primaryBtn(disabled) {
  return {
    border: "none",
    borderRadius: 10,
    background: "var(--hubai-user-bg, #0a0a0a)",
    color: "var(--hubai-user-fg, #fafafa)",
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1
  };
}
function ghostBtn(border, color) {
  return {
    border: `1px solid ${border === "transparent" ? "transparent" : border}`,
    borderRadius: 10,
    background: "transparent",
    color,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer"
  };
}
function statusBox(bg, color) {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    color,
    background: bg,
    padding: "8px 12px",
    borderRadius: 10
  };
}

export { HubAIChat, HubAIIntroDialog, HubAIKeySettings, parseSSELine, readSSEStream, useHubAI };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map