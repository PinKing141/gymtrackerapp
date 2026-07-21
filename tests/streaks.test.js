import { describe, expect, it } from "vitest";
import { DD, withDefaults } from "../src/storage.js";
import { getSessionsForWeek, getStreakSummary, getWeekEnd, getWeekKey, getWeekStart } from "../src/streaks.js";

describe("week boundaries", () => {
  it("keys a week by its Monday", () => {
    // 2026-07-20 is a Monday.
    expect(getWeekKey("2026-07-20")).toBe("2026-07-20");
    expect(getWeekKey("2026-07-26")).toBe("2026-07-20"); // Sunday of the same week
    expect(getWeekKey("2026-07-27")).toBe("2026-07-27"); // next Monday
  });

  it("spans Monday to Sunday", () => {
    expect(getWeekStart("2026-07-22").getDay()).toBe(1);
    expect(getWeekEnd("2026-07-22").getDay()).toBe(0);
    expect(getWeekStart("2026-07-22").getDate()).toBe(20);
    expect(getWeekEnd("2026-07-22").getDate()).toBe(26);
  });

  it("counts only the sessions inside a week", () => {
    const sessions = [
      { date: "2026-07-19" },
      { date: "2026-07-20" },
      { date: "2026-07-26" },
      { date: "2026-07-27" },
    ];
    expect(getSessionsForWeek(sessions, "2026-07-20")).toHaveLength(2);
  });
});

describe("streak summary", () => {
  it("reports zeroes for a fresh account", () => {
    const summary = getStreakSummary(DD());
    expect(summary.currentWeekCount).toBe(0);
    expect(summary.weeklyTarget).toBeGreaterThan(0);
  });

  it("counts this week's sessions", () => {
    const weekKey = getWeekKey();
    const app = withDefaults({
      ...DD(),
      sessions: [{ date: weekKey }, { date: weekKey }],
    });
    expect(getStreakSummary(app).currentWeekCount).toBe(2);
  });
});
