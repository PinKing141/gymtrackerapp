import { calculateCalories } from "../../units.js";

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function proteinMultiplier(goal) {
  if (goal === "cut") return 2.1;
  if (goal === "bulk") return 2;
  return 1.8;
}

export function getNutritionTargets(profile = {}, overrides = {}) {
  const safeOverrides = overrides && typeof overrides === "object" ? overrides : {};
  const calorieStats = calculateCalories(profile);
  const calories = numeric(safeOverrides.calorieTarget) || calorieStats?.target || 0;
  const weightKg = numeric(profile.weightKg);
  const protein = numeric(safeOverrides.proteinTarget) || (weightKg ? Math.round(weightKg * proteinMultiplier(profile.goal)) : 0);
  const fat = numeric(safeOverrides.fatTarget) || (calories ? Math.round((calories * 0.25) / 9) : 0);
  const carbs = numeric(safeOverrides.carbsTarget) || (calories ? Math.max(0, Math.round((calories - (protein * 4) - (fat * 9)) / 4)) : 0);

  return {
    calorieTarget: Math.round(calories),
    proteinTarget: protein,
    carbsTarget: carbs,
    fatTarget: fat,
    fibreTarget: numeric(safeOverrides.fibreTarget) || 30,
    saltLimit: numeric(safeOverrides.saltLimit) || 6,
    bmr: calorieStats?.bmr || 0,
  };
}
