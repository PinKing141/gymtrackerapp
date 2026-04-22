import { BB, C } from "../storage.js";

const buttonReset = {
  appearance: "none",
  WebkitAppearance: "none",
  fontFamily: "inherit",
};

export function Screen({ children, style }) {
  return (
    <div
      style={{
        padding: "0 20px",
        paddingBottom: "max(24px, env(safe-area-inset-bottom, 0px))",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function ScreenHeader({
  action,
  title,
  subtitle,
  titleAs = "h2",
  titleStyle,
  subtitleStyle,
  topPadding = "calc(env(safe-area-inset-top, 0px) + 24px)",
  bottomSpace = 20,
  children,
}) {
  const HeadingTag = titleAs;
  const defaultTitleStyle = titleAs === "h1"
    ? { fontSize: 26, lineHeight: 1.2 }
    : { fontSize: 21, lineHeight: 1.25 };

  return (
    <div style={{ paddingTop: topPadding, marginBottom: bottomSpace }}>
      {action}
      {children}
      {title && (
        <HeadingTag
          style={{
            ...defaultTitleStyle,
            fontWeight: 700,
            margin: 0,
            color: "#fff",
            ...titleStyle,
          }}
        >
          {title}
        </HeadingTag>
      )}
      {subtitle && (
        <p
          style={{
            fontSize: 11,
            color: "#555",
            margin: "4px 0 0",
            ...subtitleStyle,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

export function BackButton({ onClick, label = "Back" }) {
  return (
    <button onClick={onClick} style={{ ...buttonReset, ...BB }}>
      ← {label}
    </button>
  );
}

export function SurfaceCard({ children, style }) {
  return <div style={{ ...C, ...style }}>{children}</div>;
}

export function SurfaceButton({ children, style, ...props }) {
  return (
    <button
      {...props}
      style={{
        ...buttonReset,
        ...C,
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        color: "#E8E6E1",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function ActionButton({
  children,
  tone = "primary",
  color = "#2D7DD2",
  compact = false,
  fullWidth = true,
  style,
  ...props
}) {
  const palettes = {
    primary: {
      background: color,
      border: "none",
      text: "#fff",
    },
    secondary: {
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.08)",
      text: "#888",
    },
    tinted: {
      background: `${color}1a`,
      border: `1px solid ${color}59`,
      text: color,
    },
    danger: {
      background: "rgba(232,69,69,0.08)",
      border: "1px solid rgba(232,69,69,0.3)",
      text: "#E84545",
    },
  };

  const palette = palettes[tone] || palettes.primary;

  return (
    <button
      {...props}
      style={{
        ...buttonReset,
        width: fullWidth ? "100%" : undefined,
        padding: compact ? "11px" : "14px",
        borderRadius: compact ? 10 : 12,
        border: palette.border,
        background: palette.background,
        color: palette.text,
        fontSize: compact ? 12 : 14,
        fontWeight: 700,
        cursor: "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function TextAreaField({ style, ...props }) {
  return (
    <textarea
      {...props}
      style={{
        width: "100%",
        boxSizing: "border-box",
        padding: "10px 12px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 10,
        color: "#ccc",
        fontSize: 12,
        minHeight: 52,
        resize: "vertical",
        fontFamily: "inherit",
        outline: "none",
        ...style,
      }}
    />
  );
}
