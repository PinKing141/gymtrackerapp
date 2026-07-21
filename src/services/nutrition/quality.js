import { getPer100 } from "./nutritionMath.js";

// Product-data quality checks. Open Food Facts is community data: usually
// good, sometimes incomplete or entered per-serving instead of per-100g.
// Every rule here is a plain-language explanation, not a verdict.

const ATWATER = { protein: 4, carbs: 4, fat: 9 };

export function assessFoodQuality(food = {}) {
  const per100 = getPer100(food);
  const issues = [];

  const macroSum = per100.protein + per100.carbs + per100.fat;
  const expectedCalories = per100.protein * ATWATER.protein + per100.carbs * ATWATER.carbs + per100.fat * ATWATER.fat;

  if (per100.calories > 0 && macroSum === 0) {
    issues.push("No macro breakdown — protein, carbs and fat are all missing.");
  }

  if (per100.calories > 900) {
    issues.push(`${Math.round(per100.calories)} kcal per 100g isn't physically possible (pure fat is ~900). The data may be per serving, not per 100g.`);
  }

  if (macroSum > 105) {
    issues.push(`Macros add up to ${Math.round(macroSum)}g per 100g of food — more than the food itself.`);
  }

  if (per100.calories >= 20 && expectedCalories >= 20) {
    const ratio = Math.abs(per100.calories - expectedCalories) / Math.max(per100.calories, expectedCalories);
    if (ratio > 0.3) {
      issues.push(`Stated calories (${Math.round(per100.calories)}) don't match the macros (≈${Math.round(expectedCalories)} kcal). One of them is likely wrong.`);
    }
  } else if (per100.calories < 20 && expectedCalories >= 40) {
    issues.push(`Calories look missing — the macros imply ≈${Math.round(expectedCalories)} kcal per 100g.`);
  }

  const consistent = issues.length === 0 && per100.calories > 0 && macroSum > 0;

  return {
    status: issues.length ? "warning" : "ok",
    issues,
    verifiedLooking: consistent,
    note: consistent ? "Nutrition looks consistent — calories match the macro breakdown." : null,
  };
}
