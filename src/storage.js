import {
  createWorkoutSnapshot,
  getExercisesForWorkout,
  getResolvedSet,
  getWorkoutById,
  migrateSessionSetData,
  normalizeWorkoutPresetList,
} from "./workouts.js";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATA_VERSION = 7;
const DEFAULT_STREAK_STATE = {
  weeklyTarget: 3,
  freezeCredits: 1,
  frozenWeeks: [],
  rewardedWeeks: [],
};
const DEFAULT_ENABLED_MODULES = {
  gym: true,
  cardio: true,
  basketball: false,
  nutrition: true,
};
const DEFAULT_NUTRITION = {
  foodLogs: [],
  customFoods: [],
  savedMeals: [],
  favourites: [],
  barcodeCache: {},
  recentSearches: [],
  targets: null,
};
const DEFAULT_PROFILE = {
  name: "",
  firstName: "",
  lastName: "",
  unitSystem: "imperial",
  age: "",
  sex: "male",
  heightCm: "",
  weightKg: "",
  targetWeightKg: "",
  activityLevel: "moderate",
  goal: "maintain",
  notes: "",
  enabledModules: { ...DEFAULT_ENABLED_MODULES },
  onboardingComplete: false,
  avatar: null,
};
const DEFAULT_SOUND_CATEGORIES = {
  timers: true,
  logging: true,
  celebrations: true,
  basketball: true,
};
const DEFAULT_DEVICE_PREFS = {
  reminderNotifications: false,
  reminderThresholdDays: 2,
  lastReminderKey: null,
  cloudSyncEnabled: true,
  soundEnabled: true,
  soundVolume: 0.6,
  hapticsEnabled: true,
  soundCategories: { ...DEFAULT_SOUND_CATEGORIES },
};

const toLocalDateString = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split("T")[0];
};

export const parseStoredDate = (value) => {
  if (!value) return null;
  if (typeof value === "string" && DATE_ONLY.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const today = () => toLocalDateString(new Date());
export const fd = (d) => {
  const parsed = parseStoredDate(d);
  if (!parsed) return "–";
  return parsed.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"});
};
export const fdu = (m) => { if(!m) return "–"; const h=Math.floor(m/60),mn=m%60; return h>0?`${h}h ${mn}m`:`${mn}m`; };
export const ft = (ts) => { if(!ts) return "–"; return new Date(ts).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}); };
export const C = { background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:"14px 16px", marginBottom:8 };
export const L = { fontSize:11,color:"#555",letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:600,margin:"20px 0 10px" };
export const BB = { background:"none",border:"none",color:"#666",fontSize:13,cursor:"pointer",padding:0,marginBottom:12 };
export const IS = { background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"9px 10px",color:"#fff",fontSize:14,fontWeight:600,width:"100%",boxSizing:"border-box",outline:"none",WebkitAppearance:"none" };
// Training plan: a weekly recurring template plus per-date entries (one-offs,
// status overrides, moves) and deload week markers. All plan logic lives in
// trainingPlan.js; storage only guarantees the shape.
export const DEFAULT_TRAINING_PLAN = () => ({ template: {}, entries: [], deloadWeeks: [] });

function normalizeTrainingPlanShape(plan) {
  const p = isObj(plan) ? plan : {};
  return {
    template: isObj(p.template) ? p.template : {},
    entries: isArr(p.entries) ? p.entries : [],
    deloadWeeks: isArr(p.deloadWeeks) ? p.deloadWeeks : [],
  };
}

export const DD = () => ({
  sessions: [],
  personalBests: {},
  workoutPresets: [],
  recovery: [],
  bodyStats: [],
  weeklyReviews: [],
  cardioSessions: [],
  basketballSessions: [],
  // Custom skill-workout templates the athlete built, and monthly benchmark
  // test results — kept in app data (not a separate localStorage blob) so
  // they're per-account scoped, cloud-synced and backed up like everything else.
  basketballPresets: [],
  basketballBenchmarks: [],
  basketballSettings: { playerName: "" },
  nutrition: { ...DEFAULT_NUTRITION, favourites: [], barcodeCache: {}, recentSearches: [] },
  profile: { ...DEFAULT_PROFILE },
  phaseStart: null,
  trainingPlan: DEFAULT_TRAINING_PLAN(),
  // Per-exercise preferences keyed by exercise name (progression method etc.).
  exerciseSettings: {},
  streakState: { ...DEFAULT_STREAK_STATE },
  meta: { lastSavedAt: null, dataVersion: DATA_VERSION, lastSyncedAt: null },
});
const STORAGE_BASE = "orion-gym-v4";
export const DRAFT_DB = "orion-gym-v4-draft";
export const DEVICE_PREFS_DB = "orion-gym-v4-device";

