import { describe, expect, it } from "vitest";
import { DD, withDefaults } from "../src/storage.js";
import {
  addPlanItem,
  getMissedItems,
  getPlanForDate,
  getScheduleWarnings,
  getWeekPlan,
  isDeloadWeek,
  moveOccurrence,
  removeOccurrence,
  setOccurrenceStatus,
  toggleDeloadWeek,
  weekdayIndex,
} from "../src/trainingPlan.js";

// 2026-07-20 is a Monday.
const MON = "2026-07-20";
const TUE = "2026-07-21";
const WED = "2026-07-22";
const NEXT_TUE = "2026-07-28";

const PRESETS = [
  { id: "p-upper", title: "Upper Strength", performance: [{ name: "Bench" }] },
  { id: "p-lower", title: "Lower Power", performance: [{ name: "Squat" }] },
];

function makeApp(plan, overrides = {}) {
  return withDefaults({ ...DD(), workoutPresets: PRESETS, trainingPlan: plan, ...overrides });
}

function weeklyPlan() {
  let plan = addPlanItem(undefined, { date: MON, type: "gym", presetId: "p-upper", repeatWeekly: true });
  plan = addPlanItem(plan, { date: TUE, type: "gym", presetId: "p-lower", repeatWeekly: true });
  plan = addPlanItem(plan, { date: WED, type: "basketball", repeatWeekly: true });
  return plan;
}

describe("recurring weekly template", () => {
  it("puts recurring items on their weekday, week after week", () => {
    const app = makeApp(weeklyPlan());
    expect(getPlanForDate(app, TUE, MON)[0].title).toBe("Lower Power");
    expect(getPlanForDate(app, NEXT_TUE, MON)[0].title).toBe("Lower Power");
    expect(getPlanForDate(app, MON, MON)[0].title).toBe("Upper Strength");
  });

  it("supports one-off items and rest days without touching the template", () => {
    let plan = weeklyPlan();
    plan = addPlanItem(plan, { date: WED, type: "rest", repeatWeekly: false });
    const app = makeApp(plan);
    const wednesday = getPlanForDate(app, WED, MON);
    expect(wednesday.map((item) => item.type).sort()).toEqual(["basketball", "rest"]);
    // The one-off does not appear next week.
    expect(getPlanForDate(app, addDaysStr(WED, 7), MON).map((item) => item.type)).toEqual(["basketball"]);
  });
});

