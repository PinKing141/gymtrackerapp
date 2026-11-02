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

describe("all training types count", () => {
  const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  it("counts cardio and basketball toward this week's target", () => {
    const weekKey = getWeekKey();
    const app = withDefaults({
      ...DD(),
      sessions: [{ date: weekKey }],
      cardioSessions: [{ date: weekKey, durationMin: 30 }],
      basketballSessions: [{ date: weekKey, shots: [] }],
    });
    expect(getStreakSummary(app).currentWeekCount).toBe(3);
  });

  it("measures days since training from the most recent activity of any type", () => {
    const app = withDefaults({
      ...DD(),
      sessions: [{ date: daysAgo(10) }, { date: daysAgo(6) }],
      cardioSessions: [{ date: daysAgo(1), durationMin: 20 }, { date: daysAgo(4), durationMin: 20 }],
    });
    expect(getStreakSummary(app).daysSinceLastSession).toBe(1);
  });

  it("uses the latest gym date even when sessions are out of order", () => {
    const app = withDefaults({ ...DD(), sessions: [{ date: daysAgo(2) }, { date: daysAgo(9) }] });
    expect(getStreakSummary(app).daysSinceLastSession).toBe(2);
  });

  it("reports null when nothing has been logged", () => {
    expect(getStreakSummary(DD()).daysSinceLastSession).toBeNull();
  });
});
