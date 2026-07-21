import { useEffect, useMemo, useRef, useState } from "react";
import { AutoShotMode } from "./AutoShotMode.jsx";
import { ShotZoneCourtPicker } from "../components/ShotZoneCourtPicker.jsx";
import { ShotChart, getZoneStats } from "../components/ShotChart.jsx";
import { Avatar } from "../components/Avatar.jsx";
import { BackButton } from "../components/ui.jsx";
import { Icon } from "../components/icons.jsx";
import { loadRimCalibration } from "../lib/rimCalibration.js";
import { haptic, playCue } from "../services/sound.js";
import { colors, radii, typeScale } from "../theme.js";
import { today } from "../storage.js";
import {
  BENCHMARK_TESTS,
  DRILL_CATEGORIES,
  DRILL_LEVELS,
  TARGET_TYPES,
  compareBenchmarkValues,
  getBenchmarkStatus,
  getDrillProgress,
  getRepDrillProgress,
  getSessionWorkload,
  normalizeDrill,
} from "../basketball.js";

const AI_SOURCES = ["auto-confirmed", "auto-corrected", "auto"];

/**
 * Derive the cloud-sync summary fields for a finished session from its shots.
 */
function summarizeSession(session) {
  const shots = Array.isArray(session?.shots) ? session.shots : [];
  const makes = shots.filter((shot) => shot.result === "make").length;
  const totalShots = shots.length;
  const shotTimes = shots
    .map((shot) => new Date(shot.timestamp).getTime())
    .filter((time) => !Number.isNaN(time));
  const startedAt = session?.startedAt
    || session?.date
    || (shotTimes.length ? new Date(Math.min(...shotTimes)).toISOString() : new Date().toISOString());
  const endedAtMs = shotTimes.length ? Math.max(...shotTimes) : Date.now();
  const endedAt = new Date(endedAtMs).toISOString();
  const durationSec = Math.max(0, Math.round((endedAtMs - new Date(startedAt).getTime()) / 1000));
  return {
    mode: shots.some((shot) => AI_SOURCES.includes(shot.source)) ? "auto-assisted" : "manual",
    totalShots,
    makes,
    misses: totalShots - makes,
    fgPct: totalShots > 0 ? Math.round((makes / totalShots) * 100) : 0,
    startedAt,
    endedAt,
    durationSec,
    device: typeof navigator !== "undefined" ? navigator.userAgent : null,
    calibrationId: loadRimCalibration()?.timestamp ?? null,
  };
}

// Pre-account-scoping storage: basketball history used to live entirely in its
// own unscoped localStorage blob, outside the per-account app data every other
// module uses. That meant it could leak across accounts on a shared device and
// couldn't connect to the rest of the athlete's plan (Today, workload, etc).
// This key is only read once, to migrate any existing device data into the
// current account, then left alone.
const LEGACY_STORAGE_KEY = "hoopTrackerProData";

const SHOT_TYPES = ["Form", "Catch & Shoot", "Pull-Up", "Step-In", "Floater", "Layup", "Reverse", "Contact", "Free Throw"];

const ZONES = {
  PAINT: { id: "PAINT", name: "Paint / Restricted (Legacy)", type: "finishing", selectable: false },
  MID_LEFT: { id: "MID_LEFT", name: "Left Elbow/Wing (Legacy)", type: "mid", selectable: false },
  MID_RIGHT: { id: "MID_RIGHT", name: "Right Elbow/Wing (Legacy)", type: "mid", selectable: false },
  MID_LEFT_SHORT_CORNER: { id: "MID_LEFT_SHORT_CORNER", name: "Left Short Corner (Legacy)", type: "mid", selectable: false },
  MID_LEFT_WING: { id: "MID_LEFT_WING", name: "Left Wing 2 (Legacy)", type: "mid", selectable: false },
  MID_LEFT_ELBOW: { id: "MID_LEFT_ELBOW", name: "Left Elbow (Legacy)", type: "mid", selectable: false },
  MID_RIGHT_ELBOW: { id: "MID_RIGHT_ELBOW", name: "Right Elbow (Legacy)", type: "mid", selectable: false },
  MID_RIGHT_WING: { id: "MID_RIGHT_WING", name: "Right Wing 2 (Legacy)", type: "mid", selectable: false },
  MID_RIGHT_SHORT_CORNER: { id: "MID_RIGHT_SHORT_CORNER", name: "Right Short Corner (Legacy)", type: "mid", selectable: false },
  under_basket: { id: "under_basket", name: "Restricted Area", type: "finishing" },
  close_l: { id: "close_l", name: "Left Short Corner", type: "finishing" },
  close_c: { id: "close_c", name: "Paint", type: "finishing" },
  close_r: { id: "close_r", name: "Right Short Corner", type: "finishing" },
  mid_base_l: { id: "mid_base_l", name: "Left Baseline 2", type: "mid" },
  mid_wing_l: { id: "mid_wing_l", name: "Left Wing 2", type: "mid" },
  MID_TOP: { id: "MID_TOP", name: "Top Mid-Range (Legacy)", type: "mid", selectable: false },
  mid_top: { id: "mid_top", name: "Elbow / Top Mid-Range", type: "mid" },
  mid_wing_r: { id: "mid_wing_r", name: "Right Wing 2", type: "mid" },
  mid_base_r: { id: "mid_base_r", name: "Right Baseline 2", type: "mid" },
  THREE_LEFT_CORNER: { id: "THREE_LEFT_CORNER", name: "Left Corner 3 (Legacy)", type: "three", selectable: false },
  THREE_RIGHT_CORNER: { id: "THREE_RIGHT_CORNER", name: "Right Corner 3 (Legacy)", type: "three", selectable: false },
  THREE_LEFT_WING: { id: "THREE_LEFT_WING", name: "Left Wing 3 (Legacy)", type: "three", selectable: false },
  THREE_RIGHT_WING: { id: "THREE_RIGHT_WING", name: "Right Wing 3 (Legacy)", type: "three", selectable: false },
  THREE_TOP: { id: "THREE_TOP", name: "Top of Key 3 (Legacy)", type: "three", selectable: false },
  corner3_l: { id: "corner3_l", name: "Left Corner 3", type: "three" },
  wing3_l: { id: "wing3_l", name: "Left Above-Break 3", type: "three" },
  top3: { id: "top3", name: "Top Above-Break 3", type: "three" },
  wing3_r: { id: "wing3_r", name: "Right Above-Break 3", type: "three" },
  corner3_r: { id: "corner3_r", name: "Right Corner 3", type: "three" },
  FREE_THROW: { id: "FREE_THROW", name: "Free Throw Line", type: "ft" },
};

const SELECTABLE_ZONE_IDS = [
  "under_basket",
  "close_l",
  "close_c",
  "close_r",
  "mid_base_l",
  "mid_wing_l",
  "mid_top",
  "mid_wing_r",
  "mid_base_r",
  "corner3_l",
  "wing3_l",
  "top3",
  "wing3_r",
  "corner3_r",
  "FREE_THROW",
];

const SELECTABLE_ZONES = SELECTABLE_ZONE_IDS.map((zoneId) => ZONES[zoneId]);

