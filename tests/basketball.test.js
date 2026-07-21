import { describe, expect, it } from "vitest";
import {
  BENCHMARK_TESTS,
  compareBenchmarkValues,
  computeStreaks,
  describeTarget,
  getBenchmarkStatus,
  getDrillProgress,
  getRepDrillProgress,
  getRepLoad,
  getSessionWorkload,
  isHighLoadSession,
  normalizeDrill,
} from "../src/basketball.js";

function makeShots(pattern) {
  // pattern like "MMxMM" — M = make, x = miss
  return [...pattern].map((char) => ({ result: char === "M" ? "make" : "miss" }));
}

describe("drill normalization", () => {
  it("fills in sane defaults", () => {
    const drill = normalizeDrill({ name: "Wing catch & shoot" });
    expect(drill.category).toBe("spot");
    expect(drill.level).toBe("stationary");
    expect(drill.targetType).toBe("makes");
    expect(drill.targetValue).toBe(10);
  });

  it("reads the legacy targetMakes field", () => {
    expect(normalizeDrill({ targetMakes: 25 }).targetValue).toBe(25);
  });
});

describe("target types", () => {
  it("make target: complete once enough makes are logged", () => {
    const drill = { targetType: "makes", targetValue: 3 };
    expect(getDrillProgress(drill, makeShots("MxM")).complete).toBe(false);
    expect(getDrillProgress(drill, makeShots("MxMM")).complete).toBe(true);
    expect(describeTarget(drill)).toBe("Make 3");
  });

  it("attempt target: complete once enough shots are taken, regardless of makes", () => {
    const drill = { targetType: "attempts", targetValue: 5 };
    const progress = getDrillProgress(drill, makeShots("xxxxx"));
    expect(progress.complete).toBe(true);
    expect(progress.progressLabel).toBe("5/5 shots");
    expect(describeTarget(drill)).toBe("Shoot 5");
  });

  it("percent target: requires the minimum sample before it can complete", () => {
    const drill = { targetType: "percent", targetValue: 70, minAttempts: 10 };
    // 4/5 = 80% but under the minimum sample size.
    const early = getDrillProgress(drill, makeShots("MMMMx"));
    expect(early.complete).toBe(false);
    expect(early.progressLabel).toMatch(/need 10\+ attempts/);

    // 7/10 = 70%, meets both the sample size and the target.
    const full = getDrillProgress(drill, makeShots("MMMMMMMxxx"));
    expect(full.complete).toBe(true);
    expect(full.percent).toBe(70);
  });

  it("streak target: complete once the best run reaches the target", () => {
    const drill = { targetType: "streak", targetValue: 5 };
    expect(getDrillProgress(drill, makeShots("MMMMxMMMM")).complete).toBe(false);
    expect(getDrillProgress(drill, makeShots("MMMMxMMMMM")).complete).toBe(true);
    expect(describeTarget(drill)).toBe("Make 5 in a row");
  });

  it("computes current vs best streak independently", () => {
    expect(computeStreaks(makeShots("MMxMMMxM"))).toEqual({ current: 1, best: 3 });
    expect(computeStreaks(makeShots("xxx"))).toEqual({ current: 0, best: 0 });
  });
});

describe("rep-counted (non-shooting) drills", () => {
  it("tracks completion by rep count instead of makes", () => {
    const drill = { targetType: "attempts", targetValue: 50, logType: "count" };
    expect(getRepDrillProgress(drill, 30).complete).toBe(false);
    expect(getRepDrillProgress(drill, 50).complete).toBe(true);
    expect(getRepDrillProgress(drill, 50).progressLabel).toBe("50/50");
    expect(getRepDrillProgress(drill, 25).ratio).toBe(0.5);
  });
});

describe("progress ratios for progress bars", () => {
  it("cap at 1 and reflect the target type in use", () => {
    expect(getDrillProgress({ targetType: "makes", targetValue: 10 }, makeShots("MMMMM")).ratio).toBe(0.5);
    expect(getDrillProgress({ targetType: "makes", targetValue: 10 }, makeShots("MMMMMMMMMMMM")).ratio).toBe(1);
    expect(getDrillProgress({ targetType: "streak", targetValue: 4 }, makeShots("MM")).ratio).toBe(0.5);
  });
});

