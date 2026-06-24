import rawExerciseCsv from "./exercise-data/gym_exercise_library_import.csv?raw";
import { formatRestLabel } from "./workouts.js";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === "\"") {
      if (inQuotes && nextChar === "\"") {
        cell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => value.trim())) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim())) {
      rows.push(row);
    }
  }

  return rows;
}

function splitList(value = "") {
  return String(value)
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

const [headers = [], ...rows] = parseCsv(rawExerciseCsv);

export const EXERCISE_LIBRARY = rows
  .map((values) => {
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() || ""]));
    const exercise = {
      id: record["Exercise ID"],
      name: record["Exercise Name"],
      mainCategory: record["Main Category"],
      bodyRegion: record["Body Region"],
      movementPattern: record["Movement Pattern"],
      primaryMuscle: record["Primary Muscle"],
      secondaryMuscles: splitList(record["Secondary Muscles"]),
      equipment: record.Equipment,
      setupAngle: record["Setup / Angle"],
      gripStance: record["Grip / Stance"],
      laterality: record.Laterality,
      difficulty: record.Difficulty,
      loadType: record["Load Type"],
      trackBy: record["Track By"],
      primaryUse: record["Primary Use"],
      progressionFamily: record["Progression Family"],
      tags: splitList(record["App Tags"]),
      notes: record.Notes,
    };
    return {
      ...exercise,
      searchText: [
        exercise.name,
        exercise.mainCategory,
        exercise.bodyRegion,
        exercise.movementPattern,
        exercise.primaryMuscle,
        exercise.secondaryMuscles.join(" "),
        exercise.equipment,
        exercise.difficulty,
        exercise.progressionFamily,
        exercise.tags.join(" "),
      ].join(" ").toLowerCase(),
    };
  })
  .filter((exercise) => exercise.id && exercise.name);

export const EXERCISE_CATEGORY_OPTIONS = uniqueSorted(EXERCISE_LIBRARY.map((exercise) => exercise.mainCategory));
export const EXERCISE_REGION_OPTIONS = uniqueSorted(EXERCISE_LIBRARY.map((exercise) => exercise.bodyRegion));

export function getDefaultExercisePrescription(libraryExercise) {
  const trackBy = libraryExercise?.trackBy || "";
  const loadType = libraryExercise?.loadType || "";
  const tracksLoad = /load|resistance|watts/i.test(trackBy) || /external load/i.test(loadType);
  const tracksDistance = /distance/i.test(trackBy);
  const tracksTime = /time|interval/i.test(trackBy);
  const isHold = /hold/i.test(trackBy);

  const reps = tracksDistance
    ? "20m"
    : tracksTime || isHold
      ? "30 sec"
      : "10";
  const sets = /time\s*\/|interval/i.test(trackBy) ? 1 : 3;
  const rest = tracksDistance || tracksTime ? 60 : tracksLoad ? 90 : 45;

  return {
    exerciseId: libraryExercise.id,
    name: libraryExercise.name,
    type: libraryExercise.equipment || libraryExercise.mainCategory || "Exercise",
    sets,
    reps,
    rest,
    restLabel: formatRestLabel(rest),
    tracked: tracksLoad,
    libraryMeta: {
      mainCategory: libraryExercise.mainCategory,
      bodyRegion: libraryExercise.bodyRegion,
      primaryMuscle: libraryExercise.primaryMuscle,
      trackBy: libraryExercise.trackBy,
    },
  };
}
