import { describe, expect, it } from "vitest";
import { calculatePlates } from "../src/lib/plates.js";
import { getLastWorkingSets, getProgressionConfig, getProgressionSuggestion } from "../src/progression.js";
import { DD, withDefaults } from "../src/storage.js";
import { getExerciseRecordCandidate, getGroupLabels, getSetSummary, recomputePersonalBests } from "../src/workouts.js";

const BENCH = { name: "Bench Press", type: "Barbell", sets: 3, reps: "8-12", rest: 150, tracked: true };

function appWithSession(sets, extra = {}) {
  return withDefaults({
    ...DD(),
    sessions: [
      {
        date: "2026-07-20",
        workoutId: "p1",
        workoutSnapshot: { title: "Push", performance: [BENCH], finisher: [], core: null },
        sets: { [`0-${BENCH.name}`]: sets },
      },
    ],
    ...extra,
  });
}

describe("plate calculator", () => {
  it("splits 82.5kg into per-side plates", () => {
    const result = calculatePlates(82.5);
    expect(result.valid).toBe(true);
    expect(result.perSide.reduce((sum, plate) => sum + plate, 0)).toBe(31.25);
    expect(result.exact).toBe(true);
    expect(result.loadedKg).toBe(82.5);
  });

  it("reports the closest loadable weight when the target isn't exact", () => {
    const result = calculatePlates(83);
    expect(result.exact).toBe(false);
    expect(result.loadedKg).toBe(82.5);
    expect(result.remainderKg).toBeCloseTo(0.5);
  });

  it("rejects loads below the bar", () => {
    expect(calculatePlates(15).valid).toBe(false);
    expect(calculatePlates("").valid).toBe(false);
  });
});

describe("warm-up sets", () => {
  it("never count as personal-best candidates", () => {
    expect(getExerciseRecordCandidate({ kg: "100", reps: "5", warmup: true }, BENCH)).toBeNull();
    expect(getExerciseRecordCandidate({ kg: "100", reps: "5" }, BENCH)).not.toBeNull();
  });

  it("are labelled in set summaries along with RPE", () => {
    expect(getSetSummary({ kg: "60", reps: "10", rpe: "8" }, BENCH)).toBe("60kg × 10 @8");
    expect(getSetSummary({ kg: "40", reps: "8", warmup: true }, BENCH)).toContain("(warm-up)");
  });
});

describe("superset groups", () => {
  it("labels grouped exercises A1/A2, B1…", () => {
    const labels = getGroupLabels([
      { name: "Bench", group: "A" },
      { name: "Row", group: "A" },
      { name: "Curl", group: null },
      { name: "Dips", group: "B" },
    ]);
    expect(labels).toEqual(["A1", "A2", null, "B1"]);
  });
});

describe("recomputing personal bests after edits", () => {
  it("uses the corrected values, not the stale ones", () => {
    const app = appWithSession([{ kg: "100", reps: "5" }]);
    expect(recomputePersonalBests(app.sessions)["Bench Press"].value).toBe(100);

    const corrected = appWithSession([{ kg: "80", reps: "5" }]);
    expect(recomputePersonalBests(corrected.sessions)["Bench Press"].value).toBe(80);
  });

  it("ignores warm-ups", () => {
    const app = appWithSession([{ kg: "120", reps: "3", warmup: true }, { kg: "90", reps: "5" }]);
    expect(recomputePersonalBests(app.sessions)["Bench Press"].value).toBe(90);
  });
});

describe("progression suggestions", () => {
  it("asks for a baseline when nothing is logged", () => {
    const suggestion = getProgressionSuggestion(withDefaults(DD()), BENCH);
    expect(suggestion.target).toMatch(/baseline/i);
    expect(suggestion.reason).toMatch(/8–12 clean reps/);
  });

  it("double progression: chases reps before weight, and explains it", () => {
    const app = appWithSession([
      { kg: "60", reps: "10", rpe: "8" },
      { kg: "60", reps: "10", rpe: "8" },
      { kg: "60", reps: "9", rpe: "8" },
    ]);
    const suggestion = getProgressionSuggestion(app, BENCH);
    expect(suggestion.target).toBe("60kg × 10, 10, 10");
    expect(suggestion.reason).toContain("60kg × 10, 10, 9 at RPE 8");
    expect(suggestion.reason).toMatch(/must reach 12/);
  });

  it("double progression: adds weight once the range is full at acceptable RPE", () => {
    const app = appWithSession([
      { kg: "60", reps: "12", rpe: "8" },
      { kg: "60", reps: "12", rpe: "8" },
      { kg: "60", reps: "12", rpe: "8" },
    ]);
    const suggestion = getProgressionSuggestion(app, BENCH);
    expect(suggestion.target).toBe("62.5kg × 8, 8, 8");
    expect(suggestion.reason).toMatch(/add 2.5kg/i);
  });

  it("double progression: holds weight when the range is full but RPE is too high", () => {
    const app = appWithSession([
      { kg: "60", reps: "12", rpe: "9.5" },
      { kg: "60", reps: "12", rpe: "9.5" },
      { kg: "60", reps: "12", rpe: "9.5" },
    ]);
    const suggestion = getProgressionSuggestion(app, BENCH);
    expect(suggestion.target).toMatch(/^60kg/);
    expect(suggestion.reason).toMatch(/RPE was above/i);
  });

  it("fixed progression adds the configured increment", () => {
    const app = appWithSession(
      [{ kg: "60", reps: "8" }],
      { exerciseSettings: { "Bench Press": { progressionMethod: "fixed", incrementKg: 5 } } }
    );
    expect(getProgressionConfig(app, "Bench Press").incrementKg).toBe(5);
    const suggestion = getProgressionSuggestion(app, BENCH);
    expect(suggestion.target).toMatch(/^65kg/);
    expect(suggestion.reason).toMatch(/adds 5kg each session/i);
  });

  it("rep-quality progression holds weight while any set is above RPE 8", () => {
    const app = appWithSession(
      [
        { kg: "60", reps: "10", rpe: "7" },
        { kg: "60", reps: "10", rpe: "9" },
      ],
      { exerciseSettings: { "Bench Press": { progressionMethod: "quality" } } }
    );
    const suggestion = getProgressionSuggestion(app, BENCH);
    expect(suggestion.target).toMatch(/^60kg/);
    expect(suggestion.reason).toMatch(/Set 2 was RPE 9/);
  });

  it("ignores warm-up sets when reading the last session", () => {
    const app = appWithSession([
      { kg: "40", reps: "10", warmup: true },
      { kg: "60", reps: "12", rpe: "7" },
    ]);
    expect(getLastWorkingSets(app, BENCH).sets).toHaveLength(1);
  });

  it("can be turned off per exercise", () => {
    const app = appWithSession(
      [{ kg: "60", reps: "10" }],
      { exerciseSettings: { "Bench Press": { progressionMethod: "off" } } }
    );
    expect(getProgressionSuggestion(app, BENCH)).toBeNull();
  });
});
