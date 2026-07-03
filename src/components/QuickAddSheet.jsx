import { Icon } from "./icons.jsx";
import { colors, radii, typeScale } from "../theme.js";

export function QuickAddSheet({ open, onClose, items }) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 430,
          background: colors.surfaceElevated,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          border: `1px solid ${colors.border}`,
          padding: "10px 16px calc(env(safe-area-inset-bottom, 0px) + 20px)",
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.18)", margin: "6px auto 14px" }} />
        <p style={{ ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase", margin: "0 0 12px" }}>Quick add</p>
        <div style={{ display: "grid", gap: 8 }}>
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => { onClose(); item.onClick(); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                textAlign: "left",
                padding: "14px 14px",
                borderRadius: radii.md,
                border: `1px solid ${colors.border}`,
                background: "rgba(255,255,255,0.04)",
                color: colors.textPrimary,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(78,161,255,0.12)", border: `1px solid ${colors.accent}33`, flexShrink: 0 }}>
                <Icon name={item.icon} size={19} color={colors.accent} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{item.label}</p>
                {item.desc && <p style={{ margin: "2px 0 0", ...typeScale.caption, color: colors.textMuted }}>{item.desc}</p>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
