import { describe, expect, it } from "vitest";
import { applyPersonalBests, applySubstitutionsToSession, buildFinishedSession } from "../src/workoutSession.js";

const BENCH = { name: "Bench Press", type: "Barbell", sets: 3, reps: "8-12", rest: 150, tracked: true };
const ROW = { name: "Barbell Row", type: "Barbell", sets: 3, reps: "8-12", rest: 120, tracked: true };
const SNAPSHOT = { title: "Push", performance: [BENCH], finisher: [ROW], core: null };

function session(overrides = {}) {
  return {
    workoutId: "p1",
    workoutSnapshot: SNAPSHOT,
    date: "2026-07-20",
    sets: { [`0-${BENCH.name}`]: [{ kg: "100", reps: "5" }], [`1-${ROW.name}`]: [{ kg: "70", reps: "8" }] },
    substitutions: {},
    timer: { running: false, startedAt: 1000, lastResumedAt: null, accumulated: 1800 },
    ...overrides,
  };
}

describe("buildFinishedSession", () => {
  it("records the duration in minutes and drops the live timer", () => {
    const finished = buildFinishedSession(session(), [], 5000);
    expect(finished.duration).toBe(30);
    expect(finished.startedAt).toBe(1000);
    expect(finished.finishedAt).toBe(5000);
    expect(finished).not.toHaveProperty("timer");
    expect(finished).not.toHaveProperty("substitutions");
  });

  it("adds time from a timer that is still running", () => {
    const running = session({ timer: { running: true, startedAt: 1000, lastResumedAt: 1000, accumulated: 1800 } });
    // 10 minutes since the last resume, on top of 30 accumulated.
    expect(buildFinishedSession(running, [], 601_000).duration).toBe(40);
  });
});

describe("applySubstitutionsToSession", () => {
  it("renames the swapped exercise and moves its logged sets", () => {
    const swapped = applySubstitutionsToSession(session(), { [`1-${ROW.name}`]: "Cable Row" });
    expect(swapped.workoutSnapshot.finisher[0]).toMatchObject({ name: "Cable Row", substitutedFrom: ROW.name });
    expect(swapped.sets["1-Cable Row"]).toEqual([{ kg: "70", reps: "8" }]);
    expect(swapped.sets[`1-${ROW.name}`]).toBeUndefined();
    expect(swapped.workoutSnapshot.performance[0].name).toBe(BENCH.name);
  });

  it("leaves the session alone when nothing was swapped", () => {
    const original = session();
    expect(applySubstitutionsToSession(original, {})).toBe(original);
  });
});

describe("applyPersonalBests", () => {
  it("records new bests and reports them as earned", () => {
    const { personalBests, earnedRecords } = applyPersonalBests({}, session(), SNAPSHOT);
    expect(personalBests[BENCH.name]).toMatchObject({ value: 100, unit: "kg", date: "2026-07-20" });
    expect([...earnedRecords.keys()]).toEqual([BENCH.name, ROW.name]);
  });

  it("keeps an existing best that this session didn't beat", () => {
    const current = { [BENCH.name]: { value: 120, unit: "kg", kg: 120 } };
    const { personalBests, earnedRecords } = applyPersonalBests(current, session(), SNAPSHOT);
    expect(personalBests[BENCH.name].value).toBe(120);
    expect(earnedRecords.has(BENCH.name)).toBe(false);
    expect(current[BENCH.name].value).toBe(120);
  });
});
