// Serving controls: grams/millilitres stay the source of truth (all nutrition
// maths is per-100), but the user can think in items, slices, scoops or
// servings and let the app convert.

const COUNT_UNITS = [
  { id: "item", label: "item" },
  { id: "slice", label: "slice" },
  { id: "scoop", label: "scoop" },
];

export function getServingOptions(food = {}) {
  const baseUnit = food.serving_unit === "ml" ? "ml" : "g";
  const servingSize = Number(food.serving_size) || 0;

  const options = [{ id: baseUnit, label: baseUnit, gramsPerUnit: 1, editable: false }];

  if (servingSize > 0) {
    options.push({
      id: "serving",
      label: `serving (${servingSize}${baseUnit})`,
      gramsPerUnit: servingSize,
      editable: false,
    });
  }

  COUNT_UNITS.forEach((unit) => {
    options.push({
      id: unit.id,
      label: unit.label,
      // Best default we have; the UI lets the user correct "how many grams is
      // one item/slice/scoop" inline.
      gramsPerUnit: servingSize > 0 ? servingSize : 100,
      editable: true,
    });
  });

  return options;
}

// Quantity × unit → the gram/ml amount the log stores.
export function computeAmount(quantity, option, customGramsPerUnit) {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0 || !option) return 0;
  const perUnit = option.editable && Number(customGramsPerUnit) > 0
    ? Number(customGramsPerUnit)
    : option.gramsPerUnit;
  return Math.round(qty * perUnit * 10) / 10;
}