describe("workload scoring", () => {
  it("rates a high-volume finishing/gamespeed session as high load", () => {
    const shots = Array.from({ length: 30 }, () => ({ category: "finishing", level: "gameSpeed", result: "make" }));
    const workload = getSessionWorkload({ shots });
    expect(workload.level).toBe("high");
    expect(isHighLoadSession({ shots })).toBe(true);
  });

  it("rates a light stationary free-throw session as low load", () => {
    const shots = Array.from({ length: 20 }, () => ({ category: "freeThrow", level: "stationary", result: "make" }));
    const workload = getSessionWorkload({ shots });
    expect(workload.level).toBe("low");
    expect(isHighLoadSession({ shots })).toBe(false);
  });

  it("rates a mixed moderate session accordingly", () => {
    const shots = [
      ...Array.from({ length: 20 }, () => ({ category: "spot", level: "stationary" })),
      ...Array.from({ length: 20 }, () => ({ category: "ballHandling", level: "oneDribble" })),
      ...Array.from({ length: 10 }, () => ({ category: "finishing", level: "liveFootwork" })),
    ];
    expect(getSessionWorkload({ shots }).level).toBe("moderate");
  });

  it("counts rep-logged drills (ball handling / conditioning) toward workload too", () => {
    const drillLogs = [{ category: "conditioning", level: "gameSpeed", reps: 30 }];
    const workload = getSessionWorkload({ shots: [], drillLogs });
    expect(workload.level).toBe("high");
    expect(workload.repCount).toBe(30);
  });

  it("treats higher progression levels as more load than the same category stationary", () => {
    const stationary = getRepLoad("offDribble", "stationary");
    const defender = getRepLoad("offDribble", "defender");
    expect(defender).toBeGreaterThan(stationary);
  });

  it("returns zero/low load for an empty session", () => {
    expect(getSessionWorkload({}).level).toBe("low");
    expect(getSessionWorkload({}).totalLoad).toBe(0);
  });
});

describe("benchmark tests", () => {
  it("ships the six required benchmarks", () => {
    const ids = BENCHMARK_TESTS.map((test) => test.id);
    expect(ids).toEqual(expect.arrayContaining([
      "freeThrows50", "midrangeFiveSpot", "threePointFiveSpot", "finishingPackage", "ballHandlingTrial", "verticalJump",
    ]));
  });

  it("is due when never tested", () => {
    const status = getBenchmarkStatus({ basketballBenchmarks: [] }, "freeThrows50", "2026-07-20");
    expect(status.due).toBe(true);
    expect(status.reason).toMatch(/never tested/i);
  });

  it("is not due right after a recent test, and due again after the monthly interval", () => {
    const app = { basketballBenchmarks: [{ testId: "freeThrows50", date: "2026-07-01", value: 38 }] };
    expect(getBenchmarkStatus(app, "freeThrows50", "2026-07-10").due).toBe(false);
    expect(getBenchmarkStatus(app, "freeThrows50", "2026-08-05").due).toBe(true);
  });

  it("compares results respecting which direction is better", () => {
    const makesTest = getBenchmarkStatus({ basketballBenchmarks: [] }, "freeThrows50", "2026-07-20").test;
    expect(compareBenchmarkValues(makesTest, 30, 38).improved).toBe(true);
    expect(compareBenchmarkValues(makesTest, 38, 30).improved).toBe(false);

    const timeTest = getBenchmarkStatus({ basketballBenchmarks: [] }, "ballHandlingTrial", "2026-07-20").test;
    expect(compareBenchmarkValues(timeTest, 42, 38).improved).toBe(true); // faster (lower) is better
    expect(compareBenchmarkValues(timeTest, 38, 42).improved).toBe(false);
  });

  it("has no improvement verdict on the first-ever result", () => {
    expect(compareBenchmarkValues(BENCHMARK_TESTS[0], null, 30)).toEqual({ delta: null, improved: null });
  });
});
