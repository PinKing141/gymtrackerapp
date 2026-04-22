import { parseStoredDate, today } from "./storage.js";

export const DEFAULT_WEEKLY_TARGET = 3;
export const MAX_FREEZE_CREDITS = 3;

function pad(value) {
  return String(value).padStart(2, "0");
}

export function getWeekStart(value = today()) {
  const date = parseStoredDate(value) || new Date();
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() + diff);
  return result;
}

export function getWeekEnd(value = today()) {
  const start = getWeekStart(value);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function getWeekKey(value = today()) {
  const start = getWeekStart(value);
  return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
}

export function getWeekLabel(value = today()) {
  const start = getWeekStart(value);
  const end = getWeekEnd(value);
  return `${start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

export function createDefaultStreakState() {
  return {
    weeklyTarget: DEFAULT_WEEKLY_TARGET,
    freezeCredits: 1,
    frozenWeeks: [],
    rewardedWeeks: [],
  };
}

export function withStreakDefaults(streakState) {
  const base = createDefaultStreakState();
  return {
    ...base,
    ...(streakState || {}),
    frozenWeeks: Array.isArray(streakState?.frozenWeeks) ? streakState.frozenWeeks : base.frozenWeeks,
    rewardedWeeks: Array.isArray(streakState?.rewardedWeeks) ? streakState.rewardedWeeks : base.rewardedWeeks,
  };
}

export function getSessionsForWeek(sessions, weekKey) {
  return sessions.filter((session) => getWeekKey(session.date) === weekKey);
}

export function getWeekStatus(app, weekKey) {
  const streakState = withStreakDefaults(app?.streakState);
  const count = getSessionsForWeek(app?.sessions || [], weekKey).length;
  const frozen = streakState.frozenWeeks.includes(weekKey);
  const target = streakState.weeklyTarget || DEFAULT_WEEKLY_TARGET;
  return {
    count,
    frozen,
    complete: frozen || count >= target,
    target,
  };
}

function countConsecutiveWeeks(app, endWeekKey) {
  let streak = 0;
  let cursor = getWeekStart(endWeekKey);

  while (true) {
    const key = getWeekKey(cursor);
    const status = getWeekStatus(app, key);
    if (!status.complete) {
      return streak;
    }
    streak += 1;
    cursor.setDate(cursor.getDate() - 7);
  }
}

export function getStreakSummary(app) {
  const currentWeekKey = getWeekKey(today());
  const currentWeekStatus = getWeekStatus(app, currentWeekKey);
  const currentWeekEnd = getWeekEnd(today());
  const currentWeekLocked = currentWeekStatus.complete || Date.now() > currentWeekEnd.getTime();
  const anchorDate = currentWeekLocked ? currentWeekKey : getWeekKey(new Date(getWeekStart(today()).getTime() - 7 * 86400000));
  const currentStreak = countConsecutiveWeeks(app, anchorDate);
  const weeksSeen = new Set((app?.sessions || []).map((session) => getWeekKey(session.date)));
  withStreakDefaults(app?.streakState).frozenWeeks.forEach((key) => weeksSeen.add(key));

  let bestStreak = 0;
  Array.from(weeksSeen).sort().forEach((weekKey) => {
    bestStreak = Math.max(bestStreak, countConsecutiveWeeks(app, weekKey));
  });

  const lastSession = [...(app?.sessions || [])].reverse()[0] || null;
  const lastSessionDate = parseStoredDate(lastSession?.date);
  const daysSinceLastSession = lastSessionDate ? Math.floor((Date.now() - lastSessionDate.getTime()) / 86400000) : null;
  const streakState = withStreakDefaults(app?.streakState);

  return {
    currentStreak,
    bestStreak,
    currentWeekKey,
    currentWeekLabel: getWeekLabel(today()),
    currentWeekCount: currentWeekStatus.count,
    currentWeekComplete: currentWeekStatus.complete,
    currentWeekFrozen: currentWeekStatus.frozen,
    weeklyTarget: currentWeekStatus.target,
    freezeCredits: streakState.freezeCredits,
    canFreezeCurrentWeek: !currentWeekStatus.complete && streakState.freezeCredits > 0,
    daysSinceLastSession,
  };
}

export function applyWeeklyFreeze(app, weekKey = getWeekKey(today())) {
  const streakState = withStreakDefaults(app?.streakState);
  if (streakState.freezeCredits <= 0 || streakState.frozenWeeks.includes(weekKey)) {
    return app;
  }

  return {
    ...app,
    streakState: {
      ...streakState,
      freezeCredits: Math.max(0, streakState.freezeCredits - 1),
      frozenWeeks: [...streakState.frozenWeeks, weekKey],
    },
  };
}

export function rewardCompletedWeek(app, weekKey) {
  const streakState = withStreakDefaults(app?.streakState);
  if (streakState.rewardedWeeks.includes(weekKey)) {
    return app;
  }

  const status = getWeekStatus(app, weekKey);
  if (!status.complete) {
    return app;
  }

  return {
    ...app,
    streakState: {
      ...streakState,
      freezeCredits: Math.min(MAX_FREEZE_CREDITS, streakState.freezeCredits + 1),
      rewardedWeeks: [...streakState.rewardedWeeks, weekKey],
    },
  };
}
