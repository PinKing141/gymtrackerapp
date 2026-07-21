import { useEffect, useState } from "react";
import { Icon } from "../components/icons.jsx";
import { IS, fd, ft, fdu } from "../storage.js";
import { getExercisesForWorkout, getResolvedSet, getSetSummary, getWorkoutForSession, isSetStarted, recomputePersonalBests } from "../workouts.js";
import { ActionButton, BackButton, Screen, ScreenHeader, SurfaceButton, SurfaceCard } from "../components/ui.jsx";

const EDITABLE_FIELDS = [
  { field: "kg", label: "kg" },
  { field: "leftKg", label: "L kg" },
  { field: "rightKg", label: "R kg" },
  { field: "reps", label: "reps" },
  { field: "leftReps", label: "L reps" },
  { field: "rightReps", label: "R reps" },
  { field: "duration", label: "sec" },
  { field: "leftDuration", label: "L sec" },
  { field: "rightDuration", label: "R sec" },
  { field: "distance", label: "m" },
  { field: "rpe", label: "RPE" },
];

export function HistoryScreen({ app, detailIndex, setDetailIndex, setApp }) {
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (detailIndex !== null && !app.sessions[detailIndex]) {
      setDetailIndex(null);
    }
  }, [app.sessions, detailIndex, setDetailIndex]);

  useEffect(() => {
    setEditing(false);
  }, [detailIndex]);

  if (detailIndex !== null) {
    const session = app.sessions[detailIndex];
    if (!session) {
      return null;
    }

    const workout = getWorkoutForSession(session);
    const exercises = getExercisesForWorkout(workout);

    // Correct a logged value without deleting the whole workout. Personal
    // bests are rebuilt from all sessions so corrections propagate.
    const editSet = (exerciseKey, setIndex, field, value) => {
      setApp((current) => {
        const sessions = current.sessions.map((entry, index) => {
          if (index !== detailIndex) return entry;
          const exerciseSets = [...(entry.sets[exerciseKey] || [])];
          exerciseSets[setIndex] = { ...exerciseSets[setIndex], [field]: value };
          return { ...entry, sets: { ...entry.sets, [exerciseKey]: exerciseSets } };
        });
        return { ...current, sessions, personalBests: recomputePersonalBests(sessions) };
      });
    };

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

        <ActionButton
          compact
          tone={editing ? "tinted" : "secondary"}
          color="#2D7DD2"
          onClick={() => setEditing((current) => !current)}
          style={{ marginBottom: 12 }}
        >
          {editing ? "Done editing" : "Edit logged sets"}
        </ActionButton>

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
          const exerciseKey = `${index}-${exercise.name}`;
          const allSets = session.sets[exerciseKey] || [];
          const startedIndexes = allSets
            .map((setData, setIndex) => ({ setData, setIndex }))
            .filter(({ setData }) => isSetStarted(setData, exercise));
          if (!startedIndexes.length) {
            return null;
          }
          return (
            <SurfaceCard key={exercise.name}>
              <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 5px", color: "#fff" }}>
                {exercise.name}
                {exercise.substitutedFrom && <span style={{ fontSize: 10, color: "#F5A623", fontWeight: 600 }}> · swapped from {exercise.substitutedFrom}</span>}
              </p>
              {!editing && (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {startedIndexes.map(({ setData, setIndex }) => (
                    <span key={setIndex} style={{ fontSize: 11, color: setData.warmup ? "#C9A15A" : "#aaa", background: "rgba(255,255,255,0.05)", padding: "3px 7px", borderRadius: 6 }}>
                      {getSetSummary(setData, exercise) || "–"}
                    </span>
                  ))}
                </div>
              )}
              {editing && (
                <div style={{ display: "grid", gap: 6 }}>
                  {startedIndexes.map(({ setData, setIndex }) => {
                    const resolved = getResolvedSet(setData, exercise);
                    const fields = EDITABLE_FIELDS.filter(({ field }) => resolved[field] !== undefined);
                    return (
                      <div key={setIndex} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: resolved.warmup ? "#F5A623" : "#8A8F9C", width: 24 }}>
                          {resolved.warmup ? "W" : `#${setIndex + 1}`}
                        </span>
                        {fields.map(({ field, label }) => (
                          <label key={field} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <input
                              type="number"
                              inputMode="decimal"
                              value={resolved[field] ?? ""}
                              onChange={(event) => editSet(exerciseKey, setIndex, field, event.target.value)}
                              style={{ ...IS, width: 58, padding: "6px 7px", fontSize: 13 }}
                            />
                            <span style={{ fontSize: 9, color: "#666" }}>{label}</span>
                          </label>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
              {session.exerciseNotes?.[exerciseKey] && (
                <p style={{ fontSize: 11, color: "#8BA6C9", margin: "6px 0 0" }}>✎ {session.exerciseNotes[exerciseKey]}</p>
              )}
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

  const cardioSessions = Array.isArray(app.cardioSessions) ? app.cardioSessions : [];

  if (!app.sessions.length && !cardioSessions.length) {
    return (
      <div style={{ padding: "80px 20px", textAlign: "center" }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, margin: "0 auto 10px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <Icon name="clipboard" size={24} color="#777" />
        </div>
        <p style={{ fontSize: 14, color: "#555" }}>No sessions logged yet.</p>
      </div>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="History" subtitle={`${app.sessions.length} workout${app.sessions.length === 1 ? "" : "s"}${cardioSessions.length ? ` · ${cardioSessions.length} cardio` : ""}`} />
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

      {cardioSessions.length > 0 && (
        <>
          <p style={{ fontSize: 11, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, margin: "22px 0 10px" }}>Cardio</p>
          {cardioSessions.map((entry) => (
            <SurfaceCard key={entry.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: "#fff" }}>{entry.type} · {entry.durationMin} min</p>
                <p style={{ fontSize: 10, color: "#555", margin: "2px 0 0" }}>{fd(entry.date)}{entry.distance ? ` · ${entry.distance} km` : ""}</p>
              </div>
              {entry.effort ? <span style={{ fontSize: 11, color: "#8A8F9C" }}>effort {entry.effort}/10</span> : null}
            </SurfaceCard>
          ))}
        </>
      )}
    </Screen>
  );
}