function addDaysStr(date, days) {
  const parsed = new Date(`${date}T00:00:00`);
  parsed.setDate(parsed.getDate() + days);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

describe("statuses", () => {
  it("marks items completed from logged activity, missed when past, planned otherwise", () => {
    const app = makeApp(weeklyPlan(), {
      sessions: [{ date: MON, workoutId: "p-upper", sets: {} }],
    });
    // Viewed from Wednesday: Monday done, Tuesday missed, Wednesday planned.
    expect(getPlanForDate(app, MON, WED)[0].status).toBe("completed");
    expect(getPlanForDate(app, TUE, WED)[0].status).toBe("missed");
    expect(getPlanForDate(app, WED, WED)[0].status).toBe("planned");
  });

  it("lets the user skip one occurrence without touching future weeks", () => {
    let plan = weeklyPlan();
    const app0 = makeApp(plan);
    const tuesdayRef = getPlanForDate(app0, TUE, MON)[0].ref;
    plan = setOccurrenceStatus(plan, tuesdayRef, "skipped");

    const app = makeApp(plan);
    expect(getPlanForDate(app, TUE, WED)[0].status).toBe("skipped");
    expect(getPlanForDate(app, NEXT_TUE, MON)[0].status).toBe("planned");
  });

  it("completes basketball and recovery items from their own logs", () => {
    let plan = addPlanItem(undefined, { date: WED, type: "basketball", repeatWeekly: false });
    plan = addPlanItem(plan, { date: WED, type: "recovery", repeatWeekly: false });
    const app = makeApp(plan, {
      basketballSessions: [{ date: WED, makes: 40 }],
      recovery: [{ date: WED, sleep: 8 }],
    });
    const items = getPlanForDate(app, WED, WED);
    expect(items.every((item) => item.status === "completed")).toBe(true);
  });
});

describe("moving a missed workout", () => {
  it("moves one occurrence to a new date and keeps the series on its weekday", () => {
    let plan = weeklyPlan();
    let app = makeApp(plan);
    const tuesdayRef = getPlanForDate(app, TUE, WED)[0].ref;

    plan = moveOccurrence(plan, app, tuesdayRef, WED);
    app = makeApp(plan);

    // Tuesday no longer shows it; Wednesday gained it with provenance.
    expect(getPlanForDate(app, TUE, WED)).toHaveLength(0);
    const moved = getPlanForDate(app, WED, WED).find((item) => item.title === "Lower Power");
    expect(moved).toBeTruthy();
    expect(moved.movedFrom).toBe(TUE);
    // Next Tuesday is untouched.
    expect(getPlanForDate(app, NEXT_TUE, MON)[0].status).toBe("planned");
  });

  it("surfaces recent missed items for the move-or-skip prompt", () => {
    const app = makeApp(weeklyPlan());
    const missed = getMissedItems(app, WED);
    expect(missed.map((item) => item.title)).toContain("Lower Power");
    expect(missed[0].weekday).toBeTruthy();
    // Rest/recovery never nag.
    expect(missed.every((item) => item.type !== "rest" && item.type !== "recovery")).toBe(true);
  });

  it("stops nagging once the item is skipped or moved", () => {
    let plan = weeklyPlan();
    let app = makeApp(plan);
    const ref = getPlanForDate(app, TUE, WED)[0].ref;

    const skipped = makeApp(setOccurrenceStatus(plan, ref, "skipped"));
    expect(getMissedItems(skipped, WED).map((item) => item.title)).not.toContain("Lower Power");

    const movedPlan = moveOccurrence(plan, app, ref, WED);
    expect(getMissedItems(makeApp(movedPlan), WED).map((item) => item.title)).not.toContain("Lower Power");
  });
});

describe("deleting occurrences and series", () => {
  it("removes a single occurrence without touching other weeks", () => {
    let plan = weeklyPlan();
    const app0 = makeApp(plan);
    const ref = getPlanForDate(app0, TUE, MON)[0].ref;
    plan = removeOccurrence(plan, ref);
    const app = makeApp(plan);
    expect(getPlanForDate(app, TUE, MON)).toHaveLength(0);
    expect(getPlanForDate(app, NEXT_TUE, MON)).toHaveLength(1);
  });

  it("removes a whole series", () => {
    let plan = weeklyPlan();
    const app0 = makeApp(plan);
    const ref = getPlanForDate(app0, TUE, MON)[0].ref;
    plan = removeOccurrence(plan, ref, { wholeSeries: true });
    const app = makeApp(plan);
    expect(getPlanForDate(app, TUE, MON)).toHaveLength(0);
    expect(getPlanForDate(app, NEXT_TUE, MON)).toHaveLength(0);
  });
});

describe("deload weeks", () => {
  it("toggles per week", () => {
    let plan = toggleDeloadWeek(undefined, TUE);
    expect(isDeloadWeek(plan, MON)).toBe(true);
    expect(isDeloadWeek(plan, NEXT_TUE)).toBe(false);
    plan = toggleDeloadWeek(plan, MON);
    expect(isDeloadWeek(plan, MON)).toBe(false);
  });
});

describe("schedule warnings", () => {
  it("flags hard lower-body gym work the day after basketball", () => {
    let plan = addPlanItem(undefined, { date: TUE, type: "basketball", repeatWeekly: true });
    plan = addPlanItem(plan, { date: WED, type: "gym", presetId: "p-lower", repeatWeekly: true });
    const warnings = getScheduleWarnings(makeApp(plan), MON, MON);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/Lower Power/);
    expect(warnings[0]).toMatch(/day after basketball/i);
  });

  it("stays quiet for upper-body work after basketball", () => {
    let plan = addPlanItem(undefined, { date: TUE, type: "basketball", repeatWeekly: true });
    plan = addPlanItem(plan, { date: WED, type: "gym", presetId: "p-upper", repeatWeekly: true });
    expect(getScheduleWarnings(makeApp(plan), MON, MON)).toHaveLength(0);
  });
});

describe("week view", () => {
  it("returns all seven days Monday-first", () => {
    const week = getWeekPlan(makeApp(weeklyPlan()), WED, MON);
    expect(week).toHaveLength(7);
    expect(week[0].date).toBe(MON);
    expect(week[0].weekday).toBe("Monday");
    expect(weekdayIndex(week[6].date)).toBe(6);
  });
});
