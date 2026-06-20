import { HotZoneMapCourtLines, SC_VW, SC_VH, SC_ZPATHS, SHOT_ZONES } from "../../Athlete System/athlete-app/src/modules/shotChart.jsx";
import { C } from "../../Athlete System/athlete-app/src/modules/constants.js";
import { colors, radii, typeScale } from "../theme.js";

function CourtZone({ zoneId, label, selected, onSelect }) {
  const path = SC_ZPATHS[zoneId];
  if (!path) return null;

  return (
    <path
      d={path}
      fill={selected ? "rgba(232, 93, 4, 0.86)" : "rgba(6, 16, 26, 0.55)"}
      fillOpacity={selected ? 0.95 : 0.82}
      stroke={selected ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.28)"}
      strokeWidth={selected ? 2.6 : 1.2}
      strokeLinejoin="round"
      style={{ cursor: "pointer", transition: "all 0.14s ease" }}
      onClick={() => onSelect(zoneId)}
    >
      <title>{label}</title>
    </path>
  );
}

export function ShotZoneCourtPicker({ zonesById, selectedZoneId, onSelectZone }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{
        background: "rgba(255,255,255,0.05)",
        border: `1px solid ${colors.border}`,
        borderRadius: radii.lg,
        padding: 12,
      }}>
        <div style={{ minHeight: 18, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <p style={{ ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase", margin: 0 }}>
            Court Spot Picker
          </p>
          <p style={{ margin: 0, color: selectedZoneId ? "#FF9F1C" : colors.textMuted, fontWeight: 900, fontSize: 12 }}>
            {zonesById[selectedZoneId]?.name || "Select a spot"}
          </p>
        </div>

        <svg viewBox={`0 0 ${SC_VW} ${SC_VH}`} style={{ width: "100%", display: "block", borderRadius: 6 }} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="app-shot-chart-planks" patternUnits="userSpaceOnUse" width="8" height={SC_VH}>
              <rect width="8" height={SC_VH} fill="#3B1D07" />
              <line x1="4" y1="0" x2="4" y2={SC_VH} stroke="rgba(0,0,0,0.25)" strokeWidth="7" />
            </pattern>
          </defs>

          <rect width={SC_VW} height={SC_VH} fill="url(#app-shot-chart-planks)" />
          <rect width={SC_VW} height={SC_VH} fill="rgba(3,8,18,0.60)" />

          {SHOT_ZONES.map((zone) => (
            <CourtZone
              key={zone.id}
              zoneId={zone.id}
              label={zonesById[zone.id]?.name || zone.label}
              selected={selectedZoneId === zone.id}
              onSelect={onSelectZone}
            />
          ))}

          <HotZoneMapCourtLines />

          {SHOT_ZONES.map((zone) => {
            const selected = selectedZoneId === zone.id;
            return (
              <text
                key={`label-${zone.id}`}
                x={zone.cx}
                y={zone.cy}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={selected ? "#FFFFFF" : "rgba(255,255,255,0.78)"}
                fontSize={selected ? 11 : 9}
                fontWeight={selected ? 900 : 700}
                fontFamily="'Barlow Condensed',sans-serif"
                style={{ pointerEvents: "none", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.95))" }}
              >
                {zonesById[zone.id]?.name || zone.label}
              </text>
            );
          })}
        </svg>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 10, alignItems: "center" }}>
          <p style={{ margin: 0, color: colors.textSecondary, fontSize: 12 }}>
            Tap a court zone to sync the visual court with the active spot selector.
          </p>
          <button
            type="button"
            onClick={() => onSelectZone("FREE_THROW")}
            style={{
              border: `1px solid ${selectedZoneId === "FREE_THROW" ? "rgba(255,255,255,0.92)" : C.border}`,
              borderRadius: radii.pill,
              padding: "8px 12px",
              background: selectedZoneId === "FREE_THROW" ? "rgba(232, 93, 4, 0.86)" : "rgba(255,255,255,0.05)",
              color: selectedZoneId === "FREE_THROW" ? "#fff" : colors.textPrimary,
              fontWeight: 900,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            FREE THROW
          </button>
        </div>
      </div>
    </div>
  );
}