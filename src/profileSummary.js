const GOAL_LABELS = { cut: "Fat loss", maintain: "Maintain", bulk: "Muscle gain" };
const KG_PER_LB = 0.45359237;

function kgToPounds(weightKg) {
  const kg = Number(weightKg);
  if (!kg) return "";
  return Number((kg / KG_PER_LB).toFixed(1));
}

export function getDisplayName(profile = {}) {
  return (profile.firstName || profile.name || "").trim() || "Your profile";
}

export function getInitials(displayName) {
  return displayName.split(" ").filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "Y";
}

export function getGoalLabel(goal) {
  return GOAL_LABELS[goal] || "—";
}

export function getUnitLabel(profile = {}) {
  return (profile.unitSystem || "imperial") === "imperial" ? "Imperial" : "Metric";
}

export function getWeightLabel(profile = {}) {
  if (!profile.weightKg) return "—";
  return (profile.unitSystem || "imperial") === "imperial" ? `${kgToPounds(profile.weightKg)} lb` : `${profile.weightKg} kg`;
}

export function getDataSummary(app = {}) {
  const counts = {
    workouts: app.sessions?.length || 0,
    recovery: app.recovery?.length || 0,
    weighIns: app.bodyStats?.length || 0,
    reviews: app.weeklyReviews?.length || 0,
    pbs: Object.keys(app.personalBests || {}).length,
    cardio: app.cardioSessions?.length || 0,
    basketball: app.basketballSessions?.length || 0,
    preferences: Boolean(app.profile),
  };
  return { counts, label: counts.workouts || counts.pbs ? `${counts.workouts} sessions · ${counts.pbs} PBs` : "No backup yet" };
}

export function getSyncSummary({ firebaseUser, firestoreSync } = {}) {
  if (!firebaseUser) return "Signed out";
  if (firestoreSync?.status === "error") return "Sync error";
  if (firestoreSync?.status === "synced") return "Synced to cloud";
  if (firestoreSync?.status === "saving") return "Saving…";
  return "Signed in";
}

export function getNotificationSummary({ supported, permission, thresholdDays } = {}) {
  if (!supported) return "Unsupported";
  return permission === "granted" ? `${thresholdDays || 3}-day reminder` : "Off";
}

export function getEnabledModuleSummary(profile = {}, modules = []) {
  const enabledModules = { gym: true, ...(profile.enabledModules || {}) };
  return modules.filter((module) => module.locked || enabledModules[module.key]).map((module) => module.label.replace(" / Lifting", "")).join(" · ") || "Gym";
}

export function getBodyGoalsSummary({ profile = {}, calorieStats } = {}) {
  return calorieStats && profile.weightKg && profile.goal ? `${getWeightLabel(profile)} · ${getGoalLabel(profile.goal)} · ${calorieStats.target.toLocaleString()} kcal` : "Finish setup";
}

export function getProteinRange(profile = {}) {
  return profile.weightKg ? `${Math.round(Number(profile.weightKg) * 1.6)}–${Math.round(Number(profile.weightKg) * 2.2)}g/day` : "Add current weight";
}

export function getProfileCompletion({ profile = {}, enabledModules = {}, notificationPermission } = {}) {
  const items = [profile.name || profile.firstName, profile.age, profile.sex, profile.heightCm, profile.weightKg, profile.goal, profile.targetWeightKg, profile.activityLevel, Object.values(enabledModules).some(Boolean), notificationPermission === "granted", profile.unitSystem];
  return Math.round((items.filter(Boolean).length / items.length) * 100);
}

export function getNextProfileAction({ profile = {}, enabledModules = {}, notificationPermission } = {}) {
  if (!profile.name && !profile.firstName) return "Add name";
  if (!profile.weightKg) return "Add current weight";
  if (!profile.heightCm) return "Add height";
  if (!profile.age) return "Add age";
  if (!profile.goal) return "Pick goal";
  if (!profile.targetWeightKg) return "Set your target weight";
  if (!profile.activityLevel) return "Pick activity level";
  if (!Object.values(enabledModules).some(Boolean)) return "Choose what you track";
  if (notificationPermission !== "granted") return "Enable reminders";
  return "Ready to train";
}
