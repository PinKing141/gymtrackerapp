import { getExercisesForWorkout, getResolvedSet } from "./workouts.js";

const READINESS_QUESTIONS = [
  { key: "sleep", good: 8, okay: 7 },
  { key: "recoveryState", good: 2, okay: 3, invert: true },
  { key: "explosiveness", good: 2, okay: 3, invert: true },
  { key: "jointCondition", good: 2, okay: 3, invert: true },
  { key: "motivationState", good: 2, okay: 3, invert: true },
  { key: "setQuality", good: 2, okay: 3, invert: true },
];

export function getReadinessState(readiness = {}) {
  const normalized = {
    ...readiness,
    recoveryState: readiness.recoveryState ?? (Number(readiness.water) >= 3 ? 2 : 3),
    explosiveness: readiness.explosiveness ?? (readiness.mobilityDone ? 2 : 3),
    jointCondition: readiness.jointCondition ?? 2,
    motivationState: readiness.motivationState ?? 2,
    setQuality: readiness.setQuality ?? 2,
  };
  let score = 0;
  READINESS_QUESTIONS.forEach((item) => {
    const value = Number(normalized[item.key]);
    if (!Number.isFinite(value)) return;
    if (item.invert) {
      score += value <= item.good ? 2 : value <= item.okay ? 1 : 0;
      return;
    }
    score += value >= item.good ? 2 : value >= item.okay ? 1 : 0;
  });

  const maxScore = READINESS_QUESTIONS.length * 2;
  const ratio = maxScore ? score / maxScore : 0;
  if (ratio >= 0.75) return { zone: "green", label: "Green", modifier: 1.03 };
  if (ratio >= 0.5) return { zone: "yellow", label: "Yellow", modifier: 1 };
  return { zone: "red", label: "Red", modifier: 0.94 };
}

function getTopSet(session, exerciseIndex, exercise) {
  const key = `${exerciseIndex}-${exercise.name}`;
  const sets = session?.sets?.[key] || [];
  let top = null;
  sets.forEach((setData) => {
    const resolved = getResolvedSet(setData, exercise);
    const kg = Number(resolved.kg || Math.max(Number(resolved.leftKg) || 0, Number(resolved.rightKg) || 0) || 0);
    if (!top || kg > top) top = kg;
  });
  return top || 0;
}

export function getWorkoutSuggestion(app, workout) {
  if (!workout) return null;
  const lastSession = [...(app?.sessions || [])].reverse().find((entry) => entry.workoutId === workout.id);
  const readiness = getReadinessState(app?.readiness || {});
  const forceDown = readiness.zone === "red";

  const headline = readiness.zone === "green"
    ? "Progress as planned"
    : readiness.zone === "yellow"
      ? "Maintain loads today"
      : "Reduce intensity by ~5%";

  const liftSuggestions = getExercisesForWorkout(workout)
    .filter((exercise) => exercise.tracked)
    .slice(0, 3)
    .map((exercise, index) => {
      const previous = lastSession ? getTopSet(lastSession, index, exercise) : 0;
      if (!previous) return `${exercise.name}: establish baseline`;
      const target = Math.round((previous * readiness.modifier) / 2.5) * 2.5;
      return `${exercise.name}: ${target}kg (${previous}kg last)`;
    });

  return {
    readiness,
    headline,
    forceDown,
    liftSuggestions,
    note: workout.id === "W4"
      ? "Elastic day: prioritize spring, landing quality, and reactivity. Do not chase fatigue."
      : "Progression is quality-first: bar speed, control, pain-free reps, then load.",
  };
}
