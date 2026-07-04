const FOOD_DATA_PATH = "data/foods_core_app.json";

const FOOD_NAME_REPLACEMENTS = [
  [/\bcommerical\b/gi, "commercial"],
  [/\bAgriculature\b/g, "Agriculture"],
  [/\bInsitute\b/g, "Institute"],
];

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

function cleanFoodDisplayName(value) {
  let title = String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*/g, ", ")
    .trim();

  FOOD_NAME_REPLACEMENTS.forEach(([pattern, replacement]) => {
    title = title.replace(pattern, replacement);
  });

  return title;
}

function capitalizeSegment(segment) {
  const text = String(segment || "").trim();
  if (!text) return "";
  // Leave existing casing intact after the first letter so "flesh only" ->
  // "Flesh only" but "UHT" / brand casing is preserved.
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Curated "Base, modifier" -> "Modifier base" swaps for common foods that read
// awkwardly when the base noun leads (e.g. "Apples, cooking" -> "Cooking apples").
// Keyed by the lowercased first segment; the array lists modifiers that should
// move in front of the base. Extend freely — unknown foods fall back to the
// plain title/detail split, so this table is purely additive polish.
const NAME_SWAP_BASES = {
  apples: ["cooking", "eating", "dried", "stewed", "baked"],
  pears: ["eating", "dried", "stewed"],
  potatoes: ["new", "old", "baked", "mashed", "boiled", "roast", "roasted", "sweet"],
  onions: ["red", "spring", "pickled", "fried"],
  rice: ["brown", "white", "basmati", "wild", "fried", "boiled"],
  bread: ["white", "brown", "wholemeal", "granary", "rye", "malted"],
  milk: ["whole", "semi-skimmed", "skimmed", "goats", "condensed", "evaporated", "soya", "oat"],
  cheese: ["hard", "soft", "cream", "cottage", "goats", "blue"],
  chicken: ["roast", "roasted", "grilled", "fried"],
  beef: ["minced", "roast", "roasted", "stewing", "lean"],
  pork: ["roast", "roasted", "minced", "lean"],
  pasta: ["white", "wholewheat", "fresh", "dried", "egg"],
  yogurt: ["greek", "natural", "plain", "low fat"],
  flour: ["plain", "self raising", "wholemeal", "strong white"],
  sugar: ["white", "brown", "caster", "icing", "demerara"],
  tomatoes: ["tinned", "canned", "cherry", "sun dried", "raw"],
  carrots: ["raw", "boiled", "roasted"],
  eggs: ["boiled", "fried", "poached", "scrambled"],
  beans: ["baked", "green", "kidney", "black", "broad", "runner"],
  mushrooms: ["raw", "fried", "button"],
};

// CoFID names pack everything into one comma string, e.g.
// "Apple juice concentrate, unsweetened, commercial". Split the first segment
// out as the title and turn the qualifiers into a readable detail line, applying
// the curated swap for common foods.
export function splitFoodName(rawName) {
  const cleaned = cleanFoodDisplayName(rawName);
  if (!cleaned) {
    return { title: "Food", detail: "" };
  }

  const segments = cleaned.split(",").map((segment) => segment.trim()).filter(Boolean);
  const baseKey = (segments[0] || "").toLowerCase();
  const modifier = (segments[1] || "").toLowerCase();
  const swaps = NAME_SWAP_BASES[baseKey];

  if (swaps && swaps.includes(modifier)) {
    const title = capitalizeSegment(`${segments[1]} ${segments[0].toLowerCase()}`);
    const detail = segments.slice(2).map(capitalizeSegment).filter(Boolean).join(" · ");
    return { title, detail };
  }

  const title = capitalizeSegment(segments[0] || cleaned) || "Food";
  const detail = segments.slice(1).map(capitalizeSegment).filter(Boolean).join(" · ");
  return { title, detail };
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
  return splitFoodName(getFoodName(food)).title;
}

export function getFoodDisplayDetail(food = {}) {
  return splitFoodName(getFoodName(food)).detail;
}

// Clean + split a raw stored log name (entry.foodName) the same way, so old
// saved entries render tidily without rewriting the stored data.
export function getLoggedFoodParts(rawName) {
  return splitFoodName(rawName);
}

// Source label for the little tag on a result card.
export function getFoodSourceLabel(food = {}) {
  return food.source === "custom" ? "Custom food" : "Food database";
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
