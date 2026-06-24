import { ExerciseCard, LiveTimer } from "../components/WorkoutComponents.jsx";
import { Icon } from "../components/icons.jsx";
import { PREHAB } from "../data.js";
import { BB, C, L, fd } from "../storage.js";
import { ActionButton, BackButton, SurfaceButton, SurfaceCard, TextAreaField } from "../components/ui.jsx";
import { getWorkoutById } from "../workouts.js";

export function LogScreen({ app, expandedExercise, onToggleExercise, prehabOpen, setPrehabOpen, coreOpen, setCoreOpen, session, sessionNotice, setSession, workoutId, onUpdateSet, onFinishWorkout, onCancelWorkout }) {
  if (!session || !workoutId) {
    return null;
  }

  const workout = session.workoutSnapshot || getWorkoutById(workoutId, app.workoutPresets);
  if (!workout) {
    return null;
  }
  const previousSession = [...app.sessions].reverse().find((entry) => entry.workoutId === workoutId);

  return (
    <div>
      <LiveTimer color={workout.color} timerState={session.timer} onUpdate={(timer) => setSession((current) => ({ ...current, timer }))} />
      <div style={{ padding: "0 16px" }}>
        <div style={{ paddingTop: 12, marginBottom: 16 }}>
          <BackButton onClick={onCancelWorkout} label="Cancel" />
          <h2 style={{ fontSize: 21, fontWeight: 700, margin: 0, color: workout.color }}>{workout.shortTitle}</h2>
          <p style={{ fontSize: 11, color: "#555", margin: "2px 0 0" }}>{fd(session.date)}</p>
          {sessionNotice && (
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "#8BA6C9", display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="save" size={13} color="#8BA6C9" />
              {sessionNotice}
            </p>
          )}
        </div>

        <SurfaceCard style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: "#666" }}>Energy</span>
          <input type="range" min="1" max="10" value={session.energy} onChange={(event) => setSession((current) => ({ ...current, energy: Number(event.target.value) }))} style={{ flex: 1, accentColor: workout.color }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: workout.color, minWidth: 22, textAlign: "right" }}>{session.energy}</span>
        </SurfaceCard>

        <SurfaceCard style={{ padding: "10px 14px" }}>
          <p style={{ fontSize: 10, color: "#555", margin: "0 0 8px", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>Injury Check (1=fine, 5=bad)</p>
          {["shoulder", "ankle", "hip"].map((part) => (
            <div key={part} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "#999", width: 64, textTransform: "capitalize" }}>{part}</span>
              <div style={{ display: "flex", gap: 4, flex: 1 }}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    onClick={() => setSession((current) => ({ ...current, painFlags: { ...current.painFlags, [part]: value } }))}
                    style={{
                      flex: 1,
                      padding: "7px 0",
                      borderRadius: 7,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700,
                      background: session.painFlags[part] === value
                        ? value <= 2
                          ? "rgba(69,182,73,0.2)"
                          : value <= 3
                            ? "rgba(245,166,35,0.2)"
                            : "rgba(232,69,69,0.2)"
                        : "rgba(255,255,255,0.04)",
                      color: session.painFlags[part] === value
                        ? value <= 2
                          ? "#45B649"
                          : value <= 3
                            ? "#F5A623"
                            : "#E84545"
                        : "#555",
                    }}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </SurfaceCard>

        <SurfaceButton onClick={() => setPrehabOpen((open) => !open)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderColor: session.prehabDone ? "rgba(69,182,73,0.2)" : "rgba(255,255,255,0.06)", background: session.prehabDone ? "rgba(69,182,73,0.05)" : C.background }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: session.prehabDone ? "#45B649" : "#fff", display: "flex", alignItems: "center", gap: 6 }}>{session.prehabDone && <Icon name="check" size={13} color="#45B649" />}Prehab Block — 15 min</span>
          <span style={{ color: "#555", fontSize: 16, transform: prehabOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>›</span>
        </SurfaceButton>
        {prehabOpen && (
          <SurfaceCard style={{ padding: "8px 12px" }}>
            {PREHAB.map((exercise, index) => (
              <div key={exercise.name} style={{ padding: "5px 0", borderBottom: index < PREHAB.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
                <p style={{ fontSize: 12, margin: 0, color: "#bbb" }}>{exercise.name}</p>
                <p style={{ fontSize: 10, color: "#555", margin: "1px 0 0" }}>{exercise.sets}×{exercise.reps}</p>
              </div>
            ))}
            <ActionButton onClick={() => setSession((current) => ({ ...current, prehabDone: true }))} tone={session.prehabDone ? "tinted" : "primary"} color={session.prehabDone ? "#45B649" : workout.color} compact style={{ marginTop: 8 }}>
                  {session.prehabDone ? "Done" : "Mark Complete"}
            </ActionButton>
          </SurfaceCard>
        )}

        <p style={L}>Performance Block</p>
        {workout.performance.map((exercise, index) => {
          const exerciseKey = `${index}-${exercise.name}`;
          return (
            <ExerciseCard
              key={exerciseKey}
              exercise={exercise}
              exerciseKey={exerciseKey}
              sets={session.sets[exerciseKey] || []}
              isOpen={expandedExercise === exerciseKey}
              onToggle={(key) => onToggleExercise(expandedExercise === key ? null : key)}
              onSet={onUpdateSet}
              color={workout.color}
              previousSets={previousSession?.sets?.[exerciseKey]}
            />
          );
        })}

        {workout.finisher.length > 0 && (
          <>
            <p style={L}>Aesthetic Finisher</p>
            {workout.finisher.map((exercise, index) => {
              const exerciseIndex = workout.performance.length + index;
              const exerciseKey = `${exerciseIndex}-${exercise.name}`;
              return (
                <ExerciseCard
                  key={exerciseKey}
                  exercise={exercise}
                  exerciseKey={exerciseKey}
                  sets={session.sets[exerciseKey] || []}
                  isOpen={expandedExercise === exerciseKey}
                  onToggle={(key) => onToggleExercise(expandedExercise === key ? null : key)}
                  onSet={onUpdateSet}
                  color={workout.color}
                  previousSets={previousSession?.sets?.[exerciseKey]}
                />
              );
            })}
          </>
        )}

        {workout.core && (
          <>
            <SurfaceButton onClick={() => setCoreOpen((open) => !open)} style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center", borderColor: session.coreDone ? "rgba(69,182,73,0.2)" : "rgba(255,255,255,0.06)", background: session.coreDone ? "rgba(69,182,73,0.05)" : C.background }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: session.coreDone ? "#45B649" : "#fff", display: "flex", alignItems: "center", gap: 6 }}>{session.coreDone && <Icon name="check" size={13} color="#45B649" />}{workout.core.title}</span>
              <span style={{ color: "#555", fontSize: 16, transform: coreOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>›</span>
            </SurfaceButton>
            {coreOpen && (
              <SurfaceCard style={{ padding: "8px 12px" }}>
                {workout.core.exercises.map((exercise, index) => (
                  <div key={exercise.name} style={{ padding: "5px 0", borderBottom: index < workout.core.exercises.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
                    <p style={{ fontSize: 12, margin: 0, color: "#bbb" }}>{exercise.name}</p>
                    <p style={{ fontSize: 10, color: "#555", margin: "1px 0 0" }}>{exercise.sets}×{exercise.reps}</p>
                  </div>
                ))}
                <ActionButton onClick={() => setSession((current) => ({ ...current, coreDone: true }))} tone={session.coreDone ? "tinted" : "primary"} color={session.coreDone ? "#45B649" : workout.color} compact style={{ marginTop: 8 }}>
                  {session.coreDone ? "Done" : "Mark Complete"}
                </ActionButton>
              </SurfaceCard>
            )}
          </>
        )}

        <TextAreaField placeholder="Session notes..." value={session.notes} onChange={(event) => setSession((current) => ({ ...current, notes: event.target.value }))} style={{ marginTop: 14, minHeight: 50, color: "#bbb", background: "rgba(255,255,255,0.03)" }} />
        <ActionButton onClick={onFinishWorkout} color={workout.color} style={{ marginTop: 14, marginBottom: 40, padding: "15px", borderRadius: 14, background: `linear-gradient(135deg,${workout.color},${workout.color}cc)`, boxShadow: `0 4px 20px ${workout.color}44` }}>
          Finish Session
        </ActionButton>
      </div>
    </div>
  );
}
