import { repeatFoodLogEntry } from "./foodLog.js";
import { sumNutrition } from "./nutritionMath.js";

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createSavedMealFromLogs(name, entries = []) {
  const items = entries.map((entry) => ({
    source: entry.source,
    foodId: entry.foodId || null,
    customFoodId: entry.customFoodId || null,
    foodName: entry.foodName,
    amount: entry.amount,
    unit: entry.unit,
    calories: entry.calories,
    protein: entry.protein,
    carbs: entry.carbs,
    fat: entry.fat,
    sugar: entry.sugar,
    fibre: entry.fibre,
    salt: entry.salt,
    mealType: entry.mealType,
  }));
  const totals = sumNutrition(items);

  return {
    id: createId("saved-meal"),
    name: name.trim(),
    items,
    totalCalories: totals.calories,
    totalProtein: totals.protein,
    totalCarbs: totals.carbs,
    totalFat: totals.fat,
    servings: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createFoodLogsFromSavedMeal(savedMeal, date, mealType) {
  return (savedMeal.items || []).map((item) =>
    repeatFoodLogEntry(
      {
        ...item,
        id: createId("food-log"),
        date,
        mealType: mealType || item.mealType || "lunch",
        createdAt: new Date().toISOString(),
      },
      date,
    ),
  );
}
