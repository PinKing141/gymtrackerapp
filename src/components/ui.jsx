import { BB, C } from "../storage.js";
import { Icon } from "./icons.jsx";

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
    <button onClick={onClick} style={{ ...buttonReset, ...BB, display: "inline-flex", alignItems: "center", gap: 6 }}>
      <Icon name="chevronLeft" size={15} color="#777" />
      {label}
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

export function Pill({ children, color = "#888", background = "rgba(255,255,255,0.05)", border, style }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 8px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.04em",
        color,
        background,
        border: border || "1px solid transparent",
        ...style,
      }}
    >
      {children}
    </span>
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

export function CelebrationOverlay({ celebration, onDismiss }) {
  if (!celebration) {
    return null;
  }

  const pieces = Array.from({ length: 14 }, (_, index) => ({
    id: index,
    left: 8 + index * 6.2,
    delay: `${(index % 5) * 0.08}s`,
    duration: `${1.6 + (index % 4) * 0.18}s`,
    rotate: index % 2 === 0 ? 18 : -18,
    color: index % 3 === 0 ? celebration.color : index % 3 === 1 ? "#E8E6E1" : "#8BA6C9",
  }));

  return (
    <>
      <div
        onClick={onDismiss}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 180,
          pointerEvents: "none",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 430,
            padding: "calc(env(safe-area-inset-top, 0px) + 16px) 16px 0",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 20,
              padding: "16px 16px 14px",
              background: `linear-gradient(180deg, ${celebration.color}1f, rgba(10,10,15,0.96))`,
              border: `1px solid ${celebration.color}55`,
              boxShadow: `0 18px 40px ${celebration.color}22`,
              pointerEvents: "auto",
            }}
          >
            {pieces.map((piece) => (
              <span
                key={piece.id}
                style={{
                  position: "absolute",
                  top: -8,
                  left: `${piece.left}%`,
                  width: 4,
                  height: 14,
                  borderRadius: 999,
                  background: piece.color,
                  opacity: 0.9,
                  transform: `rotate(${piece.rotate}deg)`,
                  animation: `confettiDrop ${piece.duration} ease-in forwards`,
                  animationDelay: piece.delay,
                }}
              />
            ))}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, position: "relative", zIndex: 1 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: `${celebration.color}22`,
                  border: `1px solid ${celebration.color}44`,
                }}
              >
                <Icon name={celebration.weekComplete ? "calendar" : "trophy"} size={19} color={celebration.color} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#fff" }}>{celebration.title}</p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#AEB6C2" }}>{celebration.subtitle}</p>
                {celebration.records?.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                    {celebration.records.slice(0, 3).map((record) => (
                      <Pill
                        key={record.name}
                        color="#E8E6E1"
                        background="rgba(255,255,255,0.06)"
                        border="1px solid rgba(255,255,255,0.08)"
                      >
                        <Icon name="spark" size={12} color={celebration.color} />
                        {record.name}: {record.summary}
                      </Pill>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>
        {"@keyframes confettiDrop{0%{transform:translateY(0) rotate(0deg);opacity:0}15%{opacity:1}100%{transform:translateY(62px) rotate(140deg);opacity:0}}"}
      </style>
    </>
  );
}
