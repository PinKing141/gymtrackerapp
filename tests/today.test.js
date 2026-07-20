import { describe, expect, it } from "vitest";
import { DD, withDefaults } from "../src/storage.js";
import { getChecklistProgress, getDailyChecklist, getReadiness, getTodayPlan } from "../src/today.js";

const TODAY = "2026-07-20";
const YESTERDAY = "2026-07-19";

const PROFILE = { age: 25, sex: "male", heightCm: 180, weightKg: 80, goal: "maintain", activityLevel: "moderate", onboardingComplete: true };

function makeApp(overrides = {}) {
  return withDefaults({ ...DD(), ...overrides });
}

describe("readiness", () => {
  it("asks for a check-in when there is no recent data", () => {
    const readiness = getReadiness(makeApp(), TODAY);
    expect(readiness.level).toBe("unknown");
    expect(readiness.suggestion).toMatch(/check-in/i);
  });

  it("is ready after a good check-in", () => {
    const app = makeApp({
      recovery: [{ date: TODAY, sleep: 8, water: 3, jointCondition: 1, recoveryState: 1, motivationState: 1 }],
    });
    const readiness = getReadiness(app, TODAY);
    expect(readiness.level).toBe("ready");
    expect(readiness.reasons).toHaveLength(0);
  });

  it("suggests reducing volume on poor sleep with stiff joints, transparently", () => {
    const app = makeApp({
      recovery: [{ date: TODAY, sleep: 5.5, jointCondition: 3 }],
    });
    const readiness = getReadiness(app, TODAY);
    expect(readiness.level).toBe("reduce");
    expect(readiness.reasons.join(" ")).toMatch(/sleep \(5\.5h\)/i);
    expect(readiness.reasons.join(" ")).toMatch(/joint stiffness/i);
  });

  it("suggests a recovery day and no high-impact work when joints are painful and sleep is very short", () => {
    const app = makeApp({
      recovery: [{ date: TODAY, sleep: 4.5, jointCondition: 5 }],
    });
    const readiness = getReadiness(app, TODAY);
    expect(readiness.level).toBe("recovery");
    expect(readiness.avoidHighImpact).toBe(true);
    expect(readiness.suggestion).toMatch(/high-impact/i);
  });

  it("flags pain reported in the last workout", () => {
    const app = makeApp({
      sessions: [{ date: YESTERDAY, workoutId: "W1", painFlags: { shoulder: 1, ankle: 4, hip: 1 } }],
    });
    const readiness = getReadiness(app, TODAY);
    expect(readiness.avoidHighImpact).toBe(true);
    expect(readiness.reasons.join(" ")).toMatch(/ankle/);
  });

  it("counts recent workload", () => {
    const app = makeApp({
      recovery: [{ date: TODAY, sleep: 8 }],
      sessions: [
        { date: "2026-07-18", workoutId: "W1", painFlags: {} },
        { date: "2026-07-19", workoutId: "W1", painFlags: {} },
        { date: "2026-07-20", workoutId: "W1", painFlags: {} },
      ],
    });
    const readiness = getReadiness(app, TODAY);
    expect(readiness.reasons.join(" ")).toMatch(/3 times in the last 3 days/i);
    expect(["reduce", "recovery"]).toContain(readiness.level);
  });

  it("uses yesterday's check-in when today's isn't logged yet", () => {
    const app = makeApp({ recovery: [{ date: YESTERDAY, sleep: 4, jointCondition: 4 }] });
    expect(getReadiness(app, TODAY).level).toBe("recovery");
  });
});

