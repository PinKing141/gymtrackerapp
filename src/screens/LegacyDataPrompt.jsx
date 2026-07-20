import { ActionButton } from "../components/ui.jsx";
import { colors, typeScale } from "../theme.js";

// Shown when this device holds pre-scoping ("device-level") data but the signed-in
// account is starting empty. The choice is always explicit — the old data is never
// adopted into an account silently.
export function LegacyDataPrompt({ prompt, onImport, onStartFresh }) {
  const name = prompt?.name;
  const sessions = prompt?.sessions || 0;

  const detail = [
    name ? `a profile for ${name}` : "a saved profile",
    sessions ? `${sessions} logged session${sessions === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(" and ");

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "calc(env(safe-area-inset-top, 0px) + 32px) 24px calc(env(safe-area-inset-bottom, 0px) + 32px)",
        boxSizing: "border-box",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h1 style={{ ...typeScale.titleMd, margin: 0, color: colors.textPrimary }}>Existing data on this device</h1>
        <p style={{ ...typeScale.body, color: colors.textSecondary, margin: "10px 0 0" }}>
          We found {detail} saved on this device from before you signed in. Do you want to bring it into this account, or start fresh?
        </p>
      </div>

      <div
        style={{
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 14,
          padding: "14px 16px",
          marginBottom: 20,
        }}
      >
        <p style={{ ...typeScale.bodySm, color: colors.textMuted, margin: 0 }}>
          Starting fresh leaves that data untouched on this device — it just won't be part of this account.
        </p>
      </div>

      <ActionButton onClick={onImport}>Import into this account</ActionButton>
      <ActionButton tone="secondary" onClick={onStartFresh} style={{ marginTop: 10 }}>
        Start fresh
      </ActionButton>
    </div>
  );
}