// App data (main + backup + workout draft) is namespaced per signed-in account
// so one device can hold several accounts without their data bleeding into each
// other. A `null` scope means the legacy device-level namespace, used only in
// local-only mode (no Firebase configured). The pre-scoping keys below hold
// whatever was written before per-account scoping existed and are never adopted
// into an account without an explicit user choice.
const LEGACY_MAIN_KEY = STORAGE_BASE;
const LEGACY_BACKUP_KEY = `${STORAGE_BASE}-backup`;

let storageScope = null;

export function setStorageScope(scope) {
  storageScope = scope || null;
}

export function getStorageScope() {
  return storageScope;
}

const mainKey = () => (storageScope ? `${STORAGE_BASE}:${storageScope}` : LEGACY_MAIN_KEY);
const backupKey = () => (storageScope ? `${STORAGE_BASE}-backup:${storageScope}` : LEGACY_BACKUP_KEY);
const draftKey = () => (storageScope ? `${DRAFT_DB}:${storageScope}` : DRAFT_DB);

export const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
export const isArr = (v) => Array.isArray(v);
export const isValidData = (d) => isObj(d) && isArr(d.sessions) && isObj(d.personalBests) && isArr(d.recovery) && isArr(d.bodyStats) && isArr(d.weeklyReviews) && (!d.workoutPresets || isArr(d.workoutPresets));
const hasCustomWorkoutPresets = (app) => (app?.workoutPresets || []).some((preset) => preset?.source === "custom");
export const hasAnyUserData = (app) => Boolean(
  app?.sessions?.length ||
  Object.keys(app?.personalBests || {}).length ||
  hasCustomWorkoutPresets(app) ||
  app?.recovery?.length ||
  app?.bodyStats?.length ||
  app?.weeklyReviews?.length ||
  app?.nutrition?.foodLogs?.length ||
  app?.nutrition?.customFoods?.length ||
  app?.nutrition?.savedMeals?.length ||
  Object.keys(app?.trainingPlan?.template || {}).length ||
  app?.trainingPlan?.entries?.length ||
  app?.basketballSessions?.length ||
  app?.basketballPresets?.length ||
  app?.basketballBenchmarks?.length ||
  app?.phaseStart
);

export const stampAppData = (app) => ({
  ...app,
  meta: {
    ...(app.meta || {}),
    dataVersion: DATA_VERSION,
    lastSavedAt: Date.now(),
  },
});

const migrateWorkoutOrder = (sessions) => sessions.map((session) => {
  if (!isObj(session)) return session;
  if (session.workoutId === "W3") return { ...session, workoutId: "W4" };
  if (session.workoutId === "W4") return { ...session, workoutId: "W3" };
  return session;
});

const migrateWorkoutSnapshots = (sessions) => sessions.map((session) => {
  if (!isObj(session) || session.workoutSnapshot) {
    return session;
  }

  return {
    ...session,
    workoutSnapshot: createWorkoutSnapshot(getWorkoutById(session.workoutId)),
  };
});

function migrateSessionSets(session) {
  if (!isObj(session)) {
    return session;
  }

  const workout = session.workoutSnapshot || getWorkoutById(session.workoutId);
  if (!workout) {
    return session;
  }

  const migratedSets = { ...(session.sets || {}) };
  getExercisesForWorkout(workout).forEach((exercise, index) => {
    const exerciseKey = `${index}-${exercise.name}`;
    const exerciseSets = Array.isArray(migratedSets[exerciseKey]) ? migratedSets[exerciseKey] : [];
    migratedSets[exerciseKey] = exerciseSets.map((setData) => migrateSessionSetData(setData, exercise));
  });

  return {
    ...session,
    workoutSnapshot: session.workoutSnapshot || createWorkoutSnapshot(workout),
    sets: migratedSets,
  };
}

const migrateTrackedSetShapes = (sessions) => sessions.map(migrateSessionSets);

function normalizePersonalBests(personalBests) {
  if (!isObj(personalBests)) {
    return {};
  }

  return Object.fromEntries(Object.entries(personalBests).map(([name, value]) => {
    if (!isObj(value)) {
      return [name, value];
    }
    const normalizedValue = Number(value.value ?? value.kg ?? 0) || 0;
    const normalizedUnit = typeof value.unit === "string" ? value.unit : "kg";
    const fallbackSummary = normalizedValue > 0 ? `${normalizedValue}${normalizedUnit}${value.reps ? ` x ${value.reps}` : ""}` : "";
    return [name, {
      ...value,
      value: normalizedValue,
      unit: normalizedUnit,
      kg: normalizedUnit === "kg" ? normalizedValue : Number(value.kg) || 0,
      summary: typeof value.summary === "string" && value.summary ? value.summary : fallbackSummary,
    }];
  }));
}

