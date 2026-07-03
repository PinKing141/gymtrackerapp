import { useState } from "react";
import { fd, fdu } from "../storage.js";
import { Icon } from "../components/icons.jsx";
import { WorkoutPresetBuilder } from "../components/WorkoutPresetBuilder.jsx";
import { ActionButton, Screen, ScreenHeader, SurfaceButton, SurfaceCard } from "../components/ui.jsx";
import { getWorkoutPresets } from "../workouts.js";
import { colors, radii, typeScale } from "../theme.js";

const MODULE_TABS = [
  { key: "gym", label: "Gym" },
  { key: "cardio", label: "Cardio" },
  { key: "basketball", label: "Ball" },
];

function GymSection({ app, onStartWorkout, onSaveWorkoutPreset, onDeleteWorkoutPreset }) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const workoutPresets = getWorkoutPresets(app);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: "4px 0 12px" }}>
        <p style={{ ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase", margin: 0 }}>Workout presets</p>
        <ActionButton type="button" compact fullWidth={false} tone={builderOpen ? "tinted" : "secondary"} onClick={() => setBuilderOpen((o) => !o)} style={{ width: "auto", padding: "9px 11px", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Icon name={builderOpen ? "x" : "plus"} size={14} />
          {builderOpen ? "Close" : "New"}
        </ActionButton>
      </div>

      {builderOpen && (
        <WorkoutPresetBuilder
          onCancel={() => setBuilderOpen(false)}
          onSave={(preset) => { onSaveWorkoutPreset(preset); setBuilderOpen(false); }}
        />
      )}

      {workoutPresets.map((workout) => {
        const lastSession = [...app.sessions].reverse().find((s) => s.workoutId === workout.id);
        const isCustom = workout.source === "custom";
        const exerciseCount = (workout.performance?.length || 0) + (workout.finisher?.length || 0);
        return (
          <SurfaceButton key={workout.id} onClick={() => onStartWorkout(workout.id)} style={{ position: "relative", overflow: "hidden", paddingLeft: 22 }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: workout.color }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 10, color: workout.color, fontWeight: 700, margin: 0, letterSpacing: "0.08em", textTransform: "uppercase" }}>{isCustom ? "Custom" : "Orion"} · {exerciseCount} exercises</p>
                <p style={{ fontSize: 16, fontWeight: 700, margin: "3px 0 0", color: colors.textPrimary }}>{workout.shortTitle}</p>
                <p style={{ ...typeScale.caption, color: colors.textMuted, margin: "2px 0 0" }}>{workout.goal}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {isCustom && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); onDeleteWorkoutPreset(workout.id); }} title="Delete custom preset" style={{ appearance: "none", WebkitAppearance: "none", width: 32, height: 32, borderRadius: 10, border: "1px solid rgba(255,93,93,0.25)", background: "rgba(255,93,93,0.08)", color: colors.danger, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <Icon name="trash" size={14} />
                  </button>
                )}
                <Icon name="chevronRight" size={18} color={workout.color} />
              </div>
            </div>
            {lastSession && <p style={{ fontSize: 10, color: colors.textMuted, marginTop: 6, marginBottom: 0 }}>Last: {fd(lastSession.date)} · {fdu(lastSession.duration)}</p>}
          </SurfaceButton>
        );
      })}
    </>
  );
}

function ModuleLaunchCard({ icon, title, desc, cta, onClick }) {
  return (
    <SurfaceCard style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <div style={{ width: 42, height: 42, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(78,161,255,0.12)", border: `1px solid ${colors.accent}44` }}>
            <Icon name={icon} size={22} color={colors.accent} />
          </div>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: colors.textPrimary }}>{title}</p>
        </div>
        <p style={{ margin: "0 0 14px", ...typeScale.bodySm, color: colors.textSecondary }}>{desc}</p>
        <ActionButton onClick={onClick}>{cta}</ActionButton>
      </div>
    </SurfaceCard>
  );
}

export function TrainScreen({ app, onStartWorkout, onSaveWorkoutPreset, onDeleteWorkoutPreset, onNavigate }) {
  const modules = app.profile?.enabledModules || { gym: true, cardio: true, basketball: false };
  const tabs = MODULE_TABS.filter((t) => modules[t.key] || t.key === "gym");
  const [tab, setTab] = useState("gym");
  const active = tabs.find((t) => t.key === tab) ? tab : "gym";

  return (
    <Screen>
      <ScreenHeader title="Train" titleAs="h1" bottomSpace={16} topPadding="calc(env(safe-area-inset-top, 0px) + 24px)" />

      {tabs.length > 1 && (
        <div style={{ display: "flex", gap: 6, padding: 4, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: `1px solid ${colors.border}`, marginBottom: 18 }}>
          {tabs.map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} style={{ flex: 1, minWidth: 0, padding: "9px 4px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: active === t.key ? "rgba(78,161,255,0.18)" : "transparent", color: active === t.key ? colors.accent : colors.textMuted }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {active === "gym" && (
        <GymSection app={app} onStartWorkout={onStartWorkout} onSaveWorkoutPreset={onSaveWorkoutPreset} onDeleteWorkoutPreset={onDeleteWorkoutPreset} />
      )}

      {active === "cardio" && (
        <ModuleLaunchCard
          icon="pulse"
          title="Cardio"
          desc="Guided bike intervals now — treadmill, running & a generic cardio log are coming soon."
          cta="Open cardio routines"
          onClick={() => onNavigate("cardio")}
        />
      )}

      {active === "basketball" && (
        <ModuleLaunchCard
          icon="basketball"
          title="Basketball"
          desc="Track makes and misses by spot, with optional AI shot detection. Sessions sync to your account."
          cta="Start a session"
          onClick={() => onNavigate("basketball")}
        />
      )}
    </Screen>
  );
}
