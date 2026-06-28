"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HubAIMessage, NavLink, ToolAction } from "./types";
import { readSSEStream } from "./sse-client";

export interface UseHubAIOptions {
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

export interface UseHubAIResult {
  messages: HubAIMessage[];
  isStreaming: boolean;
  send: (text: string) => Promise<void>;
  stop: () => void;
  clear: () => void;
}

const randomId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

// Headless HubAI client: manages messages, SSE streaming, abort, and optional
// persistence. UI-framework-agnostic at the protocol layer; render however you like.
export function useHubAI(options: UseHubAIOptions = {}): UseHubAIResult {
  const {
    endpoint = "/api/ai/chat",
    storageKey,
    historyLimit = 100,
    stoppedText = "(stopped)",
    fetcher,
  } = options;

  const [messages, setMessages] = useState<HubAIMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const hydratedRef = useRef(false);
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
    setMessages([]);
    if (!storageKey) return;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }, [storageKey]);

  // Hydrate from storage once.
  useEffect(() => {
    if (storageKey) {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as HubAIMessage[];
          if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
        }
      } catch {
        // ignore
      }
    }
    hydratedRef.current = true;
  }, [storageKey]);

  // Persist on change (after hydration, trimmed).
  useEffect(() => {
    if (!hydratedRef.current || !storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages.slice(-historyLimit)));
    } catch {
      // ignore quota/access errors
    }
  }, [messages, storageKey, historyLimit]);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || streamingRef.current) return;

      const userMessage: HubAIMessage = { id: randomId(), role: "user", content };
      const assistantId = randomId();
      const assistantMessage: HubAIMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        toolActions: [],
      };

      const apiMessages = [...messagesRef.current, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);

      const updateAssistant = (fn: (m: HubAIMessage) => HubAIMessage) =>
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? fn(m) : m)));

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
          signal: controller.signal,
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(errText || "Request failed");
        }
        if (!response.body) throw new Error("No response body");

        await readSSEStream(response.body, {
          onToolStatus: ({ tool, status, summary }) =>
            updateAssistant((m) => {
              const existing = m.toolActions ?? [];
              const idx = existing.findIndex((a) => a.tool === tool);
              const action: ToolAction = { tool, status, summary };
              const toolActions =
                idx >= 0
                  ? existing.map((a, i) => (i === idx ? action : a))
                  : [...existing, action];
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
          },
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
        if (needsRefresh) onRefreshRef.current?.();
      }
    },
    [endpoint, fetcher, stoppedText]
  );

  return { messages, isStreaming, send, stop, clear };
}
