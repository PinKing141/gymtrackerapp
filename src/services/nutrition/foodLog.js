import { nutritionForAmount, roundNutrition } from "./nutritionMath.js";

export const MEAL_TYPES = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "snack", label: "Snack" },
];

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function getDefaultMealType(now = new Date()) {
  const hour = now.getHours();
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}

export function createFoodLogEntry({ food, amount, mealType, date }) {
  const source = food.source || "cofid";
  const nutrition = nutritionForAmount(food, amount);
  const entry = {
    id: createId("food-log"),
    date,
    mealType,
    source,
    foodName: food.food_name || food.name || "Food",
    amount: roundNutrition(amount),
    unit: food.serving_unit === "ml" ? "ml" : "g",
    ...nutrition,
    createdAt: new Date().toISOString(),
  };

  if (source === "custom") {
    entry.customFoodId = food.id || food.food_id;
  } else {
    entry.foodId = food.food_id || food.id;
  }

  return entry;
}

export function createQuickAddLogEntry({ name, calories, protein, carbs, fat, mealType, date }) {
  return {
    id: createId("food-log"),
    date,
    mealType,
    source: "quick_add",
    foodName: name?.trim() || "Quick add",
    amount: 1,
    unit: "serving",
    calories: Math.round(numeric(calories)),
    protein: roundNutrition(protein),
    carbs: roundNutrition(carbs),
    fat: roundNutrition(fat),
    sugar: 0,
    fibre: 0,
    salt: 0,
    createdAt: new Date().toISOString(),
  };
}

export function repeatFoodLogEntry(entry, date) {
  return {
    ...entry,
    id: createId("food-log"),
    date,
    createdAt: new Date().toISOString(),
  };
}

export function getRecentFoodLogs(logs = [], limit = 8) {
  const seen = new Set();
  return [...logs]
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .filter((entry) => {
      const key = `${entry.source}:${entry.foodId || entry.customFoodId || entry.foodName}:${entry.amount}:${entry.unit}:${entry.mealType}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}
