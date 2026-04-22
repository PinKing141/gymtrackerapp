import { PHASES, WORKOUTS } from "../data.js";
import { C, L, fd, fdu, today } from "../storage.js";
import { Icon } from "../components/icons.jsx";
import { Screen, ScreenHeader, SurfaceButton, SurfaceCard } from "../components/ui.jsx";

export function HomeScreen({ app, sessionsThisWeek, streakSummary, getPhaseProgress, onOpenRecovery, onOpenReview, onStartWorkout }) {
  const { phase, week, deload } = getPhaseProgress();
  const todayRecovery = app.recovery.find((entry) => entry.date === today());

  return (
    <Screen>
      <ScreenHeader bottomSpace={28} topPadding="calc(env(safe-area-inset-top, 0px) + 24px)">
        <p style={{ fontSize: 12, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Coach Orion Hale</p>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, lineHeight: 1.2, color: "#fff" }}>Elite Athlete Program</h1>
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

      <p style={L}>Start a Workout</p>
      {Object.values(WORKOUTS).map((workout) => {
        const lastSession = [...app.sessions].reverse().find((session) => session.workoutId === workout.id);
        return (
          <SurfaceButton key={workout.id} onClick={() => onStartWorkout(workout.id)} style={{ position: "relative", overflow: "hidden", paddingLeft: 22 }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: workout.color }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ fontSize: 10, color: workout.color, fontWeight: 700, margin: 0, letterSpacing: "0.08em", textTransform: "uppercase" }}>{workout.id} · {workout.day}</p>
                <p style={{ fontSize: 16, fontWeight: 600, margin: "3px 0 0", color: "#fff" }}>{workout.shortTitle}</p>
                <p style={{ fontSize: 11, color: "#555", margin: "2px 0 0" }}>{workout.goal}</p>
              </div>
              <span style={{ fontSize: 22, color: workout.color, fontWeight: 300 }}>→</span>
            </div>
            {lastSession && <p style={{ fontSize: 10, color: "#444", marginTop: 6, marginBottom: 0 }}>Last: {fd(lastSession.date)} · {fdu(lastSession.duration)}</p>}
          </SurfaceButton>
        );
      })}
    </Screen>
  );
}
