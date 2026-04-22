import { WORKOUTS } from "./data.js";

const cloneExercises = (exercises = []) => exercises.map((exercise) => ({ ...exercise }));

export function createWorkoutSnapshot(workout) {
  if (!workout) {
    return null;
  }

  return {
    id: workout.id,
    title: workout.title,
    shortTitle: workout.shortTitle,
    day: workout.day,
    goal: workout.goal,
    color: workout.color,
    performance: cloneExercises(workout.performance),
    finisher: cloneExercises(workout.finisher),
    core: workout.core
      ? {
          title: workout.core.title,
          exercises: cloneExercises(workout.core.exercises),
        }
      : null,
  };
}

export function getWorkoutById(workoutId) {
  return WORKOUTS[workoutId] || null;
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
