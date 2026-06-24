import { useState } from "react";
import { PHASES } from "../data.js";
import { C, L, fd, fdu, today } from "../storage.js";
import { Icon } from "../components/icons.jsx";
import { WorkoutPresetBuilder } from "../components/WorkoutPresetBuilder.jsx";
import { ActionButton, Screen, ScreenHeader, SurfaceButton, SurfaceCard } from "../components/ui.jsx";
import { getWorkoutSuggestion } from "../progression.js";
import { getWorkoutPresets } from "../workouts.js";

export function HomeScreen({
  app,
  sessionsThisWeek,
  streakSummary,
  getPhaseProgress,
  onOpenRecovery,
  onOpenReview,
  onSaveWorkoutPreset,
  onDeleteWorkoutPreset,
  onStartWorkout,
}) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const { phase, week, deload } = getPhaseProgress();
  const todayRecovery = app.recovery.find((entry) => entry.date === today());
  const athleteName = (app.profile?.name || "").trim();
  const workoutPresets = getWorkoutPresets(app);

  return (
    <Screen>
      <ScreenHeader bottomSpace={28} topPadding="calc(env(safe-area-inset-top, 0px) + 24px)">
        <p style={{ fontSize: 12, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Coach Orion Hale</p>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, lineHeight: 1.2, color: "#fff" }}>{athleteName ? `${athleteName}, ready to train?` : "Elite Athlete Program"}</h1>
        {app.phaseStart && (
          <SurfaceCard style={{ marginTop: 14, background: `${PHASES[phase].color}12`, border: `1px solid ${PHASES[phase].color}33`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: PHASES[phase].color, margin: 0 }}>Phase {phase + 1} — {PHASES[phase].name}</p>
              <p style={{ fontSize: 11, color: "#666", margin: "2px 0 0" }}>{PHASES[phase].theme}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: 0 }}>W{week}</p>
              {deload && <p style={{ fontSize: 9, color: "#F5A623", fontWeight: 700, margin: 0, textTransform: "uppercase" }}>Deload</p>}
            </div>
          </SurfaceCard>
        )}
      </ScreenHeader>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {[
          { value: app.sessions.length, label: "Sessions" },
          { value: sessionsThisWeek, label: "This Week" },
          { value: Object.keys(app.personalBests).length, label: "PBs" },
        ].map((stat) => (
          <SurfaceCard key={stat.label} style={{ flex: 1, textAlign: "center", marginBottom: 0 }}>
            <p style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#fff" }}>{stat.value}</p>
            <p style={{ fontSize: 10, color: "#555", margin: 0 }}>{stat.label}</p>
          </SurfaceCard>
        ))}
      </div>

      <SurfaceCard style={{ marginBottom: 14, borderColor: "rgba(45,125,210,0.24)", background: "rgba(45,125,210,0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: "#8BA6C9", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>Weekly Streak</p>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "#fff", fontWeight: 700 }}>
              {streakSummary.currentStreak} week{streakSummary.currentStreak === 1 ? "" : "s"} running
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9AA4B3" }}>
              {streakSummary.currentWeekCount}/{streakSummary.weeklyTarget} sessions this week ({streakSummary.currentWeekLabel})
            </p>
          </div>
          <Icon name="calendar" size={20} color="#2D7DD2" />
        </div>
      </SurfaceCard>

      <SurfaceButton onClick={onOpenRecovery} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, border: todayRecovery ? "1px solid rgba(69,182,73,0.2)" : C.border, background: todayRecovery ? "rgba(69,182,73,0.04)" : C.background }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: todayRecovery ? "#45B649" : "#fff", display: "flex", alignItems: "center", gap: 6 }}>{todayRecovery && <Icon name="check" size={14} color="#45B649" />}Today's Recovery</p>
          <p style={{ fontSize: 11, color: "#555", margin: "2px 0 0" }}>{todayRecovery ? `${todayRecovery.sleep}h sleep · ${todayRecovery.water}L water` : "Log sleep, hydration & mobility"}</p>
        </div>
        <span style={{ color: "#555", fontSize: 18 }}>›</span>
      </SurfaceButton>

      {new Date().getDay() === 0 && !app.weeklyReviews.find((review) => review.date === today()) && (
        <SurfaceButton onClick={onOpenReview} style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.2)", marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: "#F5A623", display: "flex", alignItems: "center", gap: 6 }}><Icon name="clipboard" size={14} color="#F5A623" />Weekly Review Due</p>
          <p style={{ fontSize: 11, color: "#888", margin: "2px 0 0" }}>Answer 5 questions. Stay accountable.</p>
        </SurfaceButton>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: "20px 0 10px" }}>
        <p style={{ ...L, margin: 0 }}>Workout Presets</p>
        <ActionButton
          type="button"
          compact
          fullWidth={false}
          tone={builderOpen ? "tinted" : "secondary"}
          color="#4EA1FF"
          onClick={() => setBuilderOpen((open) => !open)}
          style={{ width: "auto", padding: "9px 11px", display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Icon name={builderOpen ? "x" : "plus"} size={14} />
          {builderOpen ? "Close" : "New"}
        </ActionButton>
      </div>

      {builderOpen && (
        <WorkoutPresetBuilder
          onCancel={() => setBuilderOpen(false)}
          onSave={(preset) => {
            onSaveWorkoutPreset(preset);
            setBuilderOpen(false);
          }}
        />
      )}

      {workoutPresets.map((workout) => {
        const lastSession = [...app.sessions].reverse().find((session) => session.workoutId === workout.id);
        const latestRecovery = [...(app.recovery || [])].slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || {};
        const suggestion = getWorkoutSuggestion({ ...app, readiness: latestRecovery }, workout);
        const isCustom = workout.source === "custom";
        const exerciseCount = (workout.performance?.length || 0) + (workout.finisher?.length || 0);
        return (
          <SurfaceButton key={workout.id} onClick={() => onStartWorkout(workout.id)} style={{ position: "relative", overflow: "hidden", paddingLeft: 22 }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: workout.color }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 10, color: workout.color, fontWeight: 700, margin: 0, letterSpacing: "0.08em", textTransform: "uppercase" }}>{isCustom ? "Custom" : "Orion"} · {exerciseCount} exercises</p>
                <p style={{ fontSize: 16, fontWeight: 600, margin: "3px 0 0", color: "#fff" }}>{workout.shortTitle}</p>
                <p style={{ fontSize: 11, color: "#555", margin: "2px 0 0" }}>{workout.goal}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {isCustom && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteWorkoutPreset(workout.id);
                    }}
                    title="Delete custom preset"
                    style={{
                      appearance: "none",
                      WebkitAppearance: "none",
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      border: "1px solid rgba(255,93,93,0.25)",
                      background: "rgba(255,93,93,0.08)",
                      color: "#FF5D5D",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                )}
                <span style={{ fontSize: 22, color: workout.color, fontWeight: 300 }}>→</span>
              </div>
            </div>
            {lastSession && <p style={{ fontSize: 10, color: "#444", marginTop: 6, marginBottom: 0 }}>Last: {fd(lastSession.date)} · {fdu(lastSession.duration)}</p>}
            {suggestion && (
              <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p style={{ margin: 0, fontSize: 11, color: suggestion.readiness.zone === "green" ? "#45B649" : suggestion.readiness.zone === "yellow" ? "#F5A623" : "#E84545", fontWeight: 700 }}>
                  {suggestion.readiness.label} readiness · {suggestion.headline}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 10, color: "#98A2B3" }}>{suggestion.note}</p>
              </div>
            )}
          </SurfaceButton>
        );
      })}
    </Screen>
  );
}
