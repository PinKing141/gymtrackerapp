import { ExerciseCard, LiveTimer } from "../components/WorkoutComponents.jsx";
import { Icon } from "../components/icons.jsx";
import { PREHAB } from "../data.js";
import { ActionButton, SurfaceButton, SurfaceCard, TextAreaField } from "../components/ui.jsx";
import { colors, radii, typeScale } from "../theme.js";
import { getWorkoutById, isSetComplete, isSetStarted } from "../workouts.js";


function getEnergyLabel(value) {
  if (value >= 8) return "Ready to push";
  if (value >= 6) return "Feeling good";
  if (value >= 4) return "Steady";
  return "Take it easy";
}

function ReadinessDot({ value, selected, onClick }) {
  const dotColor = value <= 2 ? colors.success : value === 3 ? colors.warning : colors.danger;
  return (
    <button
      onClick={onClick}
      aria-label={`Readiness ${value}`}
      style={{
        minWidth: 44,
        minHeight: 36,
        flex: 1,
        borderRadius: radii.pill,
        border: `1px solid ${selected ? dotColor : colors.border}`,
        background: selected ? `${dotColor}24` : "rgba(255,255,255,0.035)",
        color: selected ? dotColor : colors.textMuted,
        cursor: "pointer",
        fontWeight: 800,
      }}
    >
      {value}
    </button>
  );
}

