import { today } from "./storage.js";
import { getNutritionTargets } from "./services/nutrition/nutritionTargets.js";
import { getStreakSummary } from "./streaks.js";
import { getWorkoutPresets } from "./workouts.js";

// "What should I do today?" calculators for the Home dashboard. Everything in
// here is a pure function of app data — transparent rules, no diagnosis.

export const WATER_TARGET_LITRES = 4;
export const WEIGH_IN_INTERVAL_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(fromDate, toDate) {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return Math.round((to - from) / DAY_MS);
}

function entriesOn(list, date) {
  return (list || []).filter((entry) => entry?.date === date);
}

function latestWithin(list, date, maxAgeDays) {
  let best = null;
  let bestAge = Infinity;
  (list || []).forEach((entry) => {
    const age = daysBetween(entry?.date, date);
    if (age === null || age < 0 || age > maxAgeDays) return;
    if (age < bestAge) {
      best = entry;
      bestAge = age;
    }
  });
  return best ? { entry: best, ageDays: bestAge } : null;
}

function scale(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
}

// ---------------------------------------------------------------------------
// Readiness

const READINESS_LEVELS = {
  unknown: { label: "No recent check-in", tone: "muted" },
  ready: { label: "Ready to train", tone: "success" },
  normal: { label: "Train normally", tone: "success" },
  reduce: { label: "Consider reducing volume", tone: "warning" },
  recovery: { label: "Consider a recovery day", tone: "danger" },
};

// Transparent readiness suggestion from the athlete's own check-ins: recent
// sleep, joints, perceived recovery/motivation, pain flags and workload.
// Weights: 1 = worth watching, 2 = strong signal.
export function getReadiness(app, date = today()) {
  const recent = latestWithin(app?.recovery, date, 1);
  const recovery = recent?.entry || null;

  const lastThreeDays = (app?.sessions || []).filter((session) => {
    const age = daysBetween(session?.date, date);
    return age !== null && age >= 0 && age <= 2;
  });
  const lastSession = latestWithin(app?.sessions, date, 2)?.entry || null;

  if (!recovery && !lastSession) {
    return {
      level: "unknown",
      ...READINESS_LEVELS.unknown,
      reasons: [],
      suggestion: "Log a recovery check-in so Orion can suggest how hard to go today.",
      avoidHighImpact: false,
    };
  }

  const reasons = [];
  let score = 0;
  let avoidHighImpact = false;

  if (recovery) {
    const sleep = Number(recovery.sleep);
    if (Number.isFinite(sleep) && sleep > 0 && sleep < 6) {
      const strong = sleep < 5;
      score += strong ? 2 : 1;
      reasons.push(`You reported ${strong ? "very short" : "poor"} sleep (${sleep}h).`);
    }

    const joints = scale(recovery.jointCondition);
    if (joints !== null && joints >= 3) {
      const strong = joints >= 4;
      score += strong ? 2 : 1;
      if (strong) avoidHighImpact = true;
      reasons.push(strong ? "You reported painful or movement-affecting joints." : "You reported noticeable joint stiffness.");
    }

    const recoveredFeel = scale(recovery.recoveryState);
    if (recoveredFeel !== null && recoveredFeel >= 4) {
      score += recoveredFeel === 5 ? 2 : 1;
      reasons.push(`You reported feeling ${recoveredFeel === 5 ? "drained" : "heavy"}.`);
    }

    const motivation = scale(recovery.motivationState);
    if (motivation !== null && motivation >= 4) {
      score += 1;
      reasons.push("You reported low motivation — a shorter session still counts.");
    }
  }

  if (lastSession?.painFlags) {
    const flagged = Object.entries(lastSession.painFlags).filter(([, value]) => Number(value) >= 4);
    if (flagged.length) {
      score += 2;
      avoidHighImpact = true;
      reasons.push(`Your last workout flagged pain (${flagged.map(([part]) => part).join(", ")}).`);
    }
  }

  if (lastThreeDays.length >= 3) {
    score += 2;
    reasons.push(`You've trained ${lastThreeDays.length} times in the last 3 days.`);
  } else if (lastThreeDays.length === 2) {
    score += 1;
    reasons.push("You've trained on back-to-back days.");
  }

  let level = "ready";
  if (score >= 4) level = "recovery";
  else if (score >= 2) level = "reduce";
  else if (score >= 1) level = "normal";

  const suggestionByLevel = {
    ready: "All clear from your recent check-ins. Train as planned.",
    normal: "Nothing serious — train as planned and keep an eye on it.",
    reduce: "Based on what you reported, consider reducing volume or intensity today.",
    recovery: "Based on what you reported, an easy or recovery day looks like the better call.",
  };

  return {
    level,
    ...READINESS_LEVELS[level],
    reasons,
    suggestion: avoidHighImpact
      ? `${suggestionByLevel[level]} Avoid high-impact work (jumping, sprinting) while joints are flagged.`
      : suggestionByLevel[level],
    avoidHighImpact,
  };
}

