const FOOD_DATA_PATH = "data/foods_core_app.json";

function publicDataUrl(path) {
  const base = import.meta.env.BASE_URL || "/";
  return `${base.endsWith("/") ? base : `${base}/`}${path}`;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getFoodName(food = {}) {
  return food.food_name || food.name || "";
}

function scoreFood(food, query) {
  const name = normalizeText(getFoodName(food));
  const group = normalizeText(food.food_group || food.brand || food.food_group_code);
  const haystack = `${name} ${group}`;
  const terms = normalizeText(query).split(" ").filter(Boolean);

  if (!terms.length) return 0;
  if (name === terms.join(" ")) return 1000;
  if (name.startsWith(terms.join(" "))) return 800;

  let score = 0;
  terms.forEach((term) => {
    if (name.startsWith(term)) score += 120;
    else if (name.includes(` ${term}`)) score += 80;
    else if (haystack.includes(term)) score += 35;
  });

  return terms.every((term) => haystack.includes(term)) ? score : 0;
}

export async function loadFoodDatabase() {
  const response = await fetch(publicDataUrl(FOOD_DATA_PATH));
  if (!response.ok) {
    throw new Error("Food database could not be loaded.");
  }
  return response.json();
}

export function searchFoods({ foods = [], customFoods = [], query = "", limit = 30 }) {
  const normalizedQuery = normalizeText(query);
  if (normalizedQuery.length < 2) {
    return [];
  }

  const customResults = customFoods
    .map((food) => ({ ...food, source: "custom", _score: scoreFood(food, normalizedQuery) + 50 }))
    .filter((food) => food._score > 50);

  const cofidResults = foods
    .map((food) => ({ ...food, source: "cofid", _score: scoreFood(food, normalizedQuery) }))
    .filter((food) => food._score > 0);

  return [...customResults, ...cofidResults]
    .sort((a, b) => b._score - a._score || getFoodName(a).localeCompare(getFoodName(b)))
    .slice(0, limit)
    .map(({ _score, ...food }) => food);
}

export function getFoodDisplayName(food = {}) {
  return getFoodName(food) || "Food";
}

export function getFoodMeta(food = {}) {
  if (food.source === "custom") {
    return [food.brand, "Custom food"].filter(Boolean).join(" · ");
  }

  const group = String(food.food_group || "").trim();
  if (group && !/^CoFID group\s+[A-Z0-9]+$/i.test(group)) {
    return group;
  }

  return "Food database";
}
