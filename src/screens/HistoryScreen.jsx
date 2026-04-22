import { useEffect } from "react";
import { BB, C, fd, ft, fdu } from "../storage.js";
import { getExercisesForWorkout, getWorkoutForSession } from "../workouts.js";
import { ActionButton, BackButton, Screen, ScreenHeader, SurfaceButton, SurfaceCard } from "../components/ui.jsx";

export function HistoryScreen({ app, detailIndex, setDetailIndex, setApp }) {
  useEffect(() => {
    if (detailIndex !== null && !app.sessions[detailIndex]) {
      setDetailIndex(null);
    }
  }, [app.sessions, detailIndex, setDetailIndex]);

  if (detailIndex !== null) {
    const session = app.sessions[detailIndex];
    if (!session) {
      return null;
    }

    const workout = getWorkoutForSession(session);
    const exercises = getExercisesForWorkout(workout);

    return (
      <Screen>
        <ScreenHeader
          action={<BackButton onClick={() => setDetailIndex(null)} />}
          title={workout?.shortTitle || "Session"}
          titleStyle={{ fontSize: 19, color: workout?.color || "#fff" }}
          subtitle={`${fd(session.date)} · ${fdu(session.duration)} · Energy ${session.energy}/10`}
          topPadding="calc(env(safe-area-inset-top, 0px) + 20px)"
          bottomSpace={8}
        />

        {(session.startedAt || session.finishedAt) && (
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {session.startedAt && <SurfaceCard style={{ flex: 1, textAlign: "center", marginBottom: 0, padding: "10px 12px" }}><p style={{ fontSize: 9, color: "#555", margin: 0, letterSpacing: "0.08em", textTransform: "uppercase" }}>Started</p><p style={{ fontSize: 15, fontWeight: 700, margin: "3px 0 0", color: "#fff" }}>{ft(session.startedAt)}</p></SurfaceCard>}
            {session.finishedAt && <SurfaceCard style={{ flex: 1, textAlign: "center", marginBottom: 0, padding: "10px 12px" }}><p style={{ fontSize: 9, color: "#555", margin: 0, letterSpacing: "0.08em", textTransform: "uppercase" }}>Finished</p><p style={{ fontSize: 15, fontWeight: 700, margin: "3px 0 0", color: "#fff" }}>{ft(session.finishedAt)}</p></SurfaceCard>}
            <SurfaceCard style={{ flex: 1, textAlign: "center", marginBottom: 0, padding: "10px 12px" }}><p style={{ fontSize: 9, color: "#555", margin: 0, letterSpacing: "0.08em", textTransform: "uppercase" }}>Duration</p><p style={{ fontSize: 15, fontWeight: 700, margin: "3px 0 0", color: workout?.color || "#fff" }}>{fdu(session.duration)}</p></SurfaceCard>
          </div>
        )}

        {session.painFlags && typeof session.painFlags.shoulder === "number" && (
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {["shoulder", "ankle", "hip"].map((part) => {
              const value = session.painFlags[part];
              if (!value || value <= 1) {
                return null;
              }
              const color = value <= 2 ? "#45B649" : value <= 3 ? "#F5A623" : "#E84545";
              return <span key={part} style={{ fontSize: 10, background: `${color}22`, color, padding: "3px 8px", borderRadius: 6, textTransform: "capitalize" }}>{part}: {value}/5</span>;
            })}
          </div>
        )}

        {exercises.map((exercise, index) => {
          const sets = (session.sets[`${index}-${exercise.name}`] || []).filter((setData) => setData.kg);
          if (!sets.length) {
            return null;
          }
          return (
            <SurfaceCard key={exercise.name}>
              <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 5px", color: "#fff" }}>{exercise.name}</p>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {sets.map((setData, setIndex) => <span key={setIndex} style={{ fontSize: 11, color: "#aaa", background: "rgba(255,255,255,0.05)", padding: "3px 7px", borderRadius: 6 }}>{setData.kg}kg × {setData.reps || "–"}</span>)}
              </div>
            </SurfaceCard>
          );
        })}

        {session.notes && <SurfaceCard><p style={{ fontSize: 10, color: "#555", margin: "0 0 3px" }}>Notes</p><p style={{ fontSize: 12, color: "#bbb", margin: 0 }}>{session.notes}</p></SurfaceCard>}

        <ActionButton onClick={() => { setApp((current) => ({ ...current, sessions: current.sessions.filter((_, index) => index !== detailIndex) })); setDetailIndex(null); }} tone="danger" compact style={{ marginTop: 16 }}>
          Delete Session
        </ActionButton>
      </Screen>
    );
  }

  if (!app.sessions.length) {
    return <div style={{ padding: "80px 20px", textAlign: "center" }}><p style={{ fontSize: 36 }}>📋</p><p style={{ fontSize: 14, color: "#555" }}>No sessions logged yet.</p></div>;
  }

  return (
    <Screen>
      <ScreenHeader title="History" subtitle={`${app.sessions.length} sessions`} />
      {[...app.sessions].reverse().map((session, reverseIndex) => {
        const sessionIndex = app.sessions.length - 1 - reverseIndex;
        const workout = getWorkoutForSession(session);
        return (
          <SurfaceButton key={`${session.date}-${sessionIndex}`} onClick={() => setDetailIndex(sessionIndex)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: workout?.color || "#fff" }}>{workout?.shortTitle || session.workoutId}</p>
              <p style={{ fontSize: 10, color: "#555", margin: "2px 0 0" }}>{fd(session.date)}{session.startedAt ? ` · ${ft(session.startedAt)}` : ""} · {fdu(session.duration)}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{session.energy}/10</p>
              <p style={{ fontSize: 9, color: "#555", margin: 0 }}>energy</p>
            </div>
          </SurfaceButton>
        );
      })}
    </Screen>
  );
}
