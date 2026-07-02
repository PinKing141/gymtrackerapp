import React from "react";
import { colors, radii } from "./theme.js";

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("App failed to render", error, info);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: colors.background,
          color: colors.textPrimary,
          fontFamily: "'SF Pro Display',-apple-system,system-ui,sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 390,
            width: "100%",
            padding: 22,
            borderRadius: radii.xl,
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
          }}
        >
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Orion Gym could not load</h1>
          <p style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 1.45, margin: "0 0 16px" }}>
            Refresh the page to try again. If it still fails, clear this site's cached data so the latest app files can download.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              width: "100%",
              border: "none",
              borderRadius: radii.lg,
              padding: "12px 14px",
              background: colors.accent,
              color: "#07111f",
              fontFamily: "inherit",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Refresh app
          </button>
        </div>
      </div>
    );
  }
}
