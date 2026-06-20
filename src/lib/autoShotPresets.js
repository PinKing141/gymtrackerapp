export const AUTO_SHOT_PRESETS = {
  auto: {
    id: "auto",
    label: "Auto",
    description: "Pick a preset from live conditions and device speed.",
  },
  indoor: {
    id: "indoor",
    label: "Indoor Gym",
    description: "Balanced detection for bright indoor courts.",
    settings: {
      minScore: 0.54,
      orangeMinRatio: 0.05,
      continuityMinScore: 0.58,
      strongScoreBypass: 0.75,
      minShotConfidence: 0.64,
      autoRelockEnabled: true,
      detectionIntervalMs: 140,
    },
  },
  outdoor: {
    id: "outdoor",
    label: "Outdoor Court",
    description: "Stricter thresholds for bright scenes and busy backgrounds.",
    settings: {
      minScore: 0.6,
      orangeMinRatio: 0.07,
      continuityMinScore: 0.62,
      strongScoreBypass: 0.79,
      minShotConfidence: 0.71,
      autoRelockEnabled: true,
      detectionIntervalMs: 140,
    },
  },
  lowlight: {
    id: "lowlight",
    label: "Low Light",
    description: "Looser ball detection for darker gyms or evening courts.",
    settings: {
      minScore: 0.47,
      orangeMinRatio: 0.025,
      continuityMinScore: 0.52,
      strongScoreBypass: 0.7,
      minShotConfidence: 0.58,
      autoRelockEnabled: true,
      detectionIntervalMs: 150,
    },
  },
  older_phone: {
    id: "older_phone",
    label: "Older Phone",
    description: "Reduces detector pressure for slower devices.",
    settings: {
      minScore: 0.57,
      orangeMinRatio: 0.05,
      continuityMinScore: 0.56,
      strongScoreBypass: 0.76,
      minShotConfidence: 0.63,
      autoRelockEnabled: true,
      detectionIntervalMs: 190,
    },
  },
};

export const AUTO_SHOT_PRESET_OPTIONS = Object.values(AUTO_SHOT_PRESETS).map((preset) => ({
  value: preset.id,
  label: preset.label,
  description: preset.description,
}));

export function getPresetSettings(presetId) {
  return AUTO_SHOT_PRESETS[presetId]?.settings || null;
}

export function recommendAutoShotPreset({ brightness = 0.5, avgFps = 0, avgInferenceMs = 0 } = {}) {
  if (brightness <= 0.28) return "lowlight";
  if (avgFps && avgFps < 20) return "older_phone";
  if (avgInferenceMs && avgInferenceMs > 85) return "older_phone";
  if (brightness >= 0.68) return "outdoor";
  return "indoor";
}