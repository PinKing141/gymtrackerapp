import { WORKOUTS } from "./data.js";

const PRESET_RENAMES = {
  W1: { title: "Orion Preset - Upper Strength + Power", shortTitle: "Orion Upper Power" },
  W2: { title: "Orion Preset - Lower Force + Braking", shortTitle: "Orion Lower Force" },
  W3: { title: "Orion Preset - Upper Structure + Aesthetics", shortTitle: "Orion Upper Structure" },
  W4: { title: "Orion Preset - Lower Elasticity + Reactivity", shortTitle: "Orion Lower Elasticity" },
};
const PRESET_COLORS = ["#E84545", "#2D7DD2", "#F5A623", "#45B649", "#8B5CF6", "#14B8A6"];
const cloneExercises = (exercises = []) => exercises.map((exercise) => ({
  ...exercise,
  libraryMeta: exercise.libraryMeta ? { ...exercise.libraryMeta } : undefined,
}));
const SIDE_PATTERN = /(?:\/\s*|\bper\s+)(side|leg|arm)\b/i;
const DURATION_PATTERN = /\b(sec|min|seconds?|minutes?)\b/i;
const DISTANCE_PATTERN = /^\s*\d+(\.\d+)?\s*(m|meters?)\s*$/i;

function hasValue(value) {
  return value !== "" && value !== null && value !== undefined;
}

function isDumbbellType(type = "") {
  return /dumbbell/i.test(type);
}

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function formatRestLabel(seconds) {
  const normalized = Math.max(0, toPositiveInteger(seconds, 0));
  if (!normalized) {
    return "Full";
  }
  if (normalized % 60 === 0) {
    return `${normalized / 60} min`;
  }
  return `${normalized} sec`;
}

export function normalizeWorkoutExercise(exercise = {}) {
  const rest = Math.max(0, toPositiveInteger(exercise.rest, 60));
  return {
    exerciseId: exercise.exerciseId || exercise.id || null,
    name: String(exercise.name || "Untitled Exercise").trim(),
    type: String(exercise.type || "Exercise").trim(),
    sets: toPositiveInteger(exercise.sets, 3),
    reps: String(exercise.reps || "10").trim(),
    rest,
    restLabel: exercise.restLabel || formatRestLabel(rest),
    tracked: Boolean(exercise.tracked),
    libraryMeta: exercise.libraryMeta ? { ...exercise.libraryMeta } : undefined,
  };
}

export function normalizeWorkoutPreset(workout = {}, index = 0) {
  const id = String(workout.id || `P${index + 1}`).trim();
  const title = String(workout.title || workout.shortTitle || "Custom Workout").trim();
  const performance = Array.isArray(workout.performance) ? workout.performance.map(normalizeWorkoutExercise) : [];
  const finisher = Array.isArray(workout.finisher) ? workout.finisher.map(normalizeWorkoutExercise) : [];
  const coreExercises = Array.isArray(workout.core?.exercises) ? workout.core.exercises.map(normalizeWorkoutExercise) : [];

  return {
    id,
    title,
    shortTitle: String(workout.shortTitle || title).trim(),
    day: String(workout.day || (workout.source === "custom" ? "Custom" : "Preset")).trim(),
    goal: String(workout.goal || "Personal preset").trim(),
    color: workout.color || PRESET_COLORS[index % PRESET_COLORS.length],
    source: workout.source || "custom",
    createdAt: workout.createdAt || null,
    updatedAt: workout.updatedAt || null,
    performance,
    finisher,
    core: coreExercises.length
      ? {
          title: workout.core?.title || "Core Block",
          exercises: coreExercises,
        }
      : null,
  };
}

export function getDefaultWorkoutPresets() {
  return Object.values(WORKOUTS).map((workout, index) => normalizeWorkoutPreset({
    ...workout,
    ...PRESET_RENAMES[workout.id],
    day: "Preset",
    source: "builtin",
  }, index));
}

export function normalizeWorkoutPresetList(presets) {
  // Presets are entirely user-owned now: a fresh account starts with an empty
  // list and only the workouts the user builds show up. No built-in Orion
  // presets are auto-injected.
  if (!Array.isArray(presets)) {
    return [];
  }
  return presets.map((preset, index) => normalizeWorkoutPreset(preset, index));
}

export function getWorkoutPresets(appOrPresets) {
  const presets = Array.isArray(appOrPresets) ? appOrPresets : appOrPresets?.workoutPresets;
  return normalizeWorkoutPresetList(presets);
}

function isPairedLoadExercise(exercise) {
  if (!exercise) {
    return false;
  }

  return /farmer\s*carr(y|ies)/i.test(exercise.name || "") || (isDumbbellType(exercise.type) && (SIDE_PATTERN.test(exercise.reps || "") || /single arm|single leg/i.test(exercise.name)));
}

