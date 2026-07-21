import { getPer100, roundNutrition } from "./nutritionMath.js";

// Recipe builder: ingredients in raw grams + total cooked weight + servings
// → a loggable food with accurate per-100g and per-serving nutrition.
// Cooking changes weight (water in/out) but not the nutrient totals, which is
// why the cooked weight matters for homemade meals.

function createId() {
  return `recipe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function ingredientFromFood(food, grams) {
  return {
    name: food.food_name || food.name || "Ingredient",
    grams: numeric(grams) || 100,
    per100: getPer100(food),
  };
}

export function getRecipeTotals(ingredients = []) {
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, fibre: 0, salt: 0 };
  let rawWeight = 0;
  ingredients.forEach((ingredient) => {
    const grams = numeric(ingredient.grams);
    rawWeight += grams;
    const per100 = ingredient.per100 || {};
    Object.keys(totals).forEach((field) => {
      totals[field] += (Number(per100[field]) || 0) * (grams / 100);
    });
  });
  return { totals, rawWeightG: rawWeight };
}

// Build the loggable recipe food. `cookedWeightG` defaults to the raw total
// when the user doesn't weigh the finished dish.
export function createRecipeFood({ name, ingredients = [], cookedWeightG, servings }) {
  const { totals, rawWeightG } = getRecipeTotals(ingredients);
  const cooked = numeric(cookedWeightG) || rawWeightG;
  const portionCount = Math.max(1, Math.round(numeric(servings)) || 1);
  if (!name?.trim() || !ingredients.length || cooked <= 0) {
    return null;
  }

  const factor = 100 / cooked;
  return {
    id: createId(),
    source: "recipe",
    food_name: name.trim(),
    name: name.trim(),
    brand: "",
    food_group: "My recipes",
    serving_unit: "g",
    serving_size: roundNutrition(cooked / portionCount, 0),
    calories_per_100g: roundNutrition(totals.calories * factor, 0),
    protein_per_100g: roundNutrition(totals.protein * factor),
    carbs_per_100g: roundNutrition(totals.carbs * factor),
    fat_per_100g: roundNutrition(totals.fat * factor),
    sugar_per_100g: roundNutrition(totals.sugar * factor),
    fibre_per_100g: roundNutrition(totals.fibre * factor),
    salt_per_100g: roundNutrition(totals.salt * factor),
    recipe: {
      ingredients: ingredients.map((ingredient) => ({
        name: ingredient.name,
        grams: numeric(ingredient.grams),
        per100: { ...ingredient.per100 },
      })),
      cookedWeightG: cooked,
      rawWeightG,
      servings: portionCount,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function getPerServing(recipeFood) {
  const servingGrams = Number(recipeFood?.serving_size) || 0;
  if (!servingGrams) return null;
  const factor = servingGrams / 100;
  return {
    grams: servingGrams,
    calories: Math.round((Number(recipeFood.calories_per_100g) || 0) * factor),
    protein: roundNutrition((Number(recipeFood.protein_per_100g) || 0) * factor),
    carbs: roundNutrition((Number(recipeFood.carbs_per_100g) || 0) * factor),
    fat: roundNutrition((Number(recipeFood.fat_per_100g) || 0) * factor),
  };
}