// ---------------------------------------------------------------------------
// Today's plan

function nextWorkoutSuggestion(app) {
  const presets = getWorkoutPresets(app);
  if (!presets.length) {
    return { title: "Plan a gym workout", detail: "Build your first workout preset" };
  }

  const lastGymSession = [...(app?.sessions || [])].reverse().find((session) => session?.workoutId);
  const lastIndex = presets.findIndex((preset) => preset.id === lastGymSession?.workoutId);
  const next = presets[(lastIndex + 1) % presets.length];
  return { title: next.title, detail: "Suggested next workout", workoutId: next.id };
}

// The day's actionable items, each mapped to the screen that completes it.
export function getTodayPlan(app, date = today()) {
  const items = [];
  const profile = app?.profile || {};
  const modules = profile.enabledModules || {};

  const gymDone = entriesOn(app?.sessions, date).length > 0;
  const suggestion = nextWorkoutSuggestion(app);
  items.push({
    key: "workout",
    title: gymDone ? "Gym workout" : suggestion.title,
    detail: gymDone ? "Done today" : suggestion.detail,
    done: gymDone,
    view: "train",
  });

  if (modules.basketball) {
    const ballDone = entriesOn(app?.basketballSessions, date).length > 0;
    items.push({
      key: "basketball",
      title: "Basketball session",
      detail: ballDone ? "Done today" : "Shooting or skills work",
      done: ballDone,
      view: "basketball",
    });
  }

  const recoveryEntry = entriesOn(app?.recovery, date)[0] || null;
  items.push({
    key: "recovery",
    title: "Recovery check-in",
    detail: recoveryEntry
      ? `${recoveryEntry.sleep}h sleep · ${recoveryEntry.water}L water`
      : "Sleep, hydration, joints & mobility",
    done: Boolean(recoveryEntry),
    view: "recovery",
  });

  const targets = getNutritionTargets(profile, app?.nutrition?.targets || {});
  if (targets.calorieTarget > 0) {
    const dayLogs = entriesOn(app?.nutrition?.foodLogs, date);
    const calories = Math.round(dayLogs.reduce((sum, entry) => sum + (Number(entry.calories) || 0), 0));
    const protein = Math.round(dayLogs.reduce((sum, entry) => sum + (Number(entry.protein) || 0), 0));
    const caloriesLeft = Math.max(0, targets.calorieTarget - calories);
    const proteinLeft = Math.max(0, targets.proteinTarget - protein);
    const done = dayLogs.length > 0 && caloriesLeft === 0 && proteinLeft === 0;
    items.push({
      key: "nutrition",
      title: "Nutrition targets",
      detail: done
        ? "Calorie and protein targets hit"
        : `${caloriesLeft} kcal · ${proteinLeft}g protein remaining`,
      done,
      view: "nutrition",
    });
  }

  const lastWeighIn = latestWithin(app?.bodyStats, date, 365);
  const weighInDue = !lastWeighIn || lastWeighIn.ageDays >= WEIGH_IN_INTERVAL_DAYS;
  if (weighInDue) {
    items.push({
      key: "weighIn",
      title: "Bodyweight check-in",
      detail: lastWeighIn ? `Last weigh-in ${lastWeighIn.ageDays} days ago` : "No weigh-ins yet",
      done: false,
      view: "bodystats",
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Daily completion checklist

export function getDailyChecklist(app, date = today()) {
  const profile = app?.profile || {};
  const dayLogs = entriesOn(app?.nutrition?.foodLogs, date);
  const recoveryEntry = entriesOn(app?.recovery, date)[0] || null;
  const targets = getNutritionTargets(profile, app?.nutrition?.targets || {});
  const protein = dayLogs.reduce((sum, entry) => sum + (Number(entry.protein) || 0), 0);
  const water = Number(recoveryEntry?.water) || 0;

  const items = [
    { key: "workout", label: "Workout", done: entriesOn(app?.sessions, date).length > 0 },
    { key: "food", label: "Nutrition logged", done: dayLogs.length > 0 },
  ];

  if (targets.proteinTarget > 0) {
    items.push({
      key: "protein",
      label: "Protein target",
      done: protein >= targets.proteinTarget,
      detail: `${Math.round(protein)}/${targets.proteinTarget}g`,
    });
  }

  items.push(
    {
      key: "water",
      label: "Water target",
      done: water >= WATER_TARGET_LITRES,
      detail: `${water.toFixed(1)}/${WATER_TARGET_LITRES.toFixed(1)}L`,
    },
    { key: "recovery", label: "Recovery check-in", done: Boolean(recoveryEntry) },
    { key: "mobility", label: "Mobility", done: Boolean(recoveryEntry?.mobilityDone) },
  );

  return items;
}

export function getChecklistProgress(items) {
  const done = items.filter((item) => item.done).length;
  return { done, total: items.length, percent: items.length ? Math.round((done / items.length) * 100) : 0 };
}

// Re-exported so the dashboard card can show workload context without
// recomputing it elsewhere.
export { getStreakSummary };