export function getExerciseTrackingMode(exercise) {
  const reps = exercise?.reps || "";
  const metricMode = DURATION_PATTERN.test(reps)
    ? "duration"
    : DISTANCE_PATTERN.test(reps) || /\bsteps\b/i.test(reps)
      ? "distance"
      : "reps";
  const perSideMetric = SIDE_PATTERN.test(reps);
  const loadMode = isPairedLoadExercise(exercise)
    ? "paired"
    : exercise?.tracked
      ? "single"
      : "none";

  return {
    loadMode,
    metricMode,
    perSideMetric,
  };
}

export function createEmptySet(exercise) {
  const { loadMode, metricMode, perSideMetric } = getExerciseTrackingMode(exercise);
  return {
    kg: "",
    leftKg: loadMode === "paired" ? "" : undefined,
    rightKg: loadMode === "paired" ? "" : undefined,
    reps: metricMode === "reps" && !perSideMetric ? "" : undefined,
    leftReps: metricMode === "reps" && perSideMetric ? "" : undefined,
    rightReps: metricMode === "reps" && perSideMetric ? "" : undefined,
    duration: metricMode === "duration" && !perSideMetric ? "" : undefined,
    leftDuration: metricMode === "duration" && perSideMetric ? "" : undefined,
    rightDuration: metricMode === "duration" && perSideMetric ? "" : undefined,
    distance: metricMode === "distance" ? "" : undefined,
  };
}

function getMetricFieldNames(exercise) {
  const { metricMode, perSideMetric } = getExerciseTrackingMode(exercise);
  if (metricMode === "distance") {
    return ["distance"];
  }
  if (!perSideMetric) {
    return [metricMode];
  }
  const prefix = metricMode === "duration" ? "Duration" : "Reps";
  return [`left${prefix}`, `right${prefix}`];
}

function adaptLegacySet(setData, exercise) {
  const mode = getExerciseTrackingMode(exercise);
  const next = { ...createEmptySet(exercise), ...setData };

  if (mode.loadMode === "paired" && hasValue(setData?.kg)) {
    next.leftKg = hasValue(setData.leftKg) ? setData.leftKg : setData.kg;
    next.rightKg = hasValue(setData.rightKg) ? setData.rightKg : setData.kg;
  }

  if (mode.metricMode === "distance" && hasValue(setData?.reps) && !hasValue(setData?.distance)) {
    next.distance = setData.reps;
  }

  if (mode.metricMode === "duration") {
    if (mode.perSideMetric && hasValue(setData?.reps)) {
      next.leftDuration = hasValue(setData.leftDuration) ? setData.leftDuration : setData.reps;
      next.rightDuration = hasValue(setData.rightDuration) ? setData.rightDuration : setData.reps;
    }
    if (!mode.perSideMetric && hasValue(setData?.reps) && !hasValue(setData?.duration)) {
      next.duration = setData.reps;
    }
  }

  if (mode.metricMode === "reps" && mode.perSideMetric && hasValue(setData?.reps)) {
    next.leftReps = hasValue(setData.leftReps) ? setData.leftReps : setData.reps;
    next.rightReps = hasValue(setData.rightReps) ? setData.rightReps : setData.reps;
  }

  return next;
}

export function migrateSessionSetData(setData, exercise) {
  if (!setData || !exercise) {
    return setData;
  }
  return adaptLegacySet(setData, exercise);
}

export function getResolvedSet(setData, exercise) {
  if (!setData) {
    return createEmptySet(exercise);
  }
  return adaptLegacySet(setData, exercise);
}

export function isSetStarted(setData, exercise) {
  const resolved = getResolvedSet(setData, exercise);
  const metricFields = getMetricFieldNames(exercise);
  const loadStarted = hasValue(resolved.kg) || hasValue(resolved.leftKg) || hasValue(resolved.rightKg);
  return loadStarted || metricFields.some((field) => hasValue(resolved[field]));
}

export function isSetComplete(setData, exercise) {
  const resolved = getResolvedSet(setData, exercise);
  const { loadMode } = getExerciseTrackingMode(exercise);
  const metricFields = getMetricFieldNames(exercise);
  const loadReady = loadMode === "none"
    ? true
    : loadMode === "paired"
      ? hasValue(resolved.leftKg) && hasValue(resolved.rightKg)
      : hasValue(resolved.kg);

  return loadReady && metricFields.every((field) => hasValue(resolved[field]));
}

export function getExerciseInputConfig(exercise) {
  const { loadMode, metricMode, perSideMetric } = getExerciseTrackingMode(exercise);
  return {
    loadMode,
    metricMode,
    perSideMetric,
    metricLabel: metricMode === "duration" ? "SEC" : metricMode === "distance" ? "M" : "REPS",
    metricPlaceholder: metricMode === "duration"
      ? "0"
      : metricMode === "distance"
        ? String((exercise?.reps || "").replace(/[^0-9.]/g, "") || "0")
        : String((exercise?.reps || "").replace(/[^0-9]/g, "") || "0"),
  };
}

