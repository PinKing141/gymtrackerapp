import { HotZoneMapCourtLines, SC_VH, SC_VW, SC_ZPATHS, SHOT_ZONES } from "../lib/shotChartGeometry.jsx";
import { colors, radii, typeScale } from "../theme.js";

// Read-only hot-zone shot chart: every tracked zone coloured by FG% so the
// athlete can see restricted area / paint / short corners / elbows / midrange
// wings / corner threes / above-the-break threes at a glance, not just as
// numbers in a list.
function zoneColor(percentage, attempts) {
  if (!attempts) return "rgba(255,255,255,0.05)";
  if (percentage >= 65) return "rgba(61,220,151,0.85)";
  if (percentage >= 50) return "rgba(78,161,255,0.8)";
  if (percentage >= 35) return "rgba(246,183,60,0.82)";
  return "rgba(232,93,4,0.82)";
}

export function ShotChart({ zoneStats, zonesById }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${colors.border}`, borderRadius: radii.lg, padding: 12 }}>
      <svg viewBox={`0 0 ${SC_VW} ${SC_VH}`} style={{ width: "100%", display: "block", borderRadius: 6 }} xmlns="http://www.w3.org/2000/svg">
        <rect width={SC_VW} height={SC_VH} fill="#0B0F16" />
        {SHOT_ZONES.map((zone) => {
          const stats = zoneStats[zone.id] || { attempts: 0, makes: 0, percentage: 0 };
          const path = SC_ZPATHS[zone.id];
          if (!path) return null;
          return (
            <path key={zone.id} d={path} fill={zoneColor(stats.percentage, stats.attempts)} stroke="rgba(255,255,255,0.25)" strokeWidth={1.2} strokeLinejoin="round">
              <title>{`${zonesById[zone.id]?.name || zone.label}: ${stats.attempts ? `${stats.percentage}% (${stats.makes}/${stats.attempts})` : "No shots yet"}`}</title>
            </path>
          );
        })}
        <HotZoneMapCourtLines />
        {SHOT_ZONES.map((zone) => {
          const stats = zoneStats[zone.id] || { attempts: 0, makes: 0, percentage: 0 };
          return (
            <text
              key={`label-${zone.id}`}
              x={zone.cx}
              y={zone.cy}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#fff"
              fontSize={stats.attempts ? 12 : 9}
              fontWeight={stats.attempts ? 900 : 700}
              style={{ pointerEvents: "none", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.9))" }}
            >
              {stats.attempts ? `${stats.percentage}%` : "–"}
            </text>
          );
        })}
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
        {[
          { label: "65%+", color: zoneColor(70, 1) },
          { label: "50-64%", color: zoneColor(55, 1) },
          { label: "35-49%", color: zoneColor(40, 1) },
          { label: "<35%", color: zoneColor(10, 1) },
        ].map((entry) => (
          <span key={entry.label} style={{ display: "inline-flex", alignItems: "center", gap: 5, ...typeScale.caption, color: colors.textMuted }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: entry.color }} />
            {entry.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// Aggregate makes/attempts/percent per zone from a flat shot list.
export function getZoneStats(shots = []) {
  const byZone = {};
  shots.forEach((shot) => {
    if (!shot?.zoneId) return;
    if (!byZone[shot.zoneId]) byZone[shot.zoneId] = { makes: 0, attempts: 0 };
    byZone[shot.zoneId].attempts += 1;
    if (shot.result === "make") byZone[shot.zoneId].makes += 1;
  });
  Object.keys(byZone).forEach((zoneId) => {
    const zone = byZone[zoneId];
    zone.percentage = zone.attempts > 0 ? Math.round((zone.makes / zone.attempts) * 100) : 0;
  });
  return byZone;
}