function SectionHeader({ title, subtitle, count }) {
  return (
    <div style={{ margin: "24px 0 10px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
      <div>
        <p style={{ ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase", margin: 0 }}>{title}</p>
        {subtitle && <p style={{ ...typeScale.caption, color: colors.textSecondary, margin: "3px 0 0" }}>{subtitle}</p>}
      </div>
      <span style={{ ...typeScale.caption, color: colors.textMuted }}>{count}</span>
    </div>
  );
}

function ChecklistBlock({ title, iconName, done, open, onToggle, onDone, exercises, color }) {
  return (
    <>
      <SurfaceButton
        onClick={onToggle}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderColor: done ? `${colors.success}55` : colors.border,
          background: done ? `${colors.success}10` : colors.surface,
          borderRadius: radii.lg,
          padding: 14,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ width: 34, height: 34, borderRadius: radii.md, display: "grid", placeItems: "center", background: done ? `${colors.success}1f` : `${color}18` }}>
            <Icon name={iconName} size={16} color={done ? colors.success : color} />
          </span>
          <span>
            <span style={{ ...typeScale.body, display: "block", color: done ? colors.success : colors.textPrimary, fontWeight: 800 }}>{title}</span>
            <span style={{ ...typeScale.caption, color: colors.textMuted }}>{done ? "Complete" : `${exercises.length} movements`}</span>
          </span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 10, color: colors.textMuted }}>
          <span style={{ ...typeScale.caption }}>{done ? `${exercises.length}/${exercises.length}` : `0/${exercises.length}`}</span>
          <span style={{ fontSize: 18, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>›</span>
        </span>
      </SurfaceButton>
      {open && (
        <SurfaceCard style={{ padding: 12, borderRadius: radii.lg, background: colors.surface }}>
          {exercises.map((exercise) => (
            <div key={exercise.name} style={{ minHeight: 44, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", border: `1px solid ${done ? colors.success : colors.borderStrong}`, display: "grid", placeItems: "center", color: colors.success }}>
                {done && <Icon name="check" size={13} color={colors.success} />}
              </span>
              <span style={{ ...typeScale.bodySm, color: colors.textSecondary, flex: 1 }}>{exercise.name}</span>
              <span style={{ ...typeScale.caption, color: colors.textMuted, background: "rgba(255,255,255,0.04)", borderRadius: radii.pill, padding: "4px 8px" }}>{exercise.sets}×{exercise.reps}</span>
            </div>
          ))}
          <ActionButton onClick={onDone} tone="tinted" color={done ? colors.success : color} compact style={{ marginTop: 8 }}>
            {done ? "Done" : "Mark Complete"}
          </ActionButton>
        </SurfaceCard>
      )}
    </>
  );
}

export function LogScreen({ app, expandedExercise, onToggleExercise, prehabOpen, setPrehabOpen, coreOpen, setCoreOpen, session, sessionNotice, setSession, workoutId, onUpdateSet, onFinishWorkout, onCancelWorkout }) {
  if (!session || !workoutId) {
    return null;
  }

  const workout = session.workoutSnapshot || getWorkoutById(workoutId, app.workoutPresets);
  if (!workout) {
    return null;
  }
  const previousSession = [...app.sessions].reverse().find((entry) => entry.workoutId === workoutId);
  const allExercises = [...workout.performance, ...(workout.finisher || [])];
  const completedExercises = allExercises.filter((exercise, index) => {
    const exerciseKey = `${index}-${exercise.name}`;
    const exerciseSets = session.sets[exerciseKey] || [];
    return exerciseSets.length > 0 && exerciseSets.filter((setData) => isSetComplete(setData, exercise)).length >= exercise.sets;
  }).length;
  const startedSetCount = allExercises.reduce((total, exercise, index) => {
    const exerciseKey = `${index}-${exercise.name}`;
    return total + (session.sets[exerciseKey] || []).filter((setData) => isSetStarted(setData, exercise)).length;
  }, 0);
  const hasStartedLogging = startedSetCount > 0 || session.timer.startedAt;

  return (
    <div>
      <LiveTimer
        color={workout.color}
        timerState={session.timer}
        onUpdate={(timer) => setSession((current) => ({ ...current, timer }))}
        title={workout.shortTitle}
        onCancel={onCancelWorkout}
        completedExercises={completedExercises}
        totalExercises={allExercises.length}
      />
      <div style={{ padding: "12px 16px 0" }}>
        {sessionNotice && (
          <div style={{ marginBottom: 12, padding: "9px 12px", borderRadius: radii.md, background: `${colors.accent}14`, color: colors.textSecondary, display: "flex", alignItems: "center", gap: 8, ...typeScale.caption }}>
            <Icon name="save" size={13} color={colors.accent} />
            {sessionNotice}
          </div>
        )}

        <SurfaceCard style={{ display: hasStartedLogging ? "none" : "block", borderRadius: radii.lg, background: colors.surface }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ ...typeScale.body, color: colors.textPrimary, fontWeight: 800 }}>Before you start</span>
            <span style={{ marginLeft: "auto", ...typeScale.caption, color: workout.color, fontWeight: 800 }}>{session.energy} · {getEnergyLabel(session.energy)}</span>
          </div>
          <input type="range" min="1" max="10" value={session.energy} onChange={(event) => setSession((current) => ({ ...current, energy: Number(event.target.value) }))} style={{ width: "100%", accentColor: workout.color }} />
          <div style={{ marginTop: 14 }}>
            <p style={{ ...typeScale.overline, color: colors.textMuted, margin: "0 0 8px", textTransform: "uppercase" }}>Readiness <span style={{ float: "right", color: colors.textMuted, fontWeight: 600 }}>Fine → Bad</span></p>
          {["shoulder", "ankle", "hip"].map((part) => (
            <div key={part} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ ...typeScale.bodySm, color: colors.textSecondary, width: 68, textTransform: "capitalize" }}>{part}</span>
              <div style={{ display: "flex", gap: 6, flex: 1 }}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <ReadinessDot
                    key={value}
                    value={value}
                    selected={session.painFlags[part] === value}
                    onClick={() => setSession((current) => ({ ...current, painFlags: { ...current.painFlags, [part]: value } }))}
                  />
                ))}
              </div>
            </div>
          ))}
          </div>
        </SurfaceCard>

        {hasStartedLogging && (
          <div style={{ marginBottom: 12, display: "inline-flex", gap: 8, padding: "7px 10px", borderRadius: radii.pill, border: `1px solid ${colors.border}`, color: colors.textSecondary, background: "rgba(255,255,255,0.035)", ...typeScale.caption }}>Energy {session.energy} · {Object.values(session.painFlags).some((value) => value >= 4) ? "Pain flag" : "No pain flags"}</div>
        )}

        <ChecklistBlock
          title="Warm-up · 15 min"
          iconName="pulse"
          done={session.prehabDone}
          open={prehabOpen}
          onToggle={() => setPrehabOpen((open) => !open)}
          onDone={() => setSession((current) => ({ ...current, prehabDone: true }))}
          exercises={PREHAB}
          color={workout.color}
        />

        <SectionHeader title="Main work" subtitle="Performance Block" count={`${workout.performance.length} exercises`} />
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
            <SectionHeader title="Finisher" subtitle="Aesthetic Finisher" count={`${workout.finisher.length} exercises`} />
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
          <ChecklistBlock
            title={workout.core.title}
            iconName="dumbbell"
            done={session.coreDone}
            open={coreOpen}
            onToggle={() => setCoreOpen((open) => !open)}
            onDone={() => setSession((current) => ({ ...current, coreDone: true }))}
            exercises={workout.core.exercises}
            color={workout.color}
          />
        )}

        <TextAreaField placeholder="Session notes..." value={session.notes} onChange={(event) => setSession((current) => ({ ...current, notes: event.target.value }))} style={{ marginTop: 14, minHeight: 50, color: colors.textSecondary, background: colors.surface }} />
        <div style={{ position: "sticky", bottom: 0, zIndex: 40, margin: "14px -16px 0", padding: "10px 16px max(10px, env(safe-area-inset-bottom, 0px))", background: "rgba(10,10,15,0.92)", backdropFilter: "blur(16px)", borderTop: `1px solid ${colors.border}`, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <p style={{ ...typeScale.bodySm, color: colors.textPrimary, fontWeight: 800, margin: 0 }}>{completedExercises}/{allExercises.length} exercises</p>
            <p style={{ ...typeScale.caption, color: colors.textMuted, margin: "2px 0 0" }}>{startedSetCount} sets logged</p>
          </div>
          <ActionButton onClick={onFinishWorkout} color={colors.success} fullWidth={false} style={{ minWidth: 132, borderRadius: radii.pill }}>
            Finish
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