// category/level retrofit for the built-in templates, so the existing content
// participates in the new drill taxonomy (target types, workload scoring)
// without every template author having to hand-pick values.
const SHOT_TYPE_DEFAULTS = {
  Form: { category: "form", level: "stationary" },
  "Catch & Shoot": { category: "spot", level: "stationary" },
  "Pull-Up": { category: "offDribble", level: "liveFootwork" },
  "Step-In": { category: "offDribble", level: "oneDribble" },
  Floater: { category: "finishing", level: "liveFootwork" },
  Layup: { category: "finishing", level: "stationary" },
  Reverse: { category: "finishing", level: "liveFootwork" },
  Contact: { category: "finishing", level: "defender" },
  "Free Throw": { category: "freeThrow", level: "stationary" },
};

function withDrillDefaults(drill, index) {
  const fallback = SHOT_TYPE_DEFAULTS[drill.type] || { category: "spot", level: "stationary" };
  return normalizeDrill({ category: fallback.category, level: fallback.level, targetType: "makes", ...drill }, index);
}

const BUILT_IN_TEMPLATES = [
  { id: "free", name: "Free Shoot", desc: "Track anywhere, anytime. No targets.", isStructured: false },
  {
    id: "starter",
    name: "Starter Shooter",
    desc: "For beginners or off-days (30-45 mins).",
    isStructured: true,
    drills: [
      { name: "Form Shots", zoneId: "close_c", type: "Form", targetMakes: 50 },
      { name: "Left Wing Mid", zoneId: "mid_wing_l", type: "Catch & Shoot", targetMakes: 10 },
      { name: "Right Wing Mid", zoneId: "mid_wing_r", type: "Catch & Shoot", targetMakes: 10 },
      { name: "Around the Arc", zoneId: "top3", type: "Catch & Shoot", targetMakes: 25 },
      { name: "Free Throws", zoneId: "FREE_THROW", type: "Free Throw", targetMakes: 20 },
    ].map(withDrillDefaults),
  },
  {
    id: "efficient_scorer",
    name: "Efficient Scorer",
    desc: "Your Main Workout. Finish, Mid, 3PT, FT.",
    isStructured: true,
    drills: [
      { name: "Rim Finishes", zoneId: "under_basket", type: "Layup", targetMakes: 10 },
      { name: "Left Close Finishes", zoneId: "close_l", type: "Layup", targetMakes: 10 },
      { name: "Right Close Finishes", zoneId: "close_r", type: "Contact", targetMakes: 10 },
      { name: "Left Wing Mid-Range", zoneId: "mid_wing_l", type: "Pull-Up", targetMakes: 20 },
      { name: "Right Wing Mid-Range", zoneId: "mid_wing_r", type: "Pull-Up", targetMakes: 20 },
      { name: "Three Pointers", zoneId: "top3", type: "Catch & Shoot", targetMakes: 50 },
      { name: "Free Throws", zoneId: "FREE_THROW", type: "Free Throw", targetMakes: 25 },
    ].map(withDrillDefaults),
  },
  {
    id: "sniper",
    name: "Sniper Day",
    desc: "High volume perimeter shooting.",
    isStructured: true,
    drills: [
      { name: "Form Shooting", zoneId: "close_c", type: "Form", targetMakes: 50 },
      { name: "Corners", zoneId: "corner3_l", type: "Catch & Shoot", targetMakes: 50 },
      { name: "Wings", zoneId: "wing3_l", type: "Catch & Shoot", targetMakes: 50 },
      { name: "Top of Key", zoneId: "top3", type: "Catch & Shoot", targetMakes: 25 },
      { name: "Free Throws", zoneId: "FREE_THROW", type: "Free Throw", targetMakes: 30 },
    ].map(withDrillDefaults),
  },
  {
    id: "pressure",
    name: "Pressure Shooter",
    desc: "Miss 2 in a row = reset current drill to 0.",
    isStructured: true,
    specialRule: "pressure",
    drills: [
      { name: "Corner Pressure", zoneId: "corner3_r", type: "Catch & Shoot", targetMakes: 10 },
      { name: "Wing Pressure", zoneId: "wing3_r", type: "Catch & Shoot", targetMakes: 10 },
      { name: "Top Pressure", zoneId: "top3", type: "Catch & Shoot", targetMakes: 10 },
    ].map(withDrillDefaults),
  },
  {
    id: "pro_morning",
    name: "Pro Morning Workout",
    desc: "The ultimate daily grind — shooting, finishing, ball handling and conditioning.",
    isStructured: true,
    drills: [
      { name: "Phase 1: Form", zoneId: "close_c", type: "Form", targetMakes: 50 },
      { name: "Phase 2: Finishes", zoneId: "under_basket", type: "Layup", targetMakes: 40 },
      { name: "Phase 3: Ball Handling", category: "ballHandling", level: "liveFootwork", logType: "count", targetType: "attempts", targetValue: 100 },
      { name: "Phase 4: Mid-Range", zoneId: "mid_top", type: "Pull-Up", targetMakes: 40 },
      { name: "Phase 5: Threes", zoneId: "top3", type: "Catch & Shoot", targetMakes: 50 },
      { name: "Phase 6: Free Throws", zoneId: "FREE_THROW", type: "Free Throw", targetMakes: 20 },
      { name: "Phase 7: Conditioning", category: "conditioning", level: "gameSpeed", logType: "count", targetType: "attempts", targetValue: 10 },
    ].map(withDrillDefaults),
  },
];

// Basketball uses the app's blue accent like every other screen — no bespoke
// module colour. Kept as an alias so the many call sites read clearly.
const BALL_ACCENT = colors.accent;

function getTemplateById(id, customTemplates) {
  return [...BUILT_IN_TEMPLATES, ...customTemplates].find((template) => template.id === id);
}

function getPercent(makes, total) {
  return total > 0 ? Math.round((makes / total) * 100) : 0;
}

// Numbers are neutral by default; a colour is only passed when it carries
// meaning (green = makes, red = misses).
function StatPill({ label, value, color = colors.textPrimary }) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: 12, borderRadius: radii.lg, background: "rgba(255,255,255,0.05)", border: `1px solid ${colors.border}` }}>
      <p style={{ ...typeScale.caption, color: colors.textMuted, margin: 0, textTransform: "uppercase", fontWeight: 800 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 800, color, margin: "3px 0 0" }}>{value}</p>
    </div>
  );
}

// A tap-through row for the dashboard, matching the Profile hub row pattern.
function NavRow({ icon, label, summary, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: radii.lg, background: colors.surface, border: `1px solid ${colors.border}`, color: colors.textPrimary }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.05)", border: `1px solid ${colors.border}` }}>
        <Icon name={icon} size={18} color={colors.textSecondary} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{label}</p>
        {summary && <p style={{ margin: "2px 0 0", ...typeScale.caption, color: colors.textMuted }}>{summary}</p>}
      </div>
      <Icon name="chevronRight" size={16} color={colors.textMuted} />
    </button>
  );
}

