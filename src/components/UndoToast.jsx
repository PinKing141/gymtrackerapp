import { colors, radii, typeScale } from "../theme.js";

export function UndoToast({ toast, onUndo, onDismiss }) {
  if (!toast) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "sticky",
        bottom: "max(14px, env(safe-area-inset-bottom, 0px))",
        left: 0,
        right: 0,
        zIndex: 60,
        margin: "10px auto 0",
        maxWidth: 380,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: radii.lg,
        background: "#1B1B24",
        border: `1px solid ${colors.borderStrong}`,
        boxShadow: "0 12px 30px rgba(0,0,0,0.4)",
      }}
    >
      <p style={{ margin: 0, flex: 1, minWidth: 0, ...typeScale.bodySm, color: colors.textPrimary }}>{toast.message}</p>
      <button
        type="button"
        onClick={onUndo}
        style={{ background: "none", border: "none", padding: "6px 4px", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 13, color: colors.accent, minHeight: 32 }}
      >
        Undo
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        style={{ background: "none", border: "none", padding: 8, margin: -4, cursor: "pointer", color: colors.textMuted, fontSize: 16, lineHeight: 1, minWidth: 32, minHeight: 32 }}
      >
        ✕
      </button>
    </div>
  );
}
