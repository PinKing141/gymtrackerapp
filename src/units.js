// Shared unit conversion + profile option constants, extracted so onboarding and
// settings can reuse the same logic. Height is always stored in cm, weight in kg,
// regardless of the display unit system.

export const CM_PER_INCH = 2.54;
export const KG_PER_LB = 0.45359237;

export const ACTIVITY_OPTIONS = [
  { value: "sedentary", label: "Sedentary", factor: 1.2 },
  { value: "light", label: "Lightly active", factor: 1.375 },
  { value: "moderate", label: "Moderately active", factor: 1.55 },
  { value: "high", label: "Very active", factor: 1.725 },
];

export const GOAL_OPTIONS = [
  { value: "cut", label: "Fat loss", delta: -450 },
  { value: "maintain", label: "Maintain", delta: 0 },
  { value: "bulk", label: "Muscle gain", delta: 300 },
];

export function toInches(heightCm) {
  const cm = Number(heightCm);
  if (!cm) return 0;
  return cm / CM_PER_INCH;
}

export function toFeetInches(heightCm) {
  const totalInches = Math.max(0, Math.round(toInches(heightCm)));
  return {
    feet: Math.floor(totalInches / 12),
    inches: totalInches % 12,
  };
}

export function feetInchesToCm(feet, inches) {
  const ft = Number(feet) || 0;
  const inch = Number(inches) || 0;
  const totalInches = Math.max(0, (ft * 12) + inch);
  return Number((totalInches * CM_PER_INCH).toFixed(1));
}

export function poundsToKg(pounds) {
  const lbs = Number(pounds);
  if (!lbs) return "";
  return Number((lbs * KG_PER_LB).toFixed(2));
}

export function kgToPounds(weightKg) {
  const kg = Number(weightKg);
  if (!kg) return "";
  return Number((kg / KG_PER_LB).toFixed(1));
}
