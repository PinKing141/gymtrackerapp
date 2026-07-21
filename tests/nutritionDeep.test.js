import { describe, expect, it } from "vitest";
import { createRecipeFood, getPerServing, getRecipeTotals, ingredientFromFood } from "../src/services/nutrition/recipes.js";
import { computeAmount, getServingOptions } from "../src/services/nutrition/servings.js";
import { assessFoodQuality } from "../src/services/nutrition/quality.js";
import { getWeeklyNutritionSummary } from "../src/services/nutrition/insights.js";
import { DD, withDefaults } from "../src/storage.js";

const CHICKEN = { food_name: "Chicken breast", calories_per_100g: 165, protein_per_100g: 31, carbs_per_100g: 0, fat_per_100g: 3.6 };
const RICE = { food_name: "Rice (dry)", calories_per_100g: 360, protein_per_100g: 7, carbs_per_100g: 78, fat_per_100g: 1 };

describe("recipe builder", () => {
  it("computes per-serving nutrition from ingredients, cooked weight and servings", () => {
    const recipe = createRecipeFood({
      name: "Chicken & rice prep",
      ingredients: [ingredientFromFood(CHICKEN, 500), ingredientFromFood(RICE, 200)],
      cookedWeightG: 1000, // rice absorbs water while cooking
      servings: 4,
    });

    // Totals: chicken 825 kcal + rice 720 kcal = 1545 kcal over 1000g cooked.
    expect(recipe.calories_per_100g).toBe(155);
    expect(recipe.serving_size).toBe(250);
    const perServing = getPerServing(recipe);
    expect(perServing.calories).toBe(388); // ≈1545/4, via the rounded per-100 value
    expect(perServing.protein).toBeCloseTo(42.3, 0);
    expect(recipe.recipe.servings).toBe(4);
    expect(recipe.recipe.ingredients).toHaveLength(2);
  });

  it("defaults cooked weight to the raw ingredient total", () => {
    const { rawWeightG } = getRecipeTotals([ingredientFromFood(CHICKEN, 300)]);
    expect(rawWeightG).toBe(300);
    const recipe = createRecipeFood({ name: "Just chicken", ingredients: [ingredientFromFood(CHICKEN, 300)], servings: 2 });
    expect(recipe.recipe.cookedWeightG).toBe(300);
    expect(recipe.calories_per_100g).toBe(165);
  });

  it("rejects empty recipes", () => {
    expect(createRecipeFood({ name: "", ingredients: [ingredientFromFood(CHICKEN, 100)] })).toBeNull();
    expect(createRecipeFood({ name: "No food", ingredients: [] })).toBeNull();
  });
});

describe("serving controls", () => {
  it("offers grams, servings and count units", () => {
    const options = getServingOptions({ serving_unit: "g", serving_size: 45 });
    const ids = options.map((option) => option.id);
    expect(ids).toEqual(["g", "serving", "item", "slice", "scoop"]);
    expect(options.find((option) => option.id === "serving").gramsPerUnit).toBe(45);
  });

  it("uses millilitres for liquid foods", () => {
    expect(getServingOptions({ serving_unit: "ml" })[0].id).toBe("ml");
  });

  it("converts quantity × unit into grams, honouring custom per-unit weights", () => {
    const options = getServingOptions({ serving_unit: "g", serving_size: 30 });
    const scoop = options.find((option) => option.id === "scoop");
    expect(computeAmount(2, options[0])).toBe(2);
    expect(computeAmount(2, options.find((option) => option.id === "serving"))).toBe(60);
    expect(computeAmount(2, scoop, 32)).toBe(64); // user corrected scoop weight
    expect(computeAmount(0, scoop)).toBe(0);
  });
});

