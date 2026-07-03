import { useState } from "react";
import { ActionButton } from "./ui.jsx";
import { IS } from "../storage.js";
import { colors, radii, typeScale } from "../theme.js";

/**
 * Centered confirmation dialog. When `requireText` is set the confirm button
 * stays disabled until the user types that exact word (for destructive actions).
 */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  requireText,
  onConfirm,
  onCancel,
}) {
  const [text, setText] = useState("");
  if (!open) return null;

  const ready = !requireText || text.trim().toUpperCase() === requireText.toUpperCase();
  const close = () => { setText(""); onCancel?.(); };
  const confirm = () => { if (!ready) return; setText(""); onConfirm?.(); };

  return (
    <div
      onClick={close}
      style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 360, background: colors.surfaceElevated, borderRadius: 22, border: `1px solid ${colors.border}`, padding: 22, boxShadow: "0 24px 70px rgba(0,0,0,0.5)" }}
      >
        <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: colors.textPrimary }}>{title}</p>
        {message && <p style={{ margin: "10px 0 0", ...typeScale.bodySm, lineHeight: 1.5, color: colors.textSecondary }}>{message}</p>}

        {requireText && (
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Type ${requireText} to confirm`}
            autoFocus
            style={{ ...IS, marginTop: 14, padding: 12, textAlign: "center", letterSpacing: "0.1em", textTransform: "uppercase" }}
          />
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <ActionButton tone="secondary" onClick={close}>{cancelLabel}</ActionButton>
          <ActionButton tone={tone} disabled={!ready} onClick={confirm}>{confirmLabel}</ActionButton>
        </div>
      </div>
    </div>
  );
}
