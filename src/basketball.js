// Basketball development engine: drill categories, progression levels,
// make-vs-attempt style targets, monthly benchmark tests, and a workload score
// so a hard shooting/conditioning session counts toward the athlete's overall
// plan instead of being invisible to the gym programme. Pure functions only —
// BasketballScreen owns all UI state; storage.js owns persistence shape.

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(fromDate, toDate) {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return Math.round((to - from) / DAY_MS);
}

// ---------------------------------------------------------------------------
// Drill categories & progression levels

export const DRILL_CATEGORIES = [
  { id: "form", label: "Form shooting", shooting: true, jumpWeight: 0.4 },
  { id: "spot", label: "Spot shooting", shooting: true, jumpWeight: 0.8 },
  { id: "offDribble", label: "Off-dribble shooting", shooting: true, jumpWeight: 1.1 },
  { id: "finishing", label: "Finishing", shooting: true, jumpWeight: 1.6 },
  { id: "ballHandling", label: "Ball handling", shooting: false, jumpWeight: 0.6 },
  { id: "freeThrow", label: "Free throws", shooting: true, jumpWeight: 0.3 },
  { id: "conditioning", label: "Conditioning", shooting: false, jumpWeight: 1.8 },
];

export const DRILL_LEVELS = [
  { id: "stationary", label: "Stationary", intensity: 0.6 },
  { id: "oneDribble", label: "One-dribble", intensity: 0.8 },
  { id: "liveFootwork", label: "Live footwork", intensity: 1.0 },
  { id: "gameSpeed", label: "Game-speed movement", intensity: 1.3 },
  { id: "defender", label: "Defender / constraint", intensity: 1.5 },
];

export function getCategory(id) {
  return DRILL_CATEGORIES.find((category) => category.id === id) || DRILL_CATEGORIES[1];
}

export function getLevel(id) {
  return DRILL_LEVELS.find((level) => level.id === id) || DRILL_LEVELS[0];
}

// ---------------------------------------------------------------------------
// Targets: make vs attempt vs percent vs streak

export const TARGET_TYPES = [
  { id: "makes", label: "Make N", example: "Make 20" },
  { id: "attempts", label: "Shoot N", example: "Shoot 25" },
  { id: "percent", label: "Reach N%", example: "Reach 70%" },
  { id: "streak", label: "N in a row", example: "Make 5 in a row" },
];

const DEFAULT_MIN_ATTEMPTS_FOR_PERCENT = 10;

export function normalizeDrill(drill = {}, index = 0) {
  return {
    id: drill.id || `drill-${index}`,
    name: drill.name || `Drill ${index + 1}`,
    category: DRILL_CATEGORIES.some((category) => category.id === drill.category) ? drill.category : "spot",
    level: DRILL_LEVELS.some((level) => level.id === drill.level) ? drill.level : "stationary",
    zoneId: drill.zoneId || "top3",
    shotType: drill.shotType || drill.type || "Catch & Shoot",
    logType: drill.logType === "count" || drill.logType === "time" ? drill.logType : "shots",
    targetType: TARGET_TYPES.some((target) => target.id === drill.targetType) ? drill.targetType : "makes",
    // targetMakes is the legacy field name from the original builder; keep reading it.
    targetValue: Math.max(1, Number(drill.targetValue ?? drill.targetMakes) || 10),
    minAttempts: Math.max(1, Number(drill.minAttempts) || DEFAULT_MIN_ATTEMPTS_FOR_PERCENT),
  };
}

export function describeTarget(drill) {
  const d = normalizeDrill(drill);
  if (d.targetType === "makes") return `Make ${d.targetValue}`;
  if (d.targetType === "attempts") return `Shoot ${d.targetValue}`;
  if (d.targetType === "percent") return `Reach ${d.targetValue}%`;
  return `Make ${d.targetValue} in a row`;
}