export function getRecordWeight(setData, exercise) {
  const resolved = getResolvedSet(setData, exercise);
  const { loadMode } = getExerciseTrackingMode(exercise);
  if (loadMode === "paired") {
    return Math.max(Number(resolved.leftKg) || 0, Number(resolved.rightKg) || 0);
  }
  return Number(resolved.kg) || 0;
}

function getMetricComparisonValue(resolved, exercise) {
  const { metricMode, perSideMetric } = getExerciseTrackingMode(exercise);
  const metricField = metricMode === "distance" ? "distance" : metricMode;

  if (!perSideMetric) {
    return Number(resolved[metricField]) || 0;
  }

  if (metricMode === "duration") {
    const left = Number(resolved.leftDuration) || 0;
    const right = Number(resolved.rightDuration) || 0;
    return Math.min(left || right, right || left);
  }

  const left = Number(resolved.leftReps) || 0;
  const right = Number(resolved.rightReps) || 0;
  return Math.min(left || right, right || left);
}

export function getExerciseRecordCandidate(setData, exercise) {
  const resolved = getResolvedSet(setData, exercise);
  if (!isSetComplete(resolved, exercise)) {
    return null;
  }

  const { metricMode } = getExerciseTrackingMode(exercise);
  const weight = getRecordWeight(resolved, exercise);
  if (weight > 0) {
    return {
      value: weight,
      unit: "kg",
      summary: getSetSummary(resolved, exercise),
      reps: resolved.reps || null,
    };
  }

  const metricValue = getMetricComparisonValue(resolved, exercise);
  if (metricValue <= 0) {
    return null;
  }

  return {
    value: metricValue,
    unit: metricMode === "duration" ? "sec" : metricMode === "distance" ? "m" : "reps",
    summary: getSetSummary(resolved, exercise),
    reps: resolved.reps || null,
  };
}

export function getSetSummary(setData, exercise) {
  const resolved = getResolvedSet(setData, exercise);
  const { loadMode, metricMode, perSideMetric } = getExerciseTrackingMode(exercise);
  const metricUnit = metricMode === "duration" ? "s" : metricMode === "distance" ? "m" : "";

  if (!isSetStarted(resolved, exercise)) {
    return "";
  }

  if (loadMode === "paired" && perSideMetric) {
    return `L${resolved.leftKg || "–"}kg × ${resolved.leftReps || resolved.leftDuration || "–"}${metricUnit} · R${resolved.rightKg || "–"}kg × ${resolved.rightReps || resolved.rightDuration || "–"}${metricUnit}`;
  }

  if (loadMode === "paired") {
    return `L${resolved.leftKg || "–"}kg · R${resolved.rightKg || "–"}kg · ${resolved.distance || "–"}${metricUnit}`;
  }

  if (perSideMetric) {
    const prefix = metricMode === "duration" ? "Duration" : "Reps";
    const leftMetric = resolved[`left${prefix}`];
    const rightMetric = resolved[`right${prefix}`];
    if (loadMode === "single") {
      return `${resolved.kg || "–"}kg · L${leftMetric || "–"}${metricUnit} · R${rightMetric || "–"}${metricUnit}`;
    }
    return `L${leftMetric || "–"}${metricUnit} · R${rightMetric || "–"}${metricUnit}`;
  }

  const metricField = metricMode === "distance" ? "distance" : metricMode;
  const metricValue = resolved[metricField] || "–";
  if (loadMode === "single") {
    return metricMode === "distance"
      ? `${resolved.kg || "–"}kg · ${metricValue}${metricUnit}`
      : `${resolved.kg || "–"}kg × ${metricValue}${metricUnit}`;
  }
  return `${metricValue}${metricUnit}`;
}

export function createWorkoutSnapshot(workout) {
  if (!workout) {
    return null;
  }

  const normalized = normalizeWorkoutPreset(workout);
  return {
    id: normalized.id,
    title: normalized.title,
    shortTitle: normalized.shortTitle,
    day: normalized.day,
    goal: normalized.goal,
    color: normalized.color,
    source: normalized.source,
    performance: cloneExercises(normalized.performance),
    finisher: cloneExercises(normalized.finisher),
    core: normalized.core
      ? {
          title: normalized.core.title,
          exercises: cloneExercises(normalized.core.exercises),
        }
      : null,
  };
}

export function getWorkoutById(workoutId, workoutPresets = null) {
  const savedPreset = Array.isArray(workoutPresets) ? workoutPresets.find((workout) => workout.id === workoutId) : null;
  return savedPreset || WORKOUTS[workoutId] || null;
}

export function getWorkoutForSession(session) {
  if (!session) {
    return null;
  }
  return session.workoutSnapshot || getWorkoutById(session.workoutId);
}

export function getExercisesForWorkout(workout) {
  if (!workout) {
    return [];
  }
  return [...(workout.performance || []), ...(workout.finisher || [])];
}
