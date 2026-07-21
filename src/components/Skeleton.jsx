import { colors, radii } from "../theme.js";

// A single shimmering placeholder block. The shimmer keyframes and the
// prefers-reduced-motion override that disables them both live in the global
// stylesheet (index.html), so every Skeleton automatically respects it.
export function Skeleton({ width = "100%", height = 16, radius = radii.sm, style }) {
  return <div className="skeleton" style={{ width, height, borderRadius: radius, ...style }} />;
}

// Shaped like the Home dashboard so the transition from "booting" to real
// content doesn't jolt: a greeting, a readiness card, a couple of list rows
// and a stat row, all in placeholder form instead of a bare "Loading…" line.
export function BootSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading your account"
      style={{ minHeight: "100dvh", background: colors.background, padding: "calc(env(safe-area-inset-top, 0px) + 24px) 20px 28px" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <Skeleton width={110} height={11} />
          <Skeleton width={180} height={26} radius={8} />
        </div>
        <Skeleton width={46} height={46} radius={15} />
      </div>

      <Skeleton height={92} radius={radii.lg} style={{ marginBottom: 14 }} />
      <Skeleton height={64} radius={radii.lg} style={{ marginBottom: 8 }} />
      <Skeleton height={64} radius={radii.lg} style={{ marginBottom: 8 }} />
      <Skeleton height={64} radius={radii.lg} style={{ marginBottom: 20 }} />

      <div style={{ display: "flex", gap: 8 }}>
        <Skeleton height={70} radius={radii.lg} />
        <Skeleton height={70} radius={radii.lg} />
        <Skeleton height={70} radius={radii.lg} />
      </div>
    </div>
  );
}