describe("today's plan", () => {
  it("offers the basics for a fresh account", () => {
    const plan = getTodayPlan(makeApp(), TODAY);
    const keys = plan.map((item) => item.key);
    expect(keys).toContain("workout");
    expect(keys).toContain("recovery");
    expect(keys).toContain("weighIn");
    // No profile data → no nutrition targets; basketball module off by default.
    expect(keys).not.toContain("nutrition");
    expect(plan.find((item) => item.key === "workout").title).toMatch(/plan a gym workout/i);
  });

  it("rotates to the next workout preset after the last session", () => {
    const presets = [
      { id: "p1", title: "Push", performance: [{ name: "Bench" }] },
      { id: "p2", title: "Pull", performance: [{ name: "Row" }] },
    ];
    const app = makeApp({
      workoutPresets: presets,
      sessions: [{ date: YESTERDAY, workoutId: "p1", sets: {} }],
    });
    expect(getTodayPlan(app, TODAY).find((item) => item.key === "workout").title).toBe("Pull");
  });

  it("marks the workout done after today's session and shows remaining nutrition", () => {
    const app = makeApp({
      profile: PROFILE,
      sessions: [{ date: TODAY, workoutId: "p1", sets: {} }],
      nutrition: { foodLogs: [{ date: TODAY, calories: 800, protein: 60 }], customFoods: [], savedMeals: [], targets: null },
    });
    const plan = getTodayPlan(app, TODAY);
    expect(plan.find((item) => item.key === "workout").done).toBe(true);
    const nutrition = plan.find((item) => item.key === "nutrition");
    expect(nutrition.done).toBe(false);
    expect(nutrition.detail).toMatch(/kcal/);
    expect(nutrition.detail).toMatch(/protein remaining/);
  });

  it("includes basketball only when the module is enabled", () => {
    const app = makeApp({ profile: { ...PROFILE, enabledModules: { gym: true, basketball: true } } });
    expect(getTodayPlan(app, TODAY).find((item) => item.key === "basketball")).toBeTruthy();

    const done = makeApp({
      profile: { ...PROFILE, enabledModules: { gym: true, basketball: true } },
      basketballSessions: [{ date: TODAY, makes: 50 }],
    });
    expect(getTodayPlan(done, TODAY).find((item) => item.key === "basketball").done).toBe(true);
  });

  it("only nags about weigh-ins once a week", () => {
    const recent = makeApp({ bodyStats: [{ date: "2026-07-18", weight: 176 }] });
    expect(getTodayPlan(recent, TODAY).find((item) => item.key === "weighIn")).toBeUndefined();

    const stale = makeApp({ bodyStats: [{ date: "2026-07-01", weight: 176 }] });
    expect(getTodayPlan(stale, TODAY).find((item) => item.key === "weighIn")).toBeTruthy();
  });
});

describe("daily checklist", () => {
  it("tracks all items as not done on an empty day", () => {
    const items = getDailyChecklist(makeApp({ profile: PROFILE }), TODAY);
    expect(items.every((item) => !item.done)).toBe(true);
    expect(getChecklistProgress(items).done).toBe(0);
  });

  it("completes items from real logs", () => {
    const app = makeApp({
      profile: PROFILE,
      sessions: [{ date: TODAY, workoutId: "p1", sets: {} }],
      recovery: [{ date: TODAY, sleep: 8, water: 4, mobilityDone: true }],
      nutrition: { foodLogs: [{ date: TODAY, calories: 2000, protein: 200 }], customFoods: [], savedMeals: [], targets: null },
    });
    const items = getDailyChecklist(app, TODAY);
    const byKey = Object.fromEntries(items.map((item) => [item.key, item]));

    expect(byKey.workout.done).toBe(true);
    expect(byKey.food.done).toBe(true);
    expect(byKey.protein.done).toBe(true);
    expect(byKey.water.done).toBe(true);
    expect(byKey.recovery.done).toBe(true);
    expect(byKey.mobility.done).toBe(true);
    expect(getChecklistProgress(items).percent).toBe(100);
  });

  it("shows protein progress against the target", () => {
    const app = makeApp({
      profile: PROFILE,
      nutrition: { foodLogs: [{ date: TODAY, calories: 500, protein: 50 }], customFoods: [], savedMeals: [], targets: null },
    });
    const protein = getDailyChecklist(app, TODAY).find((item) => item.key === "protein");
    expect(protein.done).toBe(false);
    expect(protein.detail).toBe("50/144g");
  });
});
