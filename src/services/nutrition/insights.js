import { ACTIVITY_OPTIONS, calculateCalories } from "../../units.js";
import { getNutritionTargets } from "./nutritionTargets.js";
import { sumNutrition } from "./nutritionMath.js";

// Weekly nutrition view: daily numbers fluctuate, weekly averages tell the
// truth. Everything explains its own basis — no hidden modelling.

const KCAL_PER_KG = 7700;
const CONSISTENCY_BAND = 0.1; // within ±10% of the calorie target counts

function shiftDate(dateString, days) {
  const parsed = new Date(`${dateString}T00:00:00`);
  parsed.setDate(parsed.getDate() + days);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

export function getWeeklyNutritionSummary(app, endDate) {
  const logs = app?.nutrition?.foodLogs || [];
  const profile = app?.profile || {};
  const targets = getNutritionTargets(profile, app?.nutrition?.targets || {});

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = shiftDate(endDate, index - 6);
    const dayLogs = logs.filter((entry) => entry.date === date);
    const totals = sumNutrition(dayLogs);
    return { date, logged: dayLogs.length > 0, calories: totals.calories, protein: totals.protein };
  });

  const loggedDays = days.filter((day) => day.logged);
  const avgCalories = loggedDays.length
    ? Math.round(loggedDays.reduce((sum, day) => sum + day.calories, 0) / loggedDays.length)
    : 0;
  const avgProtein = loggedDays.length
    ? Math.round(loggedDays.reduce((sum, day) => sum + day.protein, 0) / loggedDays.length)
    : 0;

  // Consistency: share of the 7 days that were logged AND landed within ±10%
  // of the calorie target (just "logged" when no target is set).
  const consistentDays = days.filter((day) => {
    if (!day.logged) return false;
    if (!targets.calorieTarget) return true;
    return Math.abs(day.calories - targets.calorieTarget) <= targets.calorieTarget * CONSISTENCY_BAND;
  });
  const consistencyPercent = Math.round((consistentDays.length / 7) * 100);

  // Estimated weight trend from average intake vs estimated maintenance.
  // Only offered with enough data, and always labelled as an estimate.
  const calorieStats = calculateCalories(profile);
  const activityFactor = ACTIVITY_OPTIONS.find((option) => option.value === profile.activityLevel)?.factor || 1.55;
  const maintenance = calorieStats ? Math.round(calorieStats.bmr * activityFactor) : 0;
  let trend = null;
  if (maintenance > 0 && loggedDays.length >= 4) {
    const dailyDelta = avgCalories - maintenance;
    const kgPerWeek = Math.round(((dailyDelta * 7) / KCAL_PER_KG) * 100) / 100;
    trend = {
      kgPerWeek,
      text: `${kgPerWeek > 0 ? "+" : ""}${kgPerWeek} kg/week`,
      basis: `Based on ${avgCalories} kcal/day average vs ≈${maintenance} kcal estimated maintenance, over ${loggedDays.length} logged day${loggedDays.length === 1 ? "" : "s"}. An estimate, not a promise.`,
    };
  }

  return {
    days,
    loggedDayCount: loggedDays.length,
    avgCalories,
    avgProtein,
    calorieTarget: targets.calorieTarget,
    proteinTarget: targets.proteinTarget,
    consistencyPercent,
    trend,
  };
}
