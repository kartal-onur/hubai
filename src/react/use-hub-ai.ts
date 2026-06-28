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

// An assistant turn can legitimately end with no text (a pure tool/navigate/write
// turn). The Anthropic API rejects an assistant message with empty content, so
// such messages must never be sent back or persisted.
const isSendable = (m: HubAIMessage): boolean =>
  m.role === "user" || m.content.trim() !== "";

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
  const prevKeyRef = useRef<string | undefined>(storageKey);
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
    // Abort any in-flight stream so its updates and refresh callback do not fire
    // against the cleared conversation.
    abortRef.current?.abort();
    setMessages([]);
    if (!storageKey) return;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }, [storageKey]);

  // Hydrate from storage when the key changes (once per key).
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

  // Persist on change (after hydration, trimmed, no empty assistant turns).
  useEffect(() => {
    // On a storageKey change, skip this commit's write: `messages` still holds
    // the previous key's data here, and the hydrate effect will load the new key.
    if (prevKeyRef.current !== storageKey) {
      prevKeyRef.current = storageKey;
      return;
    }
    if (!hydratedRef.current || !storageKey) return;
    try {
      const toStore = messages.filter(isSendable).slice(-historyLimit);
      localStorage.setItem(storageKey, JSON.stringify(toStore));
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

      // Drop any prior empty-content assistant turns so the API does not 400.
      const apiMessages = [...messagesRef.current, userMessage]
        .filter(isSendable)
        .map((m) => ({ role: m.role, content: m.content }));

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
        // Only refresh if the assistant message still exists (not cleared mid-stream).
        const stillPresent = messagesRef.current.some((m) => m.id === assistantId);
        if (needsRefresh && stillPresent) onRefreshRef.current?.();
      }
    },
    [endpoint, fetcher, stoppedText]
  );

  return { messages, isStreaming, send, stop, clear };
}
