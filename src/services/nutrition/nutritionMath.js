const NUTRIENT_FIELDS = ["calories", "protein", "carbs", "fat", "sugar", "fibre", "salt"];

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function roundNutrition(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(numeric(value) * factor) / factor;
}

export function getPer100(food = {}) {
  return {
    calories: numeric(food.calories_per_100g),
    protein: numeric(food.protein_per_100g),
    carbs: numeric(food.carbs_per_100g),
    fat: numeric(food.fat_per_100g),
    sugar: numeric(food.sugar_per_100g),
    fibre: numeric(food.fibre_per_100g),
    salt: numeric(food.salt_per_100g),
  };
}

export function nutritionForAmount(food, amountGrams) {
  const factor = numeric(amountGrams) / 100;
  const per100 = getPer100(food);

  return {
    calories: roundNutrition(per100.calories * factor, 0),
    protein: roundNutrition(per100.protein * factor),
    carbs: roundNutrition(per100.carbs * factor),
    fat: roundNutrition(per100.fat * factor),
    sugar: roundNutrition(per100.sugar * factor),
    fibre: roundNutrition(per100.fibre * factor),
    salt: roundNutrition(per100.salt * factor),
  };
}

export function emptyNutritionTotals() {
  return Object.fromEntries(NUTRIENT_FIELDS.map((field) => [field, 0]));
}

export function sumNutrition(entries = []) {
  const totals = emptyNutritionTotals();

  entries.forEach((entry) => {
    NUTRIENT_FIELDS.forEach((field) => {
      totals[field] += numeric(entry[field]);
    });
  });

  return {
    calories: Math.round(totals.calories),
    protein: roundNutrition(totals.protein),
    carbs: roundNutrition(totals.carbs),
    fat: roundNutrition(totals.fat),
    sugar: roundNutrition(totals.sugar),
    fibre: roundNutrition(totals.fibre),
    salt: roundNutrition(totals.salt),
  };
}

export function getProgressRatio(value, target) {
  const targetNumber = numeric(target);
  if (!targetNumber) return 0;
  return Math.max(0, Math.min(1.25, numeric(value) / targetNumber));
}

export function toPer100FromServing({ servingSize, calories, protein, carbs, fat, sugar, fibre, salt }) {
  const serving = Math.max(1, numeric(servingSize));
  const factor = 100 / serving;
  return {
    calories_per_100g: roundNutrition(numeric(calories) * factor, 0),
    protein_per_100g: roundNutrition(numeric(protein) * factor),
    carbs_per_100g: roundNutrition(numeric(carbs) * factor),
    fat_per_100g: roundNutrition(numeric(fat) * factor),
    sugar_per_100g: roundNutrition(numeric(sugar) * factor),
    fibre_per_100g: roundNutrition(numeric(fibre) * factor),
    salt_per_100g: roundNutrition(numeric(salt) * factor),
  };
}
