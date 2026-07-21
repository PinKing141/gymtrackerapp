// Plate calculator for barbell work: given a target load, what goes on each
// side of the bar. Greedy from the heaviest plate down, which matches how
// people actually load bars.

export const DEFAULT_BAR_KG = 20;
export const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

export function calculatePlates(targetKg, { barKg = DEFAULT_BAR_KG, plates = DEFAULT_PLATES_KG } = {}) {
  const target = Number(targetKg);
  if (!Number.isFinite(target) || target <= 0) {
    return { valid: false, reason: "Enter a target weight." };
  }
  if (target < barKg) {
    return { valid: false, reason: `Below the ${barKg}kg bar.` };
  }

  let perSideRemaining = (target - barKg) / 2;
  const perSide = [];
  [...plates].sort((a, b) => b - a).forEach((plate) => {
    while (perSideRemaining >= plate - 1e-9) {
      perSide.push(plate);
      perSideRemaining = Math.round((perSideRemaining - plate) * 1000) / 1000;
    }
  });

  const loaded = barKg + perSide.reduce((sum, plate) => sum + plate, 0) * 2;
  return {
    valid: true,
    barKg,
    perSide,
    perSideLabel: perSide.length ? perSide.join(" + ") : "bar only",
    loadedKg: Math.round(loaded * 100) / 100,
    remainderKg: Math.round(perSideRemaining * 2 * 100) / 100,
    exact: perSideRemaining < 1e-9,
  };
}
