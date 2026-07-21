import { Icon } from "./icons.jsx";
import { ActionButton } from "./ui.jsx";
import { colors, radii, typeScale } from "../theme.js";

// Shared "nothing here yet" layout: icon, a short title, a plain-language
// subtitle, and an optional single action. Used instead of one-off empty
// paragraphs so empty screens look and read consistently across the app.
export function EmptyState({ icon = "info", title, subtitle, actionLabel, onAction, style }) {
  return (
    <div style={{ padding: "56px 20px", textAlign: "center", ...style }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: radii.lg,
          margin: "0 auto 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${colors.border}`,
        }}
      >
        <Icon name={icon} size={26} color={colors.textMuted} />
      </div>
      <p style={{ ...typeScale.body, fontWeight: 800, color: colors.textPrimary, margin: "0 0 6px" }}>{title}</p>
      {subtitle && <p style={{ ...typeScale.bodySm, color: colors.textMuted, margin: "0 auto", maxWidth: 280, lineHeight: 1.5 }}>{subtitle}</p>}
      {actionLabel && onAction && (
        <ActionButton compact onClick={onAction} style={{ marginTop: 18, maxWidth: 220, marginLeft: "auto", marginRight: "auto" }}>
          {actionLabel}
        </ActionButton>
      )}
    </div>
  );
}
