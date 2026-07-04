// Open Food Facts (OFF) barcode lookup. OFF is a second food source for
// branded/packaged products, sitting alongside the local CoFID database and the
// user's custom foods. We map OFF products into the app's existing per-100g food
// shape so the current Food Detail screen and nutrition maths work unchanged.
//
// Reads use the public v2 product endpoint (stable and CORS-enabled). OFF asks
// apps to send a custom User-Agent, which browsers forbid setting — a small
// proxy is the correct long-term home for that + caching. Direct reads are fine
// for this first slice.
const OFF_BASE = "https://world.openfoodfacts.org/api/v2/product";
const OFF_FIELDS = [
  "product_name",
  "brands",
  "nutriments",
  "serving_size",
  "serving_quantity",
  "quantity",
  "nutrition_data_per",
  "image_front_small_url",
].join(",");

const KJ_PER_KCAL = 4.184;

export function normalizeBarcode(input) {
  return String(input || "").replace(/\D/g, "");
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// OFF often omits energy-kcal_100g but includes energy_100g in kJ. Prefer kcal,
// fall back to converting kJ.
function resolveCalories(nutriments) {
  const kcal = num(nutriments["energy-kcal_100g"]);
  if (kcal !== null) return kcal;
  const kj = num(nutriments["energy_100g"]) ?? num(nutriments["energy-kj_100g"]);
  if (kj !== null) return Math.round(kj / KJ_PER_KCAL);
  return null;
}

// Guess grams vs millilitres from the packaging text (the maths is per-100
// either way, so this only affects the label the user sees).
function resolveUnit(product) {
  const hint = `${product.serving_size || ""} ${product.quantity || ""} ${product.nutrition_data_per || ""}`.toLowerCase();
  // Match a volume unit attached to a number ("200ml", "1 l", "33cl") plus the
  // spelled-out forms, without matching stray letters inside words.
  if (/\d\s?(ml|cl|l)\b/.test(hint) || /millilit|litre|liter/.test(hint) || /\d\s?ml\b/.test(hint)) {
    return "ml";
  }
  return "g";
}

// Map an OFF product into the app's food shape. Fields the maths reads:
// calories_per_100g / protein_per_100g / carbs_per_100g / fat_per_100g /
// sugar_per_100g / fibre_per_100g / salt_per_100g.
export function mapOffProduct(product = {}, barcode) {
  const nutriments = product.nutriments || {};
  const calories = resolveCalories(nutriments);
  const protein = num(nutriments.proteins_100g);
  const carbs = num(nutriments.carbohydrates_100g);
  const fat = num(nutriments.fat_100g);
  const unit = resolveUnit(product);

  const food = {
    source: "open_food_facts",
    food_id: barcode,
    id: barcode,
    food_name: (product.product_name || "").trim() || "Unnamed product",
    name: (product.product_name || "").trim() || "Unnamed product",
    brand: (product.brands || "").split(",")[0].trim(),
    food_group: "Open Food Facts",
    serving_unit: unit,
    serving_size: num(product.serving_quantity) || 100,
    image: product.image_front_small_url || "",
    calories_per_100g: calories ?? 0,
    protein_per_100g: protein ?? 0,
    carbs_per_100g: carbs ?? 0,
    fat_per_100g: fat ?? 0,
    sugar_per_100g: num(nutriments.sugars_100g) ?? 0,
    fibre_per_100g: num(nutriments.fiber_100g) ?? 0,
    salt_per_100g: num(nutriments.salt_100g) ?? 0,
  };

  // "Incomplete" when we couldn't find energy or any of the core macros — the
  // product exists but there's nothing useful to log without manual entry.
  const complete = calories !== null || protein !== null || carbs !== null || fat !== null;
  return { food, complete };
}

// Look up a product by barcode. Returns a tagged result the UI can switch on:
//   { status: "found", food }
//   { status: "incomplete", food }   (exists, but no usable nutrition)
//   { status: "not_found" }
//   { status: "error", error }
export async function lookupByBarcode(rawBarcode) {
  const barcode = normalizeBarcode(rawBarcode);
  if (barcode.length < 6) {
    return { status: "error", error: "Enter a full barcode number." };
  }

  let response;
  try {
    response = await fetch(`${OFF_BASE}/${barcode}.json?fields=${OFF_FIELDS}`);
  } catch {
    return { status: "error", error: "Couldn't reach Open Food Facts. Check your connection." };
  }

  if (response.status === 404) {
    return { status: "not_found" };
  }
  if (!response.ok) {
    return { status: "error", error: "Open Food Facts returned an error. Try again shortly." };
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    return { status: "error", error: "Open Food Facts sent an unexpected response." };
  }

  // v2 returns status 1 when the product exists, 0 when it doesn't.
  if (!payload || payload.status === 0 || !payload.product) {
    return { status: "not_found" };
  }

  const { food, complete } = mapOffProduct(payload.product, barcode);
  return complete ? { status: "found", food } : { status: "incomplete", food };
}