function SelectField({ label, value, onChange, children }) {
  return (
    <label style={{ display: "grid", gap: 6, flex: 1 }}>
      <span style={{ ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase" }}>{label}</span>
      <select
        value={value}
        onChange={onChange}
        style={{ width: "100%", minWidth: 0, padding: 12, borderRadius: radii.md, border: `1px solid ${colors.border}`, background: colors.surfaceElevated, color: colors.textPrimary, fontWeight: 800 }}
      >
        {children}
      </select>
    </label>
  );
}

function ZoneOptions() {
  return SELECTABLE_ZONES.map((zone) => (
    <option key={zone.id} value={zone.id}>{zone.name}</option>
  ));
}

const WORKLOAD_LEVEL_COLOR = { high: colors.danger, moderate: colors.warning, low: colors.success };

// Auto shot tracking (camera detection) is temporarily disabled while its
// on-device performance is worked on. Flip to true to bring it back; the
// AutoShotMode flow is left intact.
const AUTO_SHOT_ENABLED = false;

export function BasketballScreen({ app, setApp, onExit, onOpenProfile, firebaseUser }) {
  const uid = firebaseUser?.uid || null;
  const profile = app?.profile || {};
  const profileFirstName = (profile.firstName || profile.name || "").trim().split(" ")[0];
  const [currentView, setCurrentView] = useState("dashboard");
  const [activeSession, setActiveSession] = useState(null);
  const [shotInputMode, setShotInputMode] = useState("manual");
  const [customName, setCustomName] = useState("My Custom Workout");
  const [customDrills, setCustomDrills] = useState([{ name: "Drill 1", category: "spot", level: "stationary", zoneId: "top3", type: "Catch & Shoot", targetType: "makes", targetValue: 10, minAttempts: 10 }]);
  const [benchmarkDrafts, setBenchmarkDrafts] = useState({});

  // All basketball data lives in the account's app data — history, custom
  // templates and settings — so it's per-account scoped, cloud-synced and
  // backed up exactly like every other module. Nothing here is stored
  // separately anymore.
  const history = app?.basketballSessions || [];
  const customTemplates = app?.basketballPresets || [];
  const playerName = app?.basketballSettings?.playerName || "";

  const updateApp = (updater) => setApp?.((current) => updater(current));

  // One-time migration: fold in any pre-account-scoping local data left over
  // from before basketball connected to the rest of the app, then stop
  // touching the legacy key. Only runs while there's nothing in app data yet,
  // so it can never clobber real account history.
  const migratedRef = useRef(false);
  useEffect(() => {
    if (migratedRef.current || !setApp) return;
    migratedRef.current = true;
    if (history.length > 0 || customTemplates.length > 0) return;
    try {
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const legacyHistory = Array.isArray(parsed?.history) ? parsed.history : [];
      const legacyTemplates = Array.isArray(parsed?.customTemplates) ? parsed.customTemplates : [];
      if (!legacyHistory.length && !legacyTemplates.length && !parsed?.playerName) return;
      updateApp((current) => ({
        ...current,
        basketballSessions: [...legacyHistory, ...(current.basketballSessions || [])],
        basketballPresets: [...legacyTemplates, ...(current.basketballPresets || [])],
        basketballSettings: { ...(current.basketballSettings || {}), playerName: parsed?.playerName || current.basketballSettings?.playerName || "" },
      }));
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (error) {
      console.warn("Failed to migrate legacy basketball data", error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const allShots = (app?.basketballSessions || []).flatMap((session) => (Array.isArray(session.shots) ? session.shots : []));

    const calculateZoneStats = (zoneType, specificZoneId = null) => {
      const shots = allShots.filter((shot) => {
        if (specificZoneId) return shot.zoneId === specificZoneId;
        return ZONES[shot.zoneId]?.type === zoneType || (zoneType === "ft" && shot.type === "Free Throw");
      });
      const makes = shots.filter((shot) => shot.result === "make").length;
      const total = shots.length;
      const percentage = getPercent(makes, total);

      let rating = 40;
      if (total > 10) {
        if (zoneType === "three") rating = 40 + percentage * 1.2;
        if (zoneType === "mid") rating = 40 + percentage;
        if (zoneType === "finishing") rating = 40 + percentage * 0.7;
        if (zoneType === "ft") rating = 40 + percentage * 0.6;
      } else if (total > 0) {
        rating = 50;
      } else {
        return { makes: 0, total: 0, percentage: 0, rating: 0 };
      }
      return { makes, total, percentage, rating: Math.min(99, Math.round(rating)) };
    };

    const three = calculateZoneStats("three");
    const mid = calculateZoneStats("mid");
    const finishing = calculateZoneStats("finishing");
    const ft = calculateZoneStats("ft");

    let weakestSpot = null;
    let lowestPct = 100;
    Object.keys(ZONES).forEach((zoneId) => {
      const zoneStats = calculateZoneStats(null, zoneId);
      if (zoneStats.total >= 15 && zoneStats.percentage < lowestPct && zoneStats.percentage > 0) {
        lowestPct = zoneStats.percentage;
        weakestSpot = { ...ZONES[zoneId], percentage: lowestPct };
      }
    });

    const recommendedWorkout = weakestSpot
      ? {
          id: "ai_adaptive",
          name: "Coach: Weakness Focus",
          desc: `You're shooting ${weakestSpot.percentage}% from ${weakestSpot.name}. Let's fix that.`,
          isStructured: true,
          isAdaptive: true,
          drills: [
            { name: "Warmup Form", zoneId: "PAINT", type: "Form", targetMakes: 20 },
            { name: `${weakestSpot.name} Reps`, zoneId: weakestSpot.id, type: "Catch & Shoot", targetMakes: 30 },
            { name: `${weakestSpot.name} Pull-Ups`, zoneId: weakestSpot.id, type: "Pull-Up", targetMakes: 20 },
            { name: "Free Throws", zoneId: "FREE_THROW", type: "Free Throw", targetMakes: 15 },
          ].map(withDrillDefaults),
        }
      : null;

    let archetype = "Developing Player";
    if (allShots.length > 30) {
      if (three.rating > 80 && finishing.rating < 70) archetype = "Sharpshooter";
      else if (finishing.rating > 80 && three.rating < 65) archetype = "Slasher";
      else if (three.rating > 75 && finishing.rating > 75) archetype = "Three-Level Scorer";
      else if (three.percentage > 35 && allShots.filter((shot) => shot.type === "Catch & Shoot").length > allShots.length * 0.4) archetype = "3&D Wing";
      else if (mid.rating > 80) archetype = "Mid-Range Maestro";
      else archetype = "Shot Creator";
    }

    const activeRatings = [three.rating, mid.rating, finishing.rating, ft.rating].filter(Boolean);
    const overall = activeRatings.length ? Math.round(activeRatings.reduce((sum, rating) => sum + rating, 0) / activeRatings.length) : 0;
    const zoneStatsMap = getZoneStats(allShots);
    return { allShots, three, mid, finishing, ft, overall, archetype, weakestSpot, recommendedWorkout, zoneStatsMap };
  }, [app?.basketballSessions]);

  const startSession = (template) => {
    setActiveSession({
      id: Date.now(),
      date: today(),
      startedAt: new Date().toISOString(),
      templateId: template.id,
      templateName: template.name,
      isStructured: template.isStructured,
      drills: (template.drills || []).map((drill, index) => normalizeDrill(drill, index)),
      currentDrillIndex: 0,
      consecutiveMisses: 0,
      shots: [],
      drillLogs: {},
      currentZone: "top3",
      currentType: "Catch & Shoot",
      currentCategory: "spot",
      currentLevel: "liveFootwork",
    });
    setCurrentView("workout");
  };

  const recordShot = (shotInput) => {
    const previewResult = typeof shotInput === "string" ? shotInput : shotInput?.result;
    if (previewResult === "make") { playCue("ballMake"); haptic("light"); }
    else if (previewResult === "miss") { playCue("ballMiss"); haptic("light"); }
    setActiveSession((previous) => {
      if (!previous) return previous;
      const shotPayload = typeof shotInput === "string" ? { result: shotInput } : shotInput;
      if (!shotPayload?.result) return previous;
      const isStructured = previous.isStructured;
      const drillIndex = previous.currentDrillIndex;
      const currentDrill = isStructured ? previous.drills[drillIndex] : null;
      const zoneId = isStructured ? currentDrill.zoneId : shotPayload.zoneId || previous.currentZone;
      const type = isStructured ? currentDrill.shotType : shotPayload.type || previous.currentType;
      const category = isStructured ? currentDrill.category : previous.currentCategory;
      const level = isStructured ? currentDrill.level : previous.currentLevel;
      const newShot = {
        id: Date.now(),
        zoneId,
        type,
        category,
        level,
        result: shotPayload.result,
        drillIndex: isStructured ? drillIndex : null,
        timestamp: new Date().toISOString(),
        source: shotPayload.source || shotInputMode,
        confidence: shotPayload.confidence,
      };
      let newShots = [...previous.shots, newShot];
      let consecutiveMisses = previous.consecutiveMisses;
      const template = getTemplateById(previous.templateId, customTemplates);

      if (template?.specialRule === "pressure" && isStructured) {
        if (shotPayload.result === "miss") {
          consecutiveMisses += 1;
          if (consecutiveMisses >= 2) {
            newShots = newShots.filter((shot) => shot.drillIndex !== drillIndex);
            consecutiveMisses = 0;
          }
        } else {
          consecutiveMisses = 0;
        }
      }

      return { ...previous, shots: newShots, consecutiveMisses };
    });
  };

  // Rep-counted drills (ball handling reps, conditioning rounds) log a running
  // count instead of make/miss shots.
  const logRep = (delta) => {
    setActiveSession((previous) => {
      if (!previous) return previous;
      const drillIndex = previous.currentDrillIndex;
      const currentDrill = previous.drills[drillIndex];
      const existing = previous.drillLogs[drillIndex] || { category: currentDrill.category, level: currentDrill.level, reps: 0 };
      const reps = Math.max(0, existing.reps + delta);
      return { ...previous, drillLogs: { ...previous.drillLogs, [drillIndex]: { ...existing, reps } } };
    });
  };

  const undoLastShot = () => {
    setActiveSession((previous) => {
      if (!previous?.shots?.length) return previous;

      const newShots = previous.shots.slice(0, -1);
      let consecutiveMisses = previous.consecutiveMisses;
      const template = getTemplateById(previous.templateId, customTemplates);

      if (template?.specialRule === "pressure" && previous.isStructured) {
        const currentDrillShots = newShots.filter((shot) => shot.drillIndex === previous.currentDrillIndex);
        consecutiveMisses = 0;
        for (let index = currentDrillShots.length - 1; index >= 0; index -= 1) {
          if (currentDrillShots[index].result !== "miss") break;
          consecutiveMisses += 1;
        }
      }

      return { ...previous, shots: newShots, consecutiveMisses };
    });
  };

  const advanceDrill = () => {
    setActiveSession((previous) => (previous ? { ...previous, currentDrillIndex: previous.currentDrillIndex + 1, consecutiveMisses: 0 } : previous));
  };

  const endSession = () => {
    if (activeSession?.shots?.length > 0 || Object.values(activeSession?.drillLogs || {}).some((log) => log.reps > 0)) {
      const drillLogs = Object.values(activeSession.drillLogs || {}).filter((log) => log.reps > 0);
      const withLogs = { ...activeSession, drillLogs };
      const workload = getSessionWorkload(withLogs);
      const finished = { ...withLogs, ...summarizeSession(withLogs), workload };
      updateApp((current) => ({ ...current, basketballSessions: [finished, ...(current.basketballSessions || [])] }));
    }
    setActiveSession(null);
    setCurrentView("dashboard");
  };

  const saveCustomTemplate = () => {
    const safeName = customName.trim() || "My Custom Workout";
    const newTemplate = {
      id: `custom_${Date.now()}`,
      name: safeName,
      desc: "Custom programme.",
      isStructured: true,
      drills: customDrills.map((drill, index) => normalizeDrill({ ...drill, name: drill.name || `Drill ${index + 1}` }, index)),
    };
    updateApp((current) => ({ ...current, basketballPresets: [...(current.basketballPresets || []), newTemplate] }));
    setCurrentView("setup");
    setCustomName("My Custom Workout");
    setCustomDrills([{ name: "Drill 1", category: "spot", level: "stationary", zoneId: "top3", type: "Catch & Shoot", targetType: "makes", targetValue: 10, minAttempts: 10 }]);
  };

  const updateCustomDrill = (index, patch) => {
    setCustomDrills((previous) => previous.map((drill, drillIndex) => (drillIndex === index ? { ...drill, ...patch } : drill)));
  };

  const recordBenchmark = (testId, value) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return;
    updateApp((current) => ({
      ...current,
      basketballBenchmarks: [...(current.basketballBenchmarks || []), { testId, date: today(), value: numericValue }],
    }));
    setBenchmarkDrafts((current) => ({ ...current, [testId]: "" }));
  };

  const hasData = history.length > 0;
  const programmeCount = BUILT_IN_TEMPLATES.length + customTemplates.length;

  const dashboard = (
    <div style={{ display: "grid", gap: 16, padding: "calc(env(safe-area-inset-top, 0px) + 24px) 18px 28px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase", margin: "0 0 4px" }}>Basketball</p>
          <h1 style={{ fontSize: 26, lineHeight: 1.1, fontWeight: 800, color: colors.textPrimary, margin: 0 }}>Hey{profileFirstName ? `, ${profileFirstName}` : ""}</h1>
        </div>
        {onOpenProfile && <Avatar profile={profile} size={40} radius={13} fontSize={15} onClick={onOpenProfile} />}
      </div>

      <div style={{ padding: 18, borderRadius: radii.xl, background: colors.surface, border: `1px solid ${colors.border}` }}>
        <p style={{ ...typeScale.overline, color: colors.accent, margin: "0 0 8px", textTransform: "uppercase" }}>{stats.recommendedWorkout ? "Recommended next" : "Get started"}</p>
        <h2 style={{ fontSize: 19, margin: "0 0 6px", fontWeight: 800, color: colors.textPrimary }}>{stats.recommendedWorkout?.name || "Log your first session"}</h2>
        <p style={{ ...typeScale.bodySm, color: colors.textSecondary, margin: "0 0 14px" }}>{stats.recommendedWorkout?.desc || "Run a shooting workout to start building your shot profile and stats."}</p>
        <button onClick={() => (stats.recommendedWorkout ? startSession(stats.recommendedWorkout) : setCurrentView("setup"))} style={{ border: 0, borderRadius: radii.md, padding: "11px 15px", fontWeight: 800, color: "#fff", background: colors.accent, cursor: "pointer" }}>{stats.recommendedWorkout ? "Start programme" : "Choose a workout"}</button>
      </div>

      {hasData && (
        <div style={{ padding: 18, borderRadius: radii.xl, background: colors.surface, border: `1px solid ${colors.border}` }}>
          <p style={{ ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase", margin: "0 0 5px" }}>Your archetype</p>
          <h2 style={{ fontSize: 22, color: colors.textPrimary, margin: "0 0 16px", fontWeight: 800 }}>{stats.archetype}</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <StatPill label="3PT %" value={`${stats.three.percentage}%`} />
            <StatPill label="Mid %" value={`${stats.mid.percentage}%`} />
            <StatPill label="Overall" value={stats.overall || "—"} />
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        <NavRow icon="target" label="Workout programmes" summary={`${programmeCount} available`} onClick={() => setCurrentView("setup")} />
        <NavRow icon="barChart" label="Shot stats & chart" summary={hasData ? `${history.length} session${history.length === 1 ? "" : "s"} logged` : "No sessions yet"} onClick={() => setCurrentView("stats")} />
        <NavRow icon="calendar" label="Benchmark tests" summary="Monthly progress checks" onClick={() => setCurrentView("benchmarks")} />
        <NavRow icon="trophy" label="Player card" summary="Your shot ratings" onClick={() => setCurrentView("card")} />
      </div>
    </div>
  );

  const setup = (
    <div style={{ display: "grid", gap: 16, padding: "calc(env(safe-area-inset-top, 0px) + 20px) 18px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <BackButton onClick={() => setCurrentView("dashboard")} label="Basketball" />
        <button onClick={() => setCurrentView("builder")} style={{ border: `1px solid ${BALL_ACCENT}52`, borderRadius: radii.pill, padding: "9px 14px", background: `${BALL_ACCENT}1a`, color: BALL_ACCENT, fontWeight: 800, cursor: "pointer" }}>+ Build</button>
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "2px 0 0", color: colors.textPrimary }}>Workout programmes</h1>
      {[...BUILT_IN_TEMPLATES, ...customTemplates].map((template) => (
        <button key={template.id} onClick={() => startSession(template)} style={{ textAlign: "left", padding: 16, borderRadius: radii.xl, background: colors.surface, color: colors.textPrimary, border: `1px solid ${colors.border}`, cursor: "pointer" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 5px" }}>{template.name}</h2>
              <p style={{ ...typeScale.bodySm, color: colors.textSecondary, margin: 0 }}>{template.desc}</p>
            </div>
            <span style={{ width: 34, height: 34, borderRadius: radii.pill, background: `${BALL_ACCENT}1f`, color: BALL_ACCENT, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name="arrowRight" size={16} /></span>
          </div>
          {template.isStructured && <p style={{ ...typeScale.caption, display: "inline-block", margin: "12px 0 0", padding: "5px 8px", borderRadius: radii.pill, color: colors.textMuted, background: "rgba(255,255,255,0.06)" }}>{template.drills?.length || 0} drills</p>}
        </button>
      ))}
    </div>
  );

  const cardName = playerName || profileFirstName || "Player";
  const playerCard = (
    <div style={{ display: "grid", gap: 18, padding: "calc(env(safe-area-inset-top, 0px) + 20px) 18px 28px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <BackButton onClick={() => setCurrentView("dashboard")} label="Basketball" />
        <button onClick={() => updateApp((current) => ({ ...current, basketballSettings: { ...(current.basketballSettings || {}), playerName: window.prompt("Card name:", cardName) || playerName } }))} style={{ background: "none", border: 0, color: colors.accent, fontWeight: 800, cursor: "pointer" }}>Edit name</button>
      </div>
      <div style={{ padding: 20, borderRadius: 28, background: "linear-gradient(145deg, #111827, #0F172A 55%, #111827)", border: `1px solid ${colors.borderStrong}`, color: "#fff", position: "relative", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, paddingBottom: 16, marginBottom: 16, borderBottom: `1px solid ${colors.border}` }}>
          <div>
            <p style={{ ...typeScale.overline, color: BALL_ACCENT, textTransform: "uppercase", margin: "0 0 6px" }}>{stats.archetype}</p>
            <h2 style={{ fontSize: 28, lineHeight: 1, fontWeight: 800, margin: 0 }}>{cardName}</h2>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 48, lineHeight: 0.9, fontWeight: 800, margin: 0 }}>{stats.overall || "--"}</p>
            <p style={{ ...typeScale.caption, color: colors.textMuted, margin: 0, textTransform: "uppercase" }}>Overall</p>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[
            { label: "FINISHING", val: stats.finishing.rating },
            { label: "MID-RANGE", val: stats.mid.rating },
            { label: "THREE POINT", val: stats.three.rating },
            { label: "FREE THROW", val: stats.ft.rating },
          ].map((attr) => (
            <div key={attr.label}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 800, color: colors.textSecondary }}><span>{attr.label}</span><span style={{ color: attr.val >= 80 ? colors.success : "#fff" }}>{attr.val || "--"}</span></div>
              <div style={{ height: 6, borderRadius: radii.pill, background: "rgba(255,255,255,0.12)", marginTop: 5, overflow: "hidden" }}><div style={{ height: "100%", width: `${attr.val || 0}%`, background: BALL_ACCENT }} /></div>
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", right: -28, bottom: -34, opacity: 0.07 }}><Icon name="trophy" size={150} color="#fff" /></div>
      </div>
      {!hasData ? (
        <div style={{ padding: 16, borderRadius: radii.lg, background: colors.surface, border: `1px solid ${colors.border}`, textAlign: "center" }}>
          <p style={{ ...typeScale.bodySm, color: colors.textSecondary, margin: 0 }}>Your ratings are empty. Log a session to unlock your player card.</p>
          <button onClick={() => setCurrentView("setup")} style={{ marginTop: 12, border: 0, borderRadius: radii.pill, padding: "10px 18px", background: BALL_ACCENT, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Start a session</button>
        </div>
      ) : stats.weakestSpot && (
        <div style={{ padding: 14, borderRadius: radii.lg, background: colors.surface, border: `1px solid ${colors.border}` }}>
          <p style={{ ...typeScale.overline, color: colors.accent, textTransform: "uppercase", margin: "0 0 5px" }}>Scouting report</p>
          <p style={{ ...typeScale.bodySm, color: colors.textSecondary, margin: 0 }}>Defences will target your {stats.weakestSpot.name} ({stats.weakestSpot.percentage}%). Focus your training there.</p>
        </div>
      )}
    </div>
  );

  const statsShots = stats.allShots || [];
  const statsTotal = statsShots.length;
  const statsMakes = statsShots.filter((shot) => shot.result === "make").length;

  const statsView = (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16, padding: "calc(env(safe-area-inset-top, 0px) + 20px) 18px 40px" }}>
      <BackButton onClick={() => setCurrentView("dashboard")} label="Basketball" />
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "-6px 0 0", color: colors.textPrimary }}>Shot stats</h1>
      <div style={{ display: "flex", gap: 8, minWidth: 0 }}>
        <StatPill label="Shots" value={statsTotal} />
        <StatPill label="Makes" value={statsMakes} color={colors.success} />
        <StatPill label="Misses" value={statsTotal - statsMakes} color={colors.danger} />
        <StatPill label="FG%" value={`${getPercent(statsMakes, statsTotal)}%`} />
      </div>

      <div>
        <p style={{ ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase", margin: "0 0 8px" }}>Shot chart — hot zones</p>
        {statsTotal > 0 ? (
          <ShotChart zoneStats={stats.zoneStatsMap} zonesById={ZONES} />
        ) : (
          <div style={{ padding: 16, borderRadius: radii.lg, background: "rgba(255,255,255,0.05)", border: `1px solid ${colors.border}`, textAlign: "center" }}>
            <p style={{ ...typeScale.bodySm, color: colors.textSecondary, margin: 0 }}>Log some shots to see your hot-zone chart.</p>
          </div>
        )}
      </div>

      <div style={{ padding: 12, borderRadius: radii.lg, background: "rgba(255,255,255,0.05)", border: `1px solid ${colors.border}`, ...typeScale.bodySm, color: colors.textSecondary }}>
        {uid ? "This data syncs with the rest of your account." : "Sign in to sync this across your devices."}
      </div>
    </div>
  );

  const builder = (
    <div style={{ display: "grid", gap: 16, padding: "calc(env(safe-area-inset-top, 0px) + 24px) 18px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => setCurrentView("setup")} style={{ border: 0, borderRadius: radii.pill, width: 40, height: 40, background: colors.surface, color: colors.textPrimary, cursor: "pointer" }}><Icon name="chevronLeft" /></button>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Builder</h1>
      </div>
      <input value={customName} onChange={(event) => setCustomName(event.target.value)} style={{ width: "100%", background: "transparent", border: 0, borderBottom: `2px solid ${colors.borderStrong}`, color: colors.textPrimary, padding: "8px 0 12px", fontSize: 22, fontWeight: 700, outline: "none" }} />
      {customDrills.map((drill, index) => {
        const categoryDef = DRILL_CATEGORIES.find((category) => category.id === drill.category) || DRILL_CATEGORIES[1];
        const isRepBased = !categoryDef.shooting;
        return (
          <div key={`${drill.name}-${index}`} style={{ display: "grid", gap: 11, padding: 14, borderRadius: radii.lg, background: colors.surface, border: `1px solid ${colors.border}` }}>
            <p style={{ ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase", fontWeight: 700, margin: 0 }}>Drill {index + 1}</p>
            <input value={drill.name} onChange={(event) => updateCustomDrill(index, { name: event.target.value })} style={{ width: "100%", padding: 11, borderRadius: radii.md, border: `1px solid ${colors.border}`, background: colors.surfaceElevated, color: colors.textPrimary, fontWeight: 800 }} />

            <div style={{ display: "flex", gap: 8 }}>
              <SelectField
                label="Category"
                value={drill.category || "spot"}
                onChange={(event) => {
                  const nextCategory = DRILL_CATEGORIES.find((category) => category.id === event.target.value);
                  updateCustomDrill(index, {
                    category: nextCategory.id,
                    logType: nextCategory.shooting ? "shots" : "count",
                    targetType: nextCategory.shooting ? drill.targetType : "attempts",
                  });
                }}
              >
                {DRILL_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
              </SelectField>
              <SelectField label="Level" value={drill.level || "stationary"} onChange={(event) => updateCustomDrill(index, { level: event.target.value })}>
                {DRILL_LEVELS.map((level) => <option key={level.id} value={level.id}>{level.label}</option>)}
              </SelectField>
            </div>

            {isRepBased ? (
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase" }}>Reps target</span>
                <input type="number" min="1" value={drill.targetValue ?? drill.targetMakes ?? 10} onChange={(event) => updateCustomDrill(index, { targetValue: event.target.value })} style={{ width: "100%", padding: 12, borderRadius: radii.md, border: `1px solid ${colors.border}`, background: colors.surfaceElevated, color: colors.textPrimary, fontWeight: 800 }} />
              </label>
            ) : (
              <>
                <SelectField label="Spot" value={drill.zoneId} onChange={(event) => updateCustomDrill(index, { zoneId: event.target.value })}><ZoneOptions /></SelectField>
                <ShotZoneCourtPicker
                  zonesById={ZONES}
                  selectedZoneId={drill.zoneId}
                  onSelectZone={(zoneId) => updateCustomDrill(index, { zoneId })}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <SelectField label="Shot" value={drill.type} onChange={(event) => updateCustomDrill(index, { type: event.target.value })}>{SHOT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</SelectField>
                  <SelectField label="Target" value={drill.targetType || "makes"} onChange={(event) => updateCustomDrill(index, { targetType: event.target.value })}>
                    {TARGET_TYPES.map((target) => <option key={target.id} value={target.id}>{target.example}</option>)}
                  </SelectField>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <label style={{ display: "grid", gap: 6, flex: 1 }}>
                    <span style={{ ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase" }}>
                      {drill.targetType === "percent" ? "Target %" : drill.targetType === "streak" ? "In a row" : "Target"}
                    </span>
                    <input type="number" min="1" value={drill.targetValue ?? drill.targetMakes ?? 10} onChange={(event) => updateCustomDrill(index, { targetValue: event.target.value })} style={{ width: "100%", padding: 12, borderRadius: radii.md, border: `1px solid ${colors.border}`, background: colors.surfaceElevated, color: colors.textPrimary, fontWeight: 800 }} />
                  </label>
                  {drill.targetType === "percent" && (
                    <label style={{ display: "grid", gap: 6, flex: 1 }}>
                      <span style={{ ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase" }}>Min attempts</span>
                      <input type="number" min="1" value={drill.minAttempts ?? 10} onChange={(event) => updateCustomDrill(index, { minAttempts: event.target.value })} style={{ width: "100%", padding: 12, borderRadius: radii.md, border: `1px solid ${colors.border}`, background: colors.surfaceElevated, color: colors.textPrimary, fontWeight: 800 }} />
                    </label>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}
      <button onClick={() => setCustomDrills((previous) => [...previous, { name: `Drill ${previous.length + 1}`, category: "spot", level: "stationary", zoneId: "under_basket", type: "Layup", targetType: "makes", targetValue: 10, minAttempts: 10 }])} style={{ padding: 14, borderRadius: radii.lg, border: `2px dashed ${colors.borderStrong}`, background: "transparent", color: colors.textSecondary, fontWeight: 700, cursor: "pointer" }}>+ Add drill</button>
      <button onClick={saveCustomTemplate} style={{ padding: 16, borderRadius: radii.lg, border: 0, background: BALL_ACCENT, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Save programme</button>
    </div>
  );

  const benchmarksView = (
    <div style={{ display: "grid", gap: 14, padding: "calc(env(safe-area-inset-top, 0px) + 20px) 18px 40px" }}>
      <BackButton onClick={() => setCurrentView("dashboard")} label="Basketball" />
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "-6px 0 0", color: colors.textPrimary }}>Benchmark tests</h1>
      <p style={{ ...typeScale.bodySm, color: colors.textSecondary, margin: 0 }}>Retest monthly to track real progress, not just workout volume.</p>
      {BENCHMARK_TESTS.map((test) => {
        const status = getBenchmarkStatus(app, test.id, today());
        const comparison = status.last ? compareBenchmarkValues(test, status.previous?.value ?? null, status.last.value) : null;
        return (
          <div key={test.id} style={{ padding: 14, borderRadius: radii.lg, background: colors.surface, border: `1px solid ${status.due ? BALL_ACCENT + "55" : colors.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: colors.textPrimary }}>{test.name}</p>
                <p style={{ margin: "3px 0 0", ...typeScale.caption, color: colors.textSecondary }}>{test.desc}</p>
              </div>
              {status.due && <span style={{ flexShrink: 0, ...typeScale.caption, fontWeight: 800, color: BALL_ACCENT, background: `${BALL_ACCENT}1a`, padding: "4px 8px", borderRadius: radii.pill }}>Due</span>}
            </div>

            {status.last ? (
              <p style={{ margin: "10px 0 0", ...typeScale.bodySm, color: colors.textSecondary }}>
                Last: <strong style={{ color: colors.textPrimary }}>{status.last.value}{test.unit === "sec" ? "s" : test.unit === "cm" ? "cm" : ""}</strong>
                {" · "}{status.reason}
                {comparison?.delta !== null && (
                  <span style={{ color: comparison.improved ? colors.success : colors.danger, fontWeight: 800 }}>
                    {" "}({comparison.delta > 0 ? "+" : ""}{comparison.delta} {comparison.improved ? "improved" : "down"})
                  </span>
                )}
              </p>
            ) : (
              <p style={{ margin: "10px 0 0", ...typeScale.bodySm, color: colors.textMuted }}>{status.reason}</p>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input
                type="number"
                inputMode="decimal"
                placeholder={test.metric === "makes" ? `out of ${test.outOf}` : test.unit}
                value={benchmarkDrafts[test.id] || ""}
                onChange={(event) => setBenchmarkDrafts((current) => ({ ...current, [test.id]: event.target.value }))}
                style={{ flex: 1, padding: 11, borderRadius: radii.md, border: `1px solid ${colors.border}`, background: colors.surfaceElevated, color: colors.textPrimary, fontWeight: 800 }}
              />
              <button
                onClick={() => recordBenchmark(test.id, benchmarkDrafts[test.id])}
                disabled={!Number.isFinite(Number(benchmarkDrafts[test.id]))}
                style={{ border: 0, borderRadius: radii.md, padding: "0 16px", background: BALL_ACCENT, color: "#fff", fontWeight: 800, cursor: "pointer", opacity: Number.isFinite(Number(benchmarkDrafts[test.id])) ? 1 : 0.4 }}
              >
                Record
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  const workout = activeSession ? (() => {
    const isStructured = activeSession.isStructured;
    const sessionShots = activeSession.shots || [];
    const drillIndex = activeSession.currentDrillIndex;
    const isWorkoutComplete = isStructured && drillIndex >= activeSession.drills.length;
    const currentDrill = isStructured && !isWorkoutComplete ? activeSession.drills[drillIndex] : null;
    const isRepDrill = currentDrill?.logType === "count";
    const currentZoneShots = sessionShots.filter((shot) => shot.zoneId === activeSession.currentZone && shot.type === activeSession.currentType);
    const freeMakes = currentZoneShots.filter((shot) => shot.result === "make").length;
    const freeTotal = currentZoneShots.length;
    const drillShots = isStructured && currentDrill ? sessionShots.filter((shot) => shot.drillIndex === drillIndex) : [];
    const drillReps = isRepDrill ? (activeSession.drillLogs[drillIndex]?.reps || 0) : 0;
    const drillProgress = currentDrill ? (isRepDrill ? getRepDrillProgress(currentDrill, drillReps) : getDrillProgress(currentDrill, drillShots)) : null;
    const totalMakes = sessionShots.filter((shot) => shot.result === "make").length;
    const totalShots = sessionShots.length;
    const pressureMode = getTemplateById(activeSession.templateId, customTemplates)?.specialRule === "pressure";
    const sessionWorkloadPreview = getSessionWorkload({ shots: sessionShots, drillLogs: Object.values(activeSession.drillLogs || {}) });

    if (isWorkoutComplete) {
      return (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, overflowY: "auto", background: "#07070B", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          <div>
            <Icon name="trophy" size={82} color={BALL_ACCENT} />
            <h1 style={{ fontSize: 32, lineHeight: 1.1, fontWeight: 800, margin: "20px 0 8px" }}>Workout complete</h1>
            <p style={{ color: colors.textSecondary, margin: "0 0 24px" }}>Great job. Your stats have been updated.</p>
            <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
              <StatPill label="Makes" value={`${totalMakes}/${totalShots}`} />
              <StatPill label="Percent" value={`${getPercent(totalMakes, totalShots)}%`} />
              <StatPill label="Workload" value={sessionWorkloadPreview.level} color={WORKLOAD_LEVEL_COLOR[sessionWorkloadPreview.level]} />
            </div>
            <button onClick={endSession} style={{ width: "100%", padding: 16, borderRadius: radii.lg, border: 0, background: BALL_ACCENT, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Save & return</button>
          </div>
        </div>
      );
    }

    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 200, overflowY: "auto", display: "flex", flexDirection: "column", background: "#07070B" }}>
        <div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", background: colors.surface, borderBottom: `1px solid ${colors.border}` }}>
          <p style={{ ...typeScale.overline, color: colors.textMuted, margin: 0, textTransform: "uppercase" }}>{isStructured ? `Drill ${drillIndex + 1} of ${activeSession.drills.length}` : "Free Shoot"}</p>
          <button onClick={endSession} style={{ border: 0, borderRadius: radii.pill, background: "rgba(255,93,93,0.12)", color: "#FF9A9A", padding: "9px 12px", fontWeight: 700, cursor: "pointer" }}>End early</button>
        </div>

        {AUTO_SHOT_ENABLED && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 10, background: "rgba(255,255,255,0.03)", borderBottom: `1px solid ${colors.border}` }}>
            <button onClick={() => setShotInputMode("manual")} style={{ border: `1px solid ${shotInputMode === "manual" ? BALL_ACCENT : colors.border}`, borderRadius: radii.pill, padding: "11px 12px", background: shotInputMode === "manual" ? `${BALL_ACCENT}2e` : colors.surface, color: shotInputMode === "manual" ? BALL_ACCENT : colors.textSecondary, fontWeight: 700, cursor: "pointer" }}>👆 Manual mode</button>
            <button onClick={() => setShotInputMode("auto")} style={{ border: `1px solid ${shotInputMode === "auto" ? BALL_ACCENT : colors.border}`, borderRadius: radii.pill, padding: "11px 12px", background: shotInputMode === "auto" ? `${BALL_ACCENT}2e` : colors.surface, color: shotInputMode === "auto" ? BALL_ACCENT : colors.textSecondary, fontWeight: 700, cursor: "pointer" }}>📷 Auto shot tracking</button>
          </div>
        )}

        {isStructured ? (
          <div style={{ padding: 22, textAlign: "center", borderBottom: `1px solid ${colors.border}`, background: "rgba(255,255,255,0.03)" }}>
            {pressureMode && activeSession.consecutiveMisses > 0 && <p style={{ margin: "0 0 8px", color: colors.danger, fontWeight: 800, letterSpacing: "0.06em" }}>⚠ 1 miss… danger!</p>}
            <h2 style={{ fontSize: 24, color: BALL_ACCENT, fontWeight: 800, margin: "0 0 4px" }}>{currentDrill.name}</h2>
            <p style={{ ...typeScale.bodySm, color: colors.textSecondary, margin: "0 0 18px" }}>
              {isRepDrill ? DRILL_CATEGORIES.find((c) => c.id === currentDrill.category)?.label : ZONES[currentDrill.zoneId]?.name} • {isRepDrill ? DRILL_LEVELS.find((l) => l.id === currentDrill.level)?.label : currentDrill.shotType}
            </p>
            <div style={{ maxWidth: 340, margin: "0 auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: colors.textMuted, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7 }}><span>{drillProgress.targetLabel}</span><span style={{ color: drillProgress.complete ? colors.success : colors.textPrimary }}>{drillProgress.progressLabel}</span></div>
              <div style={{ height: 12, borderRadius: radii.pill, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}><div style={{ width: `${drillProgress.ratio * 100}%`, height: "100%", background: BALL_ACCENT, transition: "width 180ms ease" }} /></div>
            </div>
            {drillProgress.complete && <button onClick={advanceDrill} style={{ marginTop: 18, border: 0, borderRadius: radii.pill, padding: "14px 20px", background: colors.success, color: "#04140D", fontWeight: 800, cursor: "pointer" }}>Drill complete ›</button>}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12, padding: 14, borderBottom: `1px solid ${colors.border}`, background: "rgba(255,255,255,0.03)" }}>
            <div style={{ display: "flex", gap: 10 }}>
              <SelectField label="Spot" value={activeSession.currentZone} onChange={(event) => setActiveSession({ ...activeSession, currentZone: event.target.value })}><ZoneOptions /></SelectField>
              <SelectField label="Shot" value={activeSession.currentType} onChange={(event) => setActiveSession({ ...activeSession, currentType: event.target.value })}>{SHOT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</SelectField>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <SelectField label="Category" value={activeSession.currentCategory} onChange={(event) => setActiveSession({ ...activeSession, currentCategory: event.target.value })}>
                {DRILL_CATEGORIES.filter((category) => category.shooting).map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
              </SelectField>
              <SelectField label="Level" value={activeSession.currentLevel} onChange={(event) => setActiveSession({ ...activeSession, currentLevel: event.target.value })}>
                {DRILL_LEVELS.map((level) => <option key={level.id} value={level.id}>{level.label}</option>)}
              </SelectField>
            </div>
            <ShotZoneCourtPicker
              zonesById={ZONES}
              selectedZoneId={activeSession.currentZone}
              onSelectZone={(zoneId) => setActiveSession({ ...activeSession, currentZone: zoneId })}
            />
          </div>
        )}

        <div style={{ flex: 1, display: "grid", placeItems: "center", textAlign: "center", padding: 24 }}>
          {AUTO_SHOT_ENABLED && shotInputMode === "auto" ? (
            <AutoShotMode
              onRecordShot={recordShot}
              currentZoneName={ZONES[isStructured ? currentDrill.zoneId : activeSession.currentZone]?.name}
              currentType={isStructured ? currentDrill.shotType : activeSession.currentType}
              disabled={isStructured && drillProgress?.complete}
            />
          ) : isRepDrill ? (
            <div>
              <p style={{ fontSize: 72, lineHeight: 1, fontWeight: 800, margin: 0 }}>{drillReps}</p>
              <p style={{ color: colors.textSecondary, fontWeight: 600, margin: "8px 0 0" }}>reps logged</p>
            </div>
          ) : (
            !isStructured && <div><p style={{ fontSize: 72, lineHeight: 1, fontWeight: 800, margin: 0 }}>{getPercent(freeMakes, freeTotal)}<span style={{ fontSize: 32, color: colors.textMuted }}>%</span></p><p style={{ color: colors.textSecondary, fontWeight: 600, margin: "8px 0 0" }}>{freeMakes} / {freeTotal}</p></div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateRows: "auto 1fr", gap: 8, padding: "8px 8px calc(env(safe-area-inset-bottom, 0px) + 8px)", minHeight: "38dvh" }}>
          {isRepDrill ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, minHeight: 0 }}>
              <button onClick={() => logRep(-1)} disabled={drillReps <= 0} style={{ border: `1px solid ${colors.border}`, borderRadius: 22, background: colors.surface, color: colors.textSecondary, fontSize: 22, fontWeight: 800, cursor: "pointer", opacity: drillReps <= 0 ? 0.4 : 1 }}>− 1 rep</button>
              <button onClick={() => { logRep(1); playCue("setLogged"); haptic("light"); }} style={{ border: 0, borderRadius: 22, background: colors.success, color: "#062015", fontSize: 22, fontWeight: 800, cursor: "pointer" }}>+ 1 rep</button>
            </div>
          ) : (
            <>
              <button
                onClick={undoLastShot}
                disabled={sessionShots.length === 0}
                style={{
                  width: "100%",
                  border: `1px solid ${colors.border}`,
                  borderRadius: radii.pill,
                  padding: "10px 12px",
                  background: sessionShots.length === 0 ? "rgba(255,255,255,0.03)" : colors.surface,
                  color: sessionShots.length === 0 ? colors.textMuted : colors.textPrimary,
                  fontWeight: 600,
                  cursor: sessionShots.length === 0 ? "not-allowed" : "pointer",
                  opacity: sessionShots.length === 0 ? 0.45 : 1,
                }}
              >
                ↶ Undo last shot
              </button>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, minHeight: 0 }}>
                <button onClick={() => recordShot("make")} disabled={isStructured && drillProgress?.complete} style={{ border: 0, borderBottom: "6px solid #1E9E70", borderRadius: 22, background: colors.success, color: "#062015", fontSize: 34, fontWeight: 800, cursor: "pointer", opacity: isStructured && drillProgress?.complete ? 0.25 : 1 }}>Make</button>
                <button onClick={() => recordShot("miss")} disabled={isStructured && drillProgress?.complete} style={{ border: 0, borderBottom: "6px solid #B23B3B", borderRadius: 22, background: colors.danger, color: "#fff", fontSize: 34, fontWeight: 800, cursor: "pointer", opacity: isStructured && drillProgress?.complete ? 0.25 : 1 }}>Miss</button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  })() : dashboard;

  return (
    <div style={{ minHeight: "100%", background: colors.background, color: colors.textPrimary }}>
      {currentView === "dashboard" && dashboard}
      {currentView === "setup" && setup}
      {currentView === "stats" && statsView}
      {currentView === "benchmarks" && benchmarksView}
      {currentView === "builder" && builder}
      {currentView === "card" && playerCard}
      {currentView === "workout" && workout}
    </div>
  );
}
