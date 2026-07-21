import { getExercisesForWorkout, getResolvedSet } from "./workouts.js";

// ---------------------------------------------------------------------------
// Per-exercise progression. Deliberately simple, transparent rules — every
// suggestion says exactly why, and the user can always ignore it.

export const PROGRESSION_METHODS = [
  { id: "double", label: "Double progression", hint: "Fill the rep range, then add weight" },
  { id: "fixed", label: "Fixed increments", hint: "Add a set amount each session" },
  { id: "quality", label: "Rep quality", hint: "Hold weight until every set feels controlled" },
  { id: "off", label: "Off", hint: "No suggestions" },
];

export const DEFAULT_INCREMENT_KG = 2.5;
const ACCEPTABLE_RPE = 8.5;

export function getProgressionConfig(app, exerciseName) {
  const stored = app?.exerciseSettings?.[exerciseName] || {};
  return {
    method: PROGRESSION_METHODS.some((method) => method.id === stored.progressionMethod)
      ? stored.progressionMethod
      : "double",
    incrementKg: Number(stored.incrementKg) > 0 ? Number(stored.incrementKg) : DEFAULT_INCREMENT_KG,
  };
}

function parseRepRange(reps) {
  const match = String(reps || "").match(/(\d+)\s*[-–]\s*(\d+)/);
  if (match) return { lo: Number(match[1]), hi: Number(match[2]) };
  const single = Number(String(reps || "").replace(/[^0-9]/g, ""));
  return single > 0 ? { lo: single, hi: single } : { lo: 8, hi: 12 };
}

// Most recent session's working sets for this exercise (matched by name so it
// survives preset reshuffles). Warm-ups are excluded.
export function getLastWorkingSets(app, exercise) {
  const name = exercise?.name;
  if (!name) return null;
  const sessions = [...(app?.sessions || [])].reverse();
  for (const session of sessions) {
    const key = Object.keys(session?.sets || {}).find((candidate) => candidate.endsWith(`-${name}`));
    if (!key) continue;
    const working = (session.sets[key] || [])
      .map((setData) => getResolvedSet(setData, exercise))
      .filter((resolved) => !resolved.warmup)
      .map((resolved) => ({
        kg: Number(resolved.kg || Math.max(Number(resolved.leftKg) || 0, Number(resolved.rightKg) || 0)) || 0,
        reps: Number(resolved.reps ?? Math.min(Number(resolved.leftReps) || 0, Number(resolved.rightReps) || 0)) || 0,
        rpe: resolved.rpe === "" || resolved.rpe === undefined || resolved.rpe === null ? null : Number(resolved.rpe),
      }))
      .filter((set) => set.kg > 0 && set.reps > 0);
    if (working.length) return { sets: working, date: session.date };
  }
  return null;
}

function describeLast(last) {
  const weight = Math.max(...last.sets.map((set) => set.kg));
  const reps = last.sets.map((set) => set.reps).join(", ");
  const rpes = last.sets.map((set) => set.rpe).filter((value) => value !== null && Number.isFinite(value));
  const rpeText = rpes.length ? ` at RPE ${Math.round((rpes.reduce((sum, value) => sum + value, 0) / rpes.length) * 2) / 2}` : "";
  return { weight, text: `${weight}kg × ${reps}${rpeText}`, avgRpe: rpes.length ? rpes.reduce((sum, value) => sum + value, 0) / rpes.length : null };
}

// The suggestion for this exercise's next session. Always returns a `reason`
// in plain language; returns null when progression is off or untrackable.
export function getProgressionSuggestion(app, exercise) {
  if (!exercise?.tracked) return null;
  const { method, incrementKg } = getProgressionConfig(app, exercise.name);
  if (method === "off") return null;

  const range = parseRepRange(exercise.reps);
  const methodLabel = PROGRESSION_METHODS.find((entry) => entry.id === method)?.label || method;
  const last = getLastWorkingSets(app, exercise);

  if (!last) {
    return {
      method,
      methodLabel,
      target: "Establish a baseline",
      reason: `No logged sets yet. Pick a weight you can lift for ${range.lo}–${range.hi} clean reps and log it.`,
    };
  }

  const { weight, text, avgRpe } = describeLast(last);

  if (method === "fixed") {
    const nextWeight = Math.round((weight + incrementKg) * 100) / 100;
    return {
      method,
      methodLabel,
      target: `${nextWeight}kg × ${last.sets.map(() => range.lo).join(", ")}`,
      reason: `Fixed progression adds ${incrementKg}kg each session. Last session: ${text}.`,
    };
  }

  if (method === "quality") {
    const hardSetIndex = last.sets.findIndex((set) => set.rpe !== null && set.rpe > 8);
    if (hardSetIndex >= 0) {
      return {
        method,
        methodLabel,
        target: `${weight}kg × ${last.sets.map((set) => set.reps).join(", ")}`,
        reason: `Set ${hardSetIndex + 1} was RPE ${last.sets[hardSetIndex].rpe} last time. Hold ${weight}kg until every set is ≤ RPE 8 with clean technique.`,
      };
    }
    if (avgRpe === null) {
      return {
        method,
        methodLabel,
        target: `${weight}kg × ${last.sets.map((set) => set.reps).join(", ")}`,
        reason: `Rep-quality progression needs RPE: log it per set. Holding ${weight}kg meanwhile. Last session: ${text}.`,
      };
    }
    return {
      method,
      methodLabel,
      target: `${weight}kg × ${last.sets.map((set) => set.reps).join(", ")} — add ${incrementKg}kg when it feels crisp`,
      reason: `Every set was ≤ RPE 8 last time (${text}). Technique is holding — you've earned the option to add ${incrementKg}kg.`,
    };
  }

  // Double progression (default): fill the rep range on every set, then load.
  const allAtTop = last.sets.every((set) => set.reps >= range.hi);
  const rpeAcceptable = avgRpe === null || avgRpe <= ACCEPTABLE_RPE;

  if (allAtTop && rpeAcceptable) {
    const nextWeight = Math.round((weight + incrementKg) * 100) / 100;
    return {
      method,
      methodLabel,
      target: `${nextWeight}kg × ${last.sets.map(() => range.lo).join(", ")}`,
      reason: `Every set reached ${range.hi} reps${avgRpe !== null ? ` at an acceptable RPE (${text})` : ` (${text})`}. Add ${incrementKg}kg and rebuild from ${range.lo} reps.`,
    };
  }

  if (allAtTop && !rpeAcceptable) {
    return {
      method,
      methodLabel,
      target: `${weight}kg × ${last.sets.map((set) => set.reps).join(", ")}`,
      reason: `All sets hit ${range.hi} reps but the average RPE was above ${ACCEPTABLE_RPE} (${text}). Repeat the weight until it feels easier.`,
    };
  }

  const lowestIndex = last.sets.reduce((lowest, set, index) => (set.reps < last.sets[lowest].reps ? index : lowest), 0);
  const nextReps = last.sets.map((set, index) => (index === lowestIndex ? Math.min(set.reps + 1, range.hi) : set.reps));
  return {
    method,
    methodLabel,
    target: `${weight}kg × ${nextReps.join(", ")}`,
    reason: `Last session: ${text}. Every set must reach ${range.hi} before adding weight — chase one more rep first.`,
  };
}

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
