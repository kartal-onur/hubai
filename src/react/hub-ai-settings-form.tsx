"use client";

// Presentational personal-API-key settings block. All persistence is delegated to
// callbacks, so it stays framework/storage-agnostic. The host wires onSave/onRemove
// to its own storage and onTest to a request against its HubAI endpoint.

import { useState } from "react";
import type { CSSProperties } from "react";
import type { IconComponent } from "./types";
import { CheckIcon, CloseIcon, SparklesIcon, SpinnerIcon } from "./icons";

export interface HubAIKeySettingsLabels {
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

export interface HubAIKeySettingsProps {
  currentKey: string | null;
  onSave: (key: string) => Promise<void>;
  onRemove: () => Promise<void>;
  /** Returns true on a successful connection test. */
  onTest: () => Promise<boolean>;
  labels?: Partial<HubAIKeySettingsLabels>;
  icons?: { sparkles?: IconComponent };
  className?: string;
}

const DEFAULT_LABELS: HubAIKeySettingsLabels = {
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
  testError: "Connection failed. Check the key.",
};

const V = {
  bg: "var(--hubai-bg, #ffffff)",
  fg: "var(--hubai-fg, #0a0a0a)",
  border: "var(--hubai-border, rgba(0,0,0,0.08))",
  mutedFg: "var(--hubai-muted-fg, #71717a)",
  asstBg: "var(--hubai-assistant-bg, #f4f4f5)",
  userBg: "var(--hubai-user-bg, #0a0a0a)",
  userFg: "var(--hubai-user-fg, #fafafa)",
  accent: "var(--hubai-accent, #ff3b30)",
};

export function HubAIKeySettings(props: HubAIKeySettingsProps) {
  const { currentKey, onSave, onRemove, onTest, className } = props;
  const labels = { ...DEFAULT_LABELS, ...props.labels };
  const Sparkles = props.icons?.sparkles ?? SparklesIcon;

  const [apiKey, setApiKey] = useState("");
  const [pending, setPending] = useState(false);
  const [test, setTest] = useState<"idle" | "testing" | "success" | "error">("idle");

  const hasKey = !!currentKey;
  const masked = currentKey
    ? `${currentKey.slice(0, 10)}...${currentKey.slice(-4)}`
    : "";

  const save = async () => {
    if (!apiKey.trim()) return;
    setPending(true);
    try {
      await onSave(apiKey.trim());
      setApiKey("");
      setTest("idle");
    } catch {
      // Host surfaces the error (e.g. toast); keep the entered key.
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
      // Host surfaces the error; keep current state.
    } finally {
      setPending(false);
    }
  };

  const runTest = async () => {
    setTest("testing");
    try {
      setTest((await onTest()) ? "success" : "error");
    } catch {
      setTest("error");
    }
  };

  return (
    <div
      className={className}
      style={{
        background: V.bg,
        color: V.fg,
        border: `1px solid ${V.border}`,
        borderRadius: 16,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        fontFamily: "var(--hubai-font, inherit)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            padding: 8,
            borderRadius: 12,
            background: V.asstBg,
            display: "flex",
          }}
        >
          <Sparkles size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{labels.title}</h3>
          <p style={{ fontSize: 12, color: V.mutedFg, margin: "2px 0 0" }}>
            {labels.description}
          </p>
        </div>
        <span
          style={{
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 999,
            background: V.asstBg,
            color: hasKey ? V.fg : V.mutedFg,
            whiteSpace: "nowrap",
          }}
        >
          {hasKey ? labels.connected : labels.notConfigured}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 12, color: V.mutedFg }}>{labels.keyLabel}</label>
        {hasKey && (
          <p style={{ fontSize: 12, color: V.mutedFg, margin: 0, fontFamily: "monospace" }}>
            {labels.currentPrefix} {masked}
          </p>
        )}
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={labels.placeholder}
          disabled={pending}
          style={
            {
              fontFamily: "monospace",
              fontSize: 13,
              padding: "8px 12px",
              borderRadius: 10,
              border: `1px solid ${V.border}`,
              background: V.bg,
              color: V.fg,
              outline: "none",
            } as CSSProperties
          }
        />
        <p style={{ fontSize: 11, color: V.mutedFg, margin: 0 }}>{labels.help}</p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={save}
          disabled={!apiKey.trim() || pending}
          style={primaryBtn(!apiKey.trim() || pending)}
        >
          {pending ? labels.saving : labels.save}
        </button>
        {hasKey && (
          <>
            <button
              type="button"
              onClick={runTest}
              disabled={test === "testing"}
              style={ghostBtn(V.border, V.fg)}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {test === "testing" && <SpinnerIcon size={12} className="hubai-spin" />}
                {test === "testing" ? labels.testing : labels.test}
              </span>
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              style={ghostBtn("transparent", V.mutedFg)}
            >
              {labels.remove}
            </button>
          </>
        )}
      </div>

      {test === "success" && (
        <div style={statusBox("rgba(22,163,74,0.1)", "#16a34a")}>
          <CheckIcon size={14} /> {labels.testSuccess}
        </div>
      )}
      {test === "error" && (
        <div style={statusBox("rgba(255,59,48,0.08)", V.accent)}>
          <CloseIcon size={14} /> {labels.testError}
        </div>
      )}
    </div>
  );
}

function primaryBtn(disabled: boolean): CSSProperties {
  return {
    border: "none",
    borderRadius: 10,
    background: "var(--hubai-user-bg, #0a0a0a)",
    color: "var(--hubai-user-fg, #fafafa)",
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };
}

function ghostBtn(border: string, color: string): CSSProperties {
  return {
    border: `1px solid ${border === "transparent" ? "transparent" : border}`,
    borderRadius: 10,
    background: "transparent",
    color,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  };
}

function statusBox(bg: string, color: string): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    color,
    background: bg,
    padding: "8px 12px",
    borderRadius: 10,
  };
}