// Longest and current run of consecutive makes, in shot order.
export function computeStreaks(shots = []) {
  let best = 0;
  let current = 0;
  shots.forEach((shot) => {
    if (shot.result === "make") {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  });
  return { current, best };
}

// Progress + completion for one drill's logged shots, whatever target type it uses.
export function getDrillProgress(drill, shots = []) {
  const d = normalizeDrill(drill);
  const makes = shots.filter((shot) => shot.result === "make").length;
  const attempts = shots.length;
  const percent = attempts > 0 ? Math.round((makes / attempts) * 100) : 0;
  const { current: currentStreak, best: bestStreak } = computeStreaks(shots);

  let complete;
  let progressLabel;
  let ratio;

  if (d.targetType === "makes") {
    complete = makes >= d.targetValue;
    progressLabel = `${makes}/${d.targetValue} makes`;
    ratio = makes / d.targetValue;
  } else if (d.targetType === "attempts") {
    complete = attempts >= d.targetValue;
    progressLabel = `${attempts}/${d.targetValue} shots`;
    ratio = attempts / d.targetValue;
  } else if (d.targetType === "percent") {
    complete = attempts >= d.minAttempts && percent >= d.targetValue;
    progressLabel = attempts < d.minAttempts
      ? `${percent}% (${makes}/${attempts}, need ${d.minAttempts}+ attempts)`
      : `${percent}% (${makes}/${attempts})`;
    ratio = attempts / d.minAttempts;
  } else {
    complete = bestStreak >= d.targetValue;
    progressLabel = `Best streak ${bestStreak} (current ${currentStreak}), need ${d.targetValue}`;
    ratio = bestStreak / d.targetValue;
  }

  return { makes, attempts, percent, currentStreak, bestStreak, complete, targetLabel: describeTarget(d), progressLabel, ratio: Math.min(1, ratio) };
}

// Progress for a rep-counted (non-shooting) drill: ball handling reps, a
// conditioning round count, etc. Only "makes"/"attempts" targets make sense
// here (there's no result to stream, just a running count).
export function getRepDrillProgress(drill, reps = 0) {
  const d = normalizeDrill(drill);
  const count = Number(reps) || 0;
  const complete = count >= d.targetValue;
  return {
    reps: count,
    complete,
    targetLabel: `Reach ${d.targetValue} reps`,
    progressLabel: `${count}/${d.targetValue}`,
    ratio: Math.min(1, count / d.targetValue),
  };
}

// ---------------------------------------------------------------------------
// Workload: every logged rep contributes jump/sprint load from its category
// and progression level, so a hard basketball session shows up as real
// training load elsewhere in the app (readiness, "don't treat this as rest").

export function getRepLoad(category, level) {
  return getCategory(category).jumpWeight * getLevel(level).intensity;
}

const WORKLOAD_HIGH_THRESHOLD = 60;
const WORKLOAD_MODERATE_THRESHOLD = 25;

// session.shots: [{ category, level, result }]; session.drillLogs (for
// logType: "count"/"time" drills): [{ category, level, reps }].
export function getSessionWorkload(session) {
  const shots = Array.isArray(session?.shots) ? session.shots : [];
  const drillLogs = Array.isArray(session?.drillLogs) ? session.drillLogs : [];

  let totalLoad = 0;
  let repCount = 0;
  shots.forEach((shot) => {
    totalLoad += getRepLoad(shot.category, shot.level);
    repCount += 1;
  });
  drillLogs.forEach((log) => {
    const reps = Math.max(0, Number(log.reps) || 0);
    totalLoad += getRepLoad(log.category, log.level) * reps;
    repCount += reps;
  });

  const level = totalLoad >= WORKLOAD_HIGH_THRESHOLD ? "high" : totalLoad >= WORKLOAD_MODERATE_THRESHOLD ? "moderate" : "low";
  return { totalLoad: Math.round(totalLoad * 10) / 10, repCount, level };
}

export function isHighLoadSession(session) {
  return getSessionWorkload(session).level === "high";
}

// ---------------------------------------------------------------------------
// Monthly benchmark tests

export const BENCHMARK_TESTS = [
  { id: "freeThrows50", name: "Free throws", desc: "50 free throws — count makes.", metric: "makes", outOf: 50, unit: "makes", lowerIsBetter: false },
  { id: "midrangeFiveSpot", name: "Five-spot midrange", desc: "5 shots from each of 5 midrange spots (25 total).", metric: "makes", outOf: 25, unit: "makes", lowerIsBetter: false },
  { id: "threePointFiveSpot", name: "Five-spot three-point", desc: "5 shots from each of 5 three-point spots (25 total).", metric: "makes", outOf: 25, unit: "makes", lowerIsBetter: false },
  { id: "finishingPackage", name: "Finishing package", desc: "20 finishing attempts — layups, contact, reverse.", metric: "makes", outOf: 20, unit: "makes", lowerIsBetter: false },
  { id: "ballHandlingTrial", name: "Ball-handling time trial", desc: "Run the ball-handling course, record your time.", metric: "time", unit: "sec", lowerIsBetter: true },
  { id: "verticalJump", name: "Vertical jump check", desc: "Best of 3 jumps.", metric: "distance", unit: "cm", lowerIsBetter: false },
];

export function getBenchmarkTest(id) {
  return BENCHMARK_TESTS.find((test) => test.id === id) || null;
}

const BENCHMARK_INTERVAL_DAYS = 28; // "monthly"

// Whether a benchmark is due, given the account's recorded results.
export function getBenchmarkStatus(app, benchmarkId, today) {
  const test = getBenchmarkTest(benchmarkId);
  const results = (app?.basketballBenchmarks || [])
    .filter((result) => result.testId === benchmarkId)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const last = results[results.length - 1] || null;

  if (!last) {
    return { test, last: null, previous: null, due: true, daysSinceLast: null, reason: "Never tested." };
  }

  const daysSinceLast = daysBetween(last.date, today);
  const due = daysSinceLast === null || daysSinceLast >= BENCHMARK_INTERVAL_DAYS;
  return {
    test,
    last,
    previous: results[results.length - 2] || null,
    due,
    daysSinceLast,
    reason: due
      ? `Last tested ${daysSinceLast} day${daysSinceLast === 1 ? "" : "s"} ago — retest.`
      : `Tested ${daysSinceLast} day${daysSinceLast === 1 ? "" : "s"} ago. Next test in ${BENCHMARK_INTERVAL_DAYS - daysSinceLast} days.`,
  };
}

// Improvement between two recorded values, respecting direction (lower time is
// better; higher makes/distance is better).
export function compareBenchmarkValues(test, previousValue, newValue) {
  if (previousValue === null || previousValue === undefined || !Number.isFinite(Number(previousValue))) {
    return { delta: null, improved: null };
  }
  const delta = Math.round((Number(newValue) - Number(previousValue)) * 100) / 100;
  const improved = test?.lowerIsBetter ? delta < 0 : delta > 0;
  return { delta, improved };
}