function normalizeStreakState(value) {
  return {
    ...DEFAULT_STREAK_STATE,
    ...(isObj(value) ? value : {}),
    frozenWeeks: isArr(value?.frozenWeeks) ? value.frozenWeeks : [],
    rewardedWeeks: isArr(value?.rewardedWeeks) ? value.rewardedWeeks : [],
  };
}

function normalizeNutrition(value) {
  return {
    ...DEFAULT_NUTRITION,
    ...(isObj(value) ? value : {}),
    foodLogs: isArr(value?.foodLogs) ? value.foodLogs : [],
    customFoods: isArr(value?.customFoods) ? value.customFoods : [],
    savedMeals: isArr(value?.savedMeals) ? value.savedMeals : [],
    favourites: isArr(value?.favourites) ? value.favourites : [],
    barcodeCache: isObj(value?.barcodeCache) ? value.barcodeCache : {},
    recentSearches: isArr(value?.recentSearches) ? value.recentSearches : [],
    targets: isObj(value?.targets) ? value.targets : null,
  };
}

export const withDefaults = (d) => {
  const b = DD();
  const meta = { ...b.meta, ...(isObj(d?.meta) ? d.meta : {}) };
  const rawSessions = isArr(d?.sessions) ? d.sessions : b.sessions;
  let dataVersion = Number.isFinite(meta.dataVersion) ? meta.dataVersion : Number.isFinite(meta.workoutOrderVersion) ? meta.workoutOrderVersion : 1;
  let sessions = rawSessions;

  if (dataVersion < 2) {
    sessions = migrateWorkoutOrder(sessions);
    dataVersion = 2;
  }

  if (dataVersion < 3) {
    sessions = migrateWorkoutSnapshots(sessions);
    dataVersion = 3;
  }

  if (dataVersion < 4) {
    sessions = migrateTrackedSetShapes(sessions);
  }

  // Versions 5–7 only changed defaults; no stored-data migration is needed and
  // meta.dataVersion below is always stamped with the current DATA_VERSION.

  return {
    ...b,
    ...d,
    sessions,
    personalBests: normalizePersonalBests(d?.personalBests),
    workoutPresets: normalizeWorkoutPresetList(isArr(d?.workoutPresets) ? d.workoutPresets : b.workoutPresets),
    recovery: isArr(d?.recovery) ? d.recovery : b.recovery,
    bodyStats: isArr(d?.bodyStats) ? d.bodyStats : b.bodyStats,
    weeklyReviews: isArr(d?.weeklyReviews) ? d.weeklyReviews : b.weeklyReviews,
    cardioSessions: isArr(d?.cardioSessions) ? d.cardioSessions : b.cardioSessions,
    basketballSessions: isArr(d?.basketballSessions) ? d.basketballSessions : (b.basketballSessions || []),
    basketballPresets: isArr(d?.basketballPresets) ? d.basketballPresets : (b.basketballPresets || []),
    basketballBenchmarks: isArr(d?.basketballBenchmarks) ? d.basketballBenchmarks : (b.basketballBenchmarks || []),
    basketballSettings: isObj(d?.basketballSettings) ? { playerName: "", ...d.basketballSettings } : { playerName: "" },
    trainingPlan: normalizeTrainingPlanShape(d?.trainingPlan),
    exerciseSettings: isObj(d?.exerciseSettings) ? d.exerciseSettings : {},
    nutrition: normalizeNutrition(d?.nutrition),
    profile: {
      ...DEFAULT_PROFILE,
      ...(isObj(d?.profile) ? d.profile : {}),
      enabledModules: { ...DEFAULT_ENABLED_MODULES, ...(isObj(d?.profile?.enabledModules) ? d.profile.enabledModules : {}) },
    },
    streakState: normalizeStreakState(d?.streakState),
    meta: { ...meta, dataVersion: DATA_VERSION },
  };
};
export const safeParse = (raw) => { try { return JSON.parse(raw); } catch (e) { return null; } };

export function dbLoad() {
  try {
    const main = safeParse(localStorage.getItem(mainKey()) || "");
    if (isValidData(main)) return withDefaults(main);
    const backup = safeParse(localStorage.getItem(backupKey()) || "");
    if (isValidData(backup)) {
      localStorage.setItem(mainKey(), JSON.stringify(backup));
      return withDefaults(backup);
    }
    return DD();
  } catch (e) {
    return DD();
  }
}

