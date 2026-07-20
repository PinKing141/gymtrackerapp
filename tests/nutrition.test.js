import { afterEach, describe, expect, it, vi } from "vitest";
import { getNutritionTargets } from "../src/services/nutrition/nutritionTargets.js";
import { lookupByBarcode, mapOffProduct, normalizeBarcode } from "../src/services/nutrition/openFoodFacts.js";
import { createFoodLogEntry, createQuickAddLogEntry } from "../src/services/nutrition/foodLog.js";

const PROFILE = { age: 25, sex: "male", heightCm: 180, weightKg: 80, goal: "bulk", activityLevel: "moderate" };

describe("nutrition targets", () => {
  it("derives calorie and macro targets from the profile", () => {
    const targets = getNutritionTargets(PROFILE);
    expect(targets.calorieTarget).toBeGreaterThan(2000);
    expect(targets.proteinTarget).toBe(Math.round(80 * 2));
    expect(targets.fatTarget).toBeGreaterThan(0);
    expect(targets.carbsTarget).toBeGreaterThan(0);
  });

  it("prefers explicit overrides", () => {
    const targets = getNutritionTargets(PROFILE, { calorieTarget: 2500, proteinTarget: 150 });
    expect(targets.calorieTarget).toBe(2500);
    expect(targets.proteinTarget).toBe(150);
  });

  it("returns zeroes without enough profile data", () => {
    expect(getNutritionTargets({}).calorieTarget).toBe(0);
  });
});

describe("barcode lookup", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("normalizes scanner noise out of barcodes", () => {
    expect(normalizeBarcode(" 50-1234 5678 ")).toBe("5012345678");
  });

  it("maps an Open Food Facts product to the app's food shape", () => {
    const { food, complete } = mapOffProduct(
      {
        product_name: "Peanut Butter",
        brands: "NutCo, OtherBrand",
        nutriments: { "energy-kcal_100g": 600, proteins_100g: 25, carbohydrates_100g: 20, fat_100g: 50 },
      },
      "5012345678900"
    );
    expect(complete).toBe(true);
    expect(food.food_name).toBe("Peanut Butter");
    expect(food.brand).toBe("NutCo");
    expect(food.calories_per_100g).toBe(600);
  });

  it("converts kJ energy when kcal is missing", () => {
    const { food } = mapOffProduct({ product_name: "Juice", nutriments: { energy_100g: 418.4 } }, "1234567890");
    expect(food.calories_per_100g).toBe(100);
  });

  it("returns found for a product with nutrition", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ status: 1, product: { product_name: "Oats", nutriments: { "energy-kcal_100g": 370 } } }),
    })));
    const result = await lookupByBarcode("5000000000000");
    expect(result.status).toBe("found");
    expect(result.food.food_name).toBe("Oats");
  });

  it("returns not_found when the product doesn't exist", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ status: 0 }) })));
    expect((await lookupByBarcode("5000000000000")).status).toBe("not_found");
  });

  it("returns a friendly error when offline", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    const result = await lookupByBarcode("5000000000000");
    expect(result.status).toBe("error");
    expect(result.error).toMatch(/connection/i);
  });

  it("rejects too-short barcodes without a network call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect((await lookupByBarcode("123")).status).toBe("error");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("food logging", () => {
  it("creates a log entry with scaled nutrition", () => {
    const food = {
      source: "custom",
      id: "custom-1",
      food_name: "Rice",
      serving_unit: "g",
      calories_per_100g: 130,
      protein_per_100g: 2.7,
      carbs_per_100g: 28,
      fat_per_100g: 0.3,
    };
    const entry = createFoodLogEntry({ food, amount: 200, mealType: "dinner", date: "2026-07-20" });
    expect(entry.calories).toBe(260);
    expect(entry.mealType).toBe("dinner");
    expect(entry.customFoodId).toBe("custom-1");
  });

  it("creates quick-add entries from bare macros", () => {
    const entry = createQuickAddLogEntry({ name: "Shake", calories: 220, protein: 30, carbs: 10, fat: 5, mealType: "snack", date: "2026-07-20" });
    expect(entry.calories).toBe(220);
    expect(entry.source).toBe("quick_add");
  });
});
