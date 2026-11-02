// Pure helpers for building, finishing and scoring a gym workout session.
// Kept out of the app-state hook so they can be tested on their own.
import { today } from "./storage.js";
import {
  createEmptySet,
  createWorkoutSnapshot,
  getExerciseRecordCandidate,
  getExercisesForWorkout,
  getWorkoutById,
} from "./workouts.js";

export function createWorkoutSession(workoutId, workoutPresets) {
  const workout = getWorkoutById(workoutId, workoutPresets);
  if (!workout) {
    return null;
  }

  const sets = {};
  getExercisesForWorkout(workout).forEach((exercise, index) => {
    sets[`${index}-${exercise.name}`] = Array.from({ length: exercise.sets }, () => createEmptySet(exercise));
  });

  return {
    workoutId,
    workoutSnapshot: createWorkoutSnapshot(workout),
    date: today(),
    energy: 7,
    sets,
    prehabDone: false,
    coreDone: false,
    notes: "",
    exerciseNotes: {},
    substitutions: {},
    painFlags: { shoulder: 1, ankle: 1, hip: 1 },
    timer: { running: false, startedAt: null, lastResumedAt: null, accumulated: 0 },
  };
}

// Apply this session's exercise substitutions into its snapshot (and re-key the
// logged sets to match), so history and personal bests credit the movement the
// athlete actually performed instead of the one originally planned.
export function applySubstitutionsToSession(finishedSession, substitutions) {
  const snapshot = finishedSession.workoutSnapshot;
  if (!snapshot || !substitutions || !Object.keys(substitutions).length) {
    return finishedSession;
  }

  const performance = snapshot.performance || [];
  const finisher = snapshot.finisher || [];
  const sets = { ...finishedSession.sets };

  const renameList = (list, indexOffset) => list.map((exercise, listIndex) => {
    const index = indexOffset + listIndex;
    const key = `${index}-${exercise.name}`;
    const newName = substitutions[key];
    if (!newName || newName === exercise.name) {
      return exercise;
    }
    if (sets[key]) {
      sets[`${index}-${newName}`] = sets[key];
      delete sets[key];
    }
    return { ...exercise, name: newName, substitutedFrom: exercise.name };
  });

  return {
    ...finishedSession,
    sets,
    workoutSnapshot: {
      ...snapshot,
      performance: renameList(performance, 0),
      finisher: renameList(finisher, performance.length),
    },
  };
}

export function createPresetId(title) {
  const slug = String(title || "custom")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 28) || "custom";
  return `custom-${slug}-${Date.now().toString(36)}`;
}

// Turn the in-progress session into the record that gets saved: stop the timer,
// work out the duration, and bake substitutions into the workout snapshot.
export function buildFinishedSession(session, workoutPresets, now = Date.now()) {
  const timer = session.timer;
  const currentSeconds = timer.running && timer.lastResumedAt ? Math.floor((now - timer.lastResumedAt) / 1000) : 0;
  const duration = Math.round((timer.accumulated + currentSeconds) / 60);
  let finishedSession = {
    ...session,
    workoutSnapshot: session.workoutSnapshot || createWorkoutSnapshot(getWorkoutById(session.workoutId, workoutPresets)),
    duration,
    startedAt: timer.startedAt,
    finishedAt: now,
  };
  delete finishedSession.timer;
  finishedSession = applySubstitutionsToSession(finishedSession, session.substitutions);
  delete finishedSession.substitutions;
  return finishedSession;
}

// Compare every logged set against the current personal bests. Returns the
// updated bests plus the records this session earned (for the celebration).
export function applyPersonalBests(currentBests, finishedSession, workout) {
  const personalBests = { ...currentBests };
  const earnedRecords = new Map();

  getExercisesForWorkout(workout).forEach((exercise, index) => {
    const exerciseKey = `${index}-${exercise.name}`;
    (finishedSession.sets[exerciseKey] || []).forEach((setData) => {
      const candidate = getExerciseRecordCandidate(setData, exercise);
      const currentBest = Number(personalBests[exercise.name]?.value ?? personalBests[exercise.name]?.kg ?? 0);
      if (candidate && candidate.value > currentBest) {
        personalBests[exercise.name] = {
          value: candidate.value,
          unit: candidate.unit,
          kg: candidate.unit === "kg" ? candidate.value : 0,
          reps: candidate.reps || null,
          summary: candidate.summary,
          date: finishedSession.date,
        };
        earnedRecords.set(exercise.name, {
          name: exercise.name,
          value: candidate.value,
          unit: candidate.unit,
          summary: candidate.summary,
        });
      }
    });
  });

  return { personalBests, earnedRecords };
}