export function dbSave(d) {
  try {
    const payload = withDefaults({
      ...d,
      meta: {
        ...(d.meta || {}),
        dataVersion: DATA_VERSION,
        lastSavedAt: d?.meta?.lastSavedAt || Date.now(),
      },
    });
    const s = JSON.stringify(payload);
    localStorage.setItem(mainKey(), s);
    localStorage.setItem(backupKey(), s);
    return payload;
  } catch (e) {
    return d;
  }
}

export function dbClear() {
  try {
    localStorage.removeItem(mainKey());
    localStorage.removeItem(backupKey());
  } catch (e) {
    // Ignore local storage cleanup issues.
  }
}

export function dbRestoreBackup() {
  try {
    const backup = safeParse(localStorage.getItem(backupKey()) || "");
    if (!isValidData(backup)) return null;
    localStorage.setItem(mainKey(), JSON.stringify(backup));
    return withDefaults(backup);
  } catch (e) {
    return null;
  }
}

// Read the current scope's backup (validated) for preview/restore UI. Returns the
// parsed backup or null when there isn't a usable one.
export function backupLoad() {
  try {
    const parsed = safeParse(localStorage.getItem(backupKey()) || "");
    return isValidData(parsed) ? parsed : null;
  } catch (e) {
    return null;
  }
}

// Pre-scoping device data, if any. Read from the fixed legacy keys, never the
// scoped ones, so it stays isolated from any account until the user chooses.
export function legacyDataLoad() {
  try {
    const main = safeParse(localStorage.getItem(LEGACY_MAIN_KEY) || "");
    if (isValidData(main)) return withDefaults(main);
    const backup = safeParse(localStorage.getItem(LEGACY_BACKUP_KEY) || "");
    if (isValidData(backup)) return withDefaults(backup);
    return null;
  } catch (e) {
    return null;
  }
}

// Legacy data is only worth surfacing if it carries real data or a named profile —
// otherwise it's just empty defaults and prompting would be noise.
export function legacyImportCandidate() {
  const data = legacyDataLoad();
  if (!data) return null;
  const named = Boolean(data.profile?.firstName || data.profile?.name);
  return hasAnyUserData(data) || data.profile?.onboardingComplete || named ? data : null;
}

export function legacyDataClear() {
  try {
    localStorage.removeItem(LEGACY_MAIN_KEY);
    localStorage.removeItem(LEGACY_BACKUP_KEY);
  } catch (e) {
    // Ignore local storage cleanup issues.
  }
}

function migrateDraftPayload(payload) {
  if (!isObj(payload) || !isObj(payload.session)) {
    return null;
  }

  const session = migrateSessionSets(payload.session);
  if (!session || !session.workoutId) {
    return null;
  }

  return {
    workoutId: payload.workoutId || session.workoutId,
    session,
    expandedExercise: payload.expandedExercise || null,
    prehabOpen: payload.prehabOpen !== false,
    coreOpen: Boolean(payload.coreOpen),
    savedAt: payload.savedAt || null,
  };
}

export function draftLoad() {
  try {
    return migrateDraftPayload(safeParse(localStorage.getItem(draftKey()) || ""));
  } catch (e) {
    return null;
  }
}

export function draftSave(payload) {
  try {
    if (!payload) {
      localStorage.removeItem(draftKey());
      return null;
    }
    const migrated = migrateDraftPayload(payload);
    if (!migrated) {
      return null;
    }
    localStorage.setItem(draftKey(), JSON.stringify({ ...migrated, savedAt: Date.now() }));
    return migrated;
  } catch (e) {
    return null;
  }
}

export function draftClear() {
  try {
    localStorage.removeItem(draftKey());
  } catch (e) {
    // Ignore draft cleanup failures.
  }
}

export function devicePrefsLoad() {
  try {
    const parsed = safeParse(localStorage.getItem(DEVICE_PREFS_DB) || "");
    return {
      ...DEFAULT_DEVICE_PREFS,
      ...(isObj(parsed) ? parsed : {}),
      soundCategories: { ...DEFAULT_SOUND_CATEGORIES, ...(isObj(parsed?.soundCategories) ? parsed.soundCategories : {}) },
    };
  } catch (e) {
    return { ...DEFAULT_DEVICE_PREFS, soundCategories: { ...DEFAULT_SOUND_CATEGORIES } };
  }
}

export function devicePrefsSave(prefs) {
  try {
    const nextPrefs = {
      ...DEFAULT_DEVICE_PREFS,
      ...(isObj(prefs) ? prefs : {}),
    };
    localStorage.setItem(DEVICE_PREFS_DB, JSON.stringify(nextPrefs));
    return nextPrefs;
  } catch (e) {
    return prefs;
  }
}

export function devicePrefsReset() {
  try {
    localStorage.removeItem(DEVICE_PREFS_DB);
  } catch (e) {
    // Ignore prefs cleanup failures.
  }
}