describe("product data quality", () => {
  it("marks consistent products as verified-looking", () => {
    const result = assessFoodQuality(CHICKEN);
    expect(result.status).toBe("ok");
    expect(result.verifiedLooking).toBe(true);
    expect(result.note).toMatch(/consistent/i);
  });

  it("flags missing macros", () => {
    const result = assessFoodQuality({ calories_per_100g: 250, protein_per_100g: 0, carbs_per_100g: 0, fat_per_100g: 0 });
    expect(result.status).toBe("warning");
    expect(result.issues.join(" ")).toMatch(/macro breakdown/i);
  });

  it("flags calorie/macro mismatch with the implied number", () => {
    const result = assessFoodQuality({ calories_per_100g: 100, protein_per_100g: 30, carbs_per_100g: 40, fat_per_100g: 20 });
    expect(result.issues.join(" ")).toMatch(/don't match the macros/i);
    expect(result.issues.join(" ")).toMatch(/460/);
  });

  it("flags per-serving vs per-100g confusion", () => {
    const result = assessFoodQuality({ calories_per_100g: 1200, protein_per_100g: 10, carbs_per_100g: 10, fat_per_100g: 10 });
    expect(result.issues.join(" ")).toMatch(/per serving, not per 100g/i);
  });

  it("flags impossible macro sums", () => {
    const result = assessFoodQuality({ calories_per_100g: 500, protein_per_100g: 60, carbs_per_100g: 60, fat_per_100g: 10 });
    expect(result.issues.join(" ")).toMatch(/more than the food itself/i);
  });
});

describe("weekly nutrition view", () => {
  const PROFILE = { age: 25, sex: "male", heightCm: 180, weightKg: 80, goal: "maintain", activityLevel: "moderate", onboardingComplete: true };

  function appWithWeek(caloriesByOffset) {
    const foodLogs = [];
    Object.entries(caloriesByOffset).forEach(([offset, calories]) => {
      const date = new Date("2026-07-20T00:00:00");
      date.setDate(date.getDate() - Number(offset));
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      foodLogs.push({ id: `log-${offset}`, date: dateStr, calories, protein: 150, mealType: "lunch" });
    });
    return withDefaults({ ...DD(), profile: PROFILE, nutrition: { foodLogs, customFoods: [], savedMeals: [], targets: null } });
  }

  it("averages only over logged days and reports consistency", () => {
    const app = appWithWeek({ 0: 2600, 1: 2700, 2: 2500, 3: 2600 });
    const summary = getWeeklyNutritionSummary(app, "2026-07-20");
    expect(summary.loggedDayCount).toBe(4);
    expect(summary.avgCalories).toBe(2600);
    expect(summary.avgProtein).toBe(150);
    expect(summary.consistencyPercent).toBeGreaterThan(0);
    expect(summary.consistencyPercent).toBeLessThanOrEqual(100);
  });

  it("estimates weight trend transparently once there is enough data", () => {
    const app = appWithWeek({ 0: 3300, 1: 3300, 2: 3300, 3: 3300 });
    const summary = getWeeklyNutritionSummary(app, "2026-07-20");
    expect(summary.trend).not.toBeNull();
    expect(summary.trend.kgPerWeek).toBeGreaterThan(0);
    expect(summary.trend.basis).toMatch(/estimated maintenance/i);
    expect(summary.trend.basis).toMatch(/estimate, not a promise/i);
  });

  it("withholds the trend with too few logged days", () => {
    const app = appWithWeek({ 0: 3300, 1: 3300 });
    expect(getWeeklyNutritionSummary(app, "2026-07-20").trend).toBeNull();
  });
});

describe("offline product cache & favourites persistence", () => {
  it("keeps barcodeCache and favourites through storage normalization", () => {
    const app = withDefaults({
      ...DD(),
      nutrition: {
        foodLogs: [],
        customFoods: [],
        savedMeals: [],
        favourites: ["custom-1", "5012345"],
        barcodeCache: { 5012345: { food_name: "Cached bar", calories_per_100g: 400 } },
        targets: null,
      },
    });
    expect(app.nutrition.favourites).toEqual(["custom-1", "5012345"]);
    expect(app.nutrition.barcodeCache["5012345"].food_name).toBe("Cached bar");
  });
});
