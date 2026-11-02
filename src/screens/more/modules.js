// Modules a user can switch on or off under "What you track".
export const MAIN_MODULES = [
  { key: "gym", label: "Gym / Lifting", desc: "Strength workouts & PBs", locked: true },
  { key: "cardio", label: "Cardio", desc: "Bike, treadmill, running" },
  { key: "basketball", label: "Basketball", desc: "Shot tracking & stats" },
  { key: "nutrition", label: "Nutrition", desc: "Calorie target and food logging", locked: true },
];

export const SUPPORT_MODULES = [
  { key: "recovery", label: "Recovery", desc: "Sleep, hydration, mobility" },
  { key: "bodyweight", label: "Bodyweight", desc: "Weigh-ins and trends" },
  { key: "weeklyReview", label: "Weekly review", desc: "Sunday accountability" },
  { key: "phaseTracking", label: "Phase tracking", desc: "12-week progression" },
];

export const SOUND_ROWS = [
  { key: "timers", label: "Timers", cue: "restEnd" },
  { key: "logging", label: "Logging", cue: "setLogged" },
  { key: "celebrations", label: "Celebrations", cue: "pr" },
  { key: "basketball", label: "Basketball", cue: "ballMake" },
];
