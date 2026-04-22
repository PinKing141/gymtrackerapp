import { createWorkoutSnapshot, getWorkoutById } from "./workouts.js";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATA_VERSION = 3;

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
export const DD = () => ({sessions:[],personalBests:{},recovery:[],bodyStats:[],weeklyReviews:[],phaseStart:null,meta:{lastSavedAt:null,dataVersion:DATA_VERSION,lastSyncedAt:null}});
export const DB = "orion-gym-v4";
export const DB_BACKUP = "orion-gym-v4-backup";

export const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
export const isArr = (v) => Array.isArray(v);
export const isValidData = (d) => isObj(d) && isArr(d.sessions) && isObj(d.personalBests) && isArr(d.recovery) && isArr(d.bodyStats) && isArr(d.weeklyReviews);
export const hasAnyUserData = (app) => Boolean(
  app?.sessions?.length ||
  Object.keys(app?.personalBests || {}).length ||
  app?.recovery?.length ||
  app?.bodyStats?.length ||
  app?.weeklyReviews?.length ||
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

  return {
    ...b,
    ...d,
    sessions,
    personalBests: isObj(d?.personalBests) ? d.personalBests : b.personalBests,
    recovery: isArr(d?.recovery) ? d.recovery : b.recovery,
    bodyStats: isArr(d?.bodyStats) ? d.bodyStats : b.bodyStats,
    weeklyReviews: isArr(d?.weeklyReviews) ? d.weeklyReviews : b.weeklyReviews,
    meta: { ...meta, dataVersion: DATA_VERSION },
  };
};
export const safeParse = (raw) => { try { return JSON.parse(raw); } catch (e) { return null; } };

export function dbLoad() {
  try {
    const main = safeParse(localStorage.getItem(DB) || "");
    if (isValidData(main)) return withDefaults(main);
    const backup = safeParse(localStorage.getItem(DB_BACKUP) || "");
    if (isValidData(backup)) {
      localStorage.setItem(DB, JSON.stringify(backup));
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
    localStorage.setItem(DB, s);
    localStorage.setItem(DB_BACKUP, s);
    return payload;
  } catch (e) {
    return d;
  }
}

export function dbRestoreBackup() {
  try {
    const backup = safeParse(localStorage.getItem(DB_BACKUP) || "");
    if (!isValidData(backup)) return null;
    localStorage.setItem(DB, JSON.stringify(backup));
    return withDefaults(backup);
  } catch (e) {
    return null;
  }
}
