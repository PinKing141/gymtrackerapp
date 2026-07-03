// Coach persona seam. Today there is only a neutral voice; this centralizes
// user-facing coaching copy keyed by profile.coachPersona so additional
// personas (different names/tones) can be added later without touching screens.

export const COACH_PERSONAS = [
  { id: "none", name: "Neutral", blurb: "Clean, data-first. No persona." },
  // Future: { id: "orion", name: "Coach Orion", blurb: "..." }, etc.
];

const COPY = {
  none: {
    tagline: "Your training, tracked.",
  },
};

export function getCoachCopy(persona) {
  return COPY[persona] || COPY.none;
}

export function getPersonaName(persona) {
  return COACH_PERSONAS.find((p) => p.id === persona)?.name || "Neutral";
}
