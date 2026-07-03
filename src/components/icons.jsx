import { useId } from "react";

const iconBase = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

export const ICONS = {
  arrowRight: ["M5 12h14", "M13 5l7 7-7 7"],
  barChart: ["M5 20V10", "M12 20V4", "M19 20v-7"],
  bell: ["M15 17H5.5a1.5 1.5 0 01-1.2-2.4L6 12V9a6 6 0 1112 0v3l1.7 2.6A1.5 1.5 0 0118.5 17H15z", "M10 20a2 2 0 004 0"],
  calendar: ["M7 3v3", "M17 3v3", "M4 9h16", "M5 6h14a1 1 0 011 1v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a1 1 0 011-1z"],
  check: ["M5 12l4 4L19 7"],
  chevronLeft: ["M15 18l-6-6 6-6"],
  chevronRight: ["M9 18l6-6-6-6"],
  chevronUp: ["M18 15l-6-6-6 6"],
  chevronDown: ["M6 9l6 6 6-6"],
  clipboard: ["M9 4h6", "M9 4a2 2 0 00-2 2v1h10V6a2 2 0 00-2-2", "M7 7H6a2 2 0 00-2 2v9a3 3 0 003 3h10a3 3 0 003-3V9a2 2 0 00-2-2h-1", "M9 12h6", "M9 16h4"],
  crown: ["M3 9l4.7 3.7L12 5l4.3 7.7L21 9l-2 10H5L3 9z", "M7 15h10"],
  dumbbell: ["M3 10v4", "M6 8v8", "M18 8v8", "M21 10v4", "M6 12h12"],
  home: ["M4 11l8-7 8 7", "M6 10v9a1 1 0 001 1h10a1 1 0 001-1v-9", "M10 20v-5h4v5"],
  user: ["M12 12a4 4 0 100-8 4 4 0 000 8z", "M5 21a7 7 0 0114 0"],
  basketball: ["M12 3a9 9 0 100 18 9 9 0 000-18z", "M3.5 12h17", "M12 3.2c-3.2 2.6-3.2 15.9 0 17.6", "M12 3.2c3.2 2.6 3.2 15.9 0 17.6"],
  plus: ["M12 5v14", "M5 12h14"],
  pulse: ["M3 12h4l2-4 3 8 3-6 2 2h4"],
  save: ["M5 5a2 2 0 012-2h8l4 4v12a2 2 0 01-2 2H7a2 2 0 01-2-2V5z", "M9 3v5h6", "M9 21v-6h6v6"],
  search: ["M10.5 18a7.5 7.5 0 110-15 7.5 7.5 0 010 15z", "M16 16l5 5"],
  shield: ["M12 3l7 3v5c0 4.4-2.9 8.5-7 10-4.1-1.5-7-5.6-7-10V6l7-3z"],
  spark: ["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"],
  scale: ["M5 7h14l1.5 12a2 2 0 01-2 2H5.5a2 2 0 01-2-2L5 7z", "M8 7a4 4 0 118 0", "M12 12l2-2"],
  target: ["M12 3v4", "M12 17v4", "M3 12h4", "M17 12h4", "M12 8a4 4 0 100 8 4 4 0 000-8z"],
  trash: ["M4 7h16", "M10 11v6", "M14 11v6", "M6 7l1 14h10l1-14", "M9 7V4h6v3"],
  trophy: ["M8 4h8v4a4 4 0 11-8 0V4z", "M8 6H4.5a2.5 2.5 0 000 5H8", "M16 6h3.5a2.5 2.5 0 010 5H16", "M12 12v4", "M9 20h6"],
  wave: ["M3 13c2.5 0 2.5-4 5-4s2.5 4 5 4 2.5-4 5-4 2.5 4 5 4"],
  x: ["M6 6l12 12", "M18 6L6 18"],
};

export function Icon({
  name,
  paths,
  size = 16,
  color = "currentColor",
  fill = "none",
  strokeWidth = 1.8,
  style,
  viewBox = "0 0 24 24",
}) {
  const resolvedPaths = paths || ICONS[name] || [];

  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill={fill}
      stroke={fill === "none" ? color : "none"}
      strokeWidth={fill === "none" ? strokeWidth : 0}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ ...iconBase, ...style }}
    >
      {resolvedPaths.map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

export function WaterGlassIcon({
  level = 0,
  size = 40,
  color = "#2D7DD2",
  outline = "rgba(255,255,255,0.18)",
  background = "rgba(255,255,255,0.04)",
  style,
}) {
  const clipId = useId();
  const normalizedLevel = Math.max(0, Math.min(1, level));
  const liquidTop = 28 - normalizedLevel * 20;

  return (
    <svg width={size} height={(size / 24) * 28} viewBox="0 0 24 28" style={{ ...iconBase, ...style }}>
      <defs>
        <clipPath id={clipId}>
          <path d="M6 3h12l-1.1 17.3A4.5 4.5 0 0112.4 24h-.8a4.5 4.5 0 01-4.5-3.7L6 3z" />
        </clipPath>
      </defs>
      <path d="M6 3h12l-1.1 17.3A4.5 4.5 0 0112.4 24h-.8a4.5 4.5 0 01-4.5-3.7L6 3z" fill={background} />
      {normalizedLevel > 0 && (
        <rect x="4" y={liquidTop} width="16" height={24 - liquidTop} fill={color} clipPath={`url(#${clipId})`} opacity={0.9} />
      )}
      <path d="M6 3h12l-1.1 17.3A4.5 4.5 0 0112.4 24h-.8a4.5 4.5 0 01-4.5-3.7L6 3z" fill="none" stroke={outline} strokeWidth="1.6" />
      <path d="M6 3h12" fill="none" stroke={outline} strokeWidth="1.6" />
    </svg>
  );
}
