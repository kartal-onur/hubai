"use client";

// One-time intro popup, gated by a localStorage key (per device). Themable and
// fully localizable. The host decides what "open chat" does via onOpenChat.

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { IconComponent } from "./types";
import { ArrowUpRightIcon, CloseIcon, SparklesIcon } from "./icons";

export interface HubAIIntroLabels {
  title: string;
  body: string;
  hint?: string;
  openButton: string;
  laterButton: string;
  closeTitle: string;
}

export interface HubAIIntroDialogProps {
  /** localStorage key that records "seen". Bump it to re-announce. */
  storageKey: string;
  onOpenChat: () => void;
  labels?: Partial<HubAIIntroLabels>;
  icons?: { sparkles?: IconComponent; close?: IconComponent; arrow?: IconComponent };
  className?: string;
  zIndex?: number;
}

const DEFAULT_LABELS: HubAIIntroLabels = {
  title: "Hub AI is live",
  body: "You now have a built-in assistant. Create tasks, add records, log time, or just ask a question and it will take you to the right screen.",
  hint: "Open it any time from the assistant button.",
  openButton: "Open Hub AI",
  laterButton: "Later",
  closeTitle: "Close",
};

const V = {
  bg: "var(--hubai-bg, #ffffff)",
  fg: "var(--hubai-fg, #0a0a0a)",
  headerBg: "var(--hubai-header-bg, #0a0a0a)",
  headerFg: "var(--hubai-header-fg, #fafafa)",
  mutedFg: "var(--hubai-muted-fg, #71717a)",
  userBg: "var(--hubai-user-bg, #0a0a0a)",
  userFg: "var(--hubai-user-fg, #fafafa)",
};

export function HubAIIntroDialog(props: HubAIIntroDialogProps) {
  const { storageKey, onOpenChat, className, zIndex = 60 } = props;
  const labels = { ...DEFAULT_LABELS, ...props.labels };
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(storageKey)) setOpen(true);
    } catch {
      // private mode etc. -> never show
    }
  }, [storageKey]);

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey, new Date().toISOString());
    } catch {
      // ignore
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

  return (
    <div
      className={className}
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={dismiss}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(2px)",
        }}
      />
      <div
        className="hubai-intro-card"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 384,
          background: V.bg,
          color: V.fg,
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          fontFamily: "var(--hubai-font, inherit)",
        }}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label={labels.closeTitle}
          className="hubai-icon-btn"
          style={{
            position: "absolute",
            right: 12,
            top: 12,
            padding: 4,
            borderRadius: 8,
            border: "none",
            background: "transparent",
            color: V.mutedFg,
            cursor: "pointer",
          }}
        >
          <Close size={16} />
        </button>

        <div
          style={{
            marginBottom: 16,
            height: 48,
            width: 48,
            borderRadius: 16,
            background: V.headerBg,
            color: V.headerFg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Sparkles size={24} />
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{labels.title}</h2>
        <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6, color: V.mutedFg }}>
          {labels.body}
        </p>
        {labels.hint && (
          <p style={{ marginTop: 12, fontSize: 12, lineHeight: 1.6, color: V.mutedFg }}>
            {labels.hint}
          </p>
        )}

        <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={openChat}
            className="hubai-link-btn"
            style={
              {
                flex: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                borderRadius: 12,
                border: "none",
                background: V.userBg,
                color: V.userFg,
                padding: "10px 16px",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              } as CSSProperties
            }
          >
            {labels.openButton}
            <Arrow size={14} />
          </button>
          <button
            type="button"
            onClick={dismiss}
            style={{
              borderRadius: 12,
              border: "none",
              background: "transparent",
              color: V.mutedFg,
              padding: "10px 16px",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {labels.laterButton}
          </button>
        </div>
      </div>
    </div>
  );
}
