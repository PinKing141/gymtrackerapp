import { DEFAULT_TRAINING_PLAN, isObj, parseStoredDate, today } from "./storage.js";
import { getWeekKey } from "./streaks.js";
import { getWorkoutPresets } from "./workouts.js";

// Training calendar engine. A plan is:
//   template:    { [weekday 0-6, Monday=0]: [slot] } — the recurring weekly plan
//   entries:     per-date records layered on top of the template — one-off items,
//                status overrides for a single occurrence, occurrence removals
//                (used by "move" and "delete this day only"), and moved-in items
//   deloadWeeks: week keys (Mondays) marked as deload
//
// Everything here is pure: functions take a plan (or the whole app) and return
// data or a new plan. Nothing mutates.

export const PLAN_TYPES = [
  { id: "gym", label: "Gym workout" },
  { id: "basketball", label: "Basketball" },
  { id: "cardio", label: "Cardio" },
  { id: "recovery", label: "Recovery / mobility" },
  { id: "rest", label: "Rest day" },
];

export const WEEKDAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const DAY_MS = 24 * 60 * 60 * 1000;

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function withPlanDefaults(plan) {
  const base = DEFAULT_TRAINING_PLAN();
  if (!isObj(plan)) return base;
  return {
    template: isObj(plan.template) ? plan.template : base.template,
    entries: Array.isArray(plan.entries) ? plan.entries : base.entries,
    deloadWeeks: Array.isArray(plan.deloadWeeks) ? plan.deloadWeeks : base.deloadWeeks,
  };
}

// ---------------------------------------------------------------------------
// Date helpers (Monday-indexed to match the app's weeks)

export function weekdayIndex(date) {
  const parsed = parseStoredDate(date) || new Date();
  return (parsed.getDay() + 6) % 7;
}

export function addDays(date, days) {
  const parsed = parseStoredDate(date) || new Date();
  const next = new Date(parsed.getTime() + days * DAY_MS);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

export function weekDates(anchorDate) {
  const monday = getWeekKey(anchorDate);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

// ---------------------------------------------------------------------------
// Resolution: what is planned on a given date?

function typeLabel(type) {
  return PLAN_TYPES.find((entry) => entry.id === type)?.label || "Session";
}

function itemTitle(item, presets) {
  if (item.type === "gym") {
    const preset = presets.find((candidate) => candidate.id === item.presetId);
    if (preset) return preset.title;
  }
  return item.label || typeLabel(item.type);
}

function loggedActivityForType(app, date, type) {
  if (type === "gym") return (app?.sessions || []).filter((session) => session?.date === date);
  if (type === "basketball") return (app?.basketballSessions || []).filter((session) => session?.date === date);
  if (type === "cardio") return (app?.cardioSessions || []).filter((session) => session?.date === date);
  if (type === "recovery") return (app?.recovery || []).filter((entry) => entry?.date === date);
  return [];
}

// Match logged gym sessions to gym occurrences: by preset first, then in order.
function assignGymCompletions(items, sessions) {
  const unclaimed = [...sessions];
  items.forEach((item) => {
    const matchIndex = unclaimed.findIndex((session) => session.workoutId === item.presetId);
    if (matchIndex >= 0) {
      item.completed = true;
      unclaimed.splice(matchIndex, 1);
    }
  });
  items.forEach((item) => {
    if (!item.completed && unclaimed.length) {
      item.completed = true;
      unclaimed.shift();
    }
  });
}

// Resolved occurrences for one date. Each occurrence carries a `ref` that the
// mutation helpers below accept: { date, slotId } for template occurrences,
// { date, entryId } for one-off entries.
export function getPlanForDate(app, date, todayDate = today()) {
  const plan = withPlanDefaults(app?.trainingPlan);
  const presets = getWorkoutPresets(app);
  const dayEntries = plan.entries.filter((entry) => entry?.date === date);

  const items = [];

  (plan.template[weekdayIndex(date)] || []).forEach((slot) => {
    const removal = dayEntries.find((entry) => entry.slotId === slot.id && entry.removed);
    if (removal) return;
    const override = dayEntries.find((entry) => entry.slotId === slot.id && !entry.removed && !entry.type);
    items.push({
      ref: { date, slotId: slot.id },
      recurring: true,
      type: slot.type,
      presetId: slot.presetId || null,
      title: itemTitle(slot, presets),
      statusOverride: override?.status || null,
    });
  });

  dayEntries.forEach((entry) => {
    if (!entry.type || entry.removed) return;
    items.push({
      ref: { date, entryId: entry.id },
      recurring: false,
      type: entry.type,
      presetId: entry.presetId || null,
      title: itemTitle(entry, presets),
      statusOverride: entry.status || null,
      movedFrom: entry.movedFrom || null,
    });
  });

  const gymItems = items.filter((item) => item.type === "gym" && !item.statusOverride);
  assignGymCompletions(gymItems, loggedActivityForType(app, date, "gym"));

  const isPast = date < todayDate;
  items.forEach((item) => {
    if (item.statusOverride) {
      item.status = item.statusOverride;
    } else if (item.type === "rest") {
      item.status = "planned";
    } else if (item.type === "gym") {
      item.status = item.completed ? "completed" : isPast ? "missed" : "planned";
    } else {
      const done = loggedActivityForType(app, date, item.type).length > 0;
      item.status = done ? "completed" : isPast ? "missed" : "planned";
    }
    delete item.statusOverride;
    delete item.completed;
  });

  return items;
}

export function getWeekPlan(app, anchorDate, todayDate = today()) {
  return weekDates(anchorDate).map((date) => ({
    date,
    weekday: WEEKDAY_LABELS[weekdayIndex(date)],
    items: getPlanForDate(app, date, todayDate),
  }));
}

export function isDeloadWeek(plan, anchorDate) {
  return withPlanDefaults(plan).deloadWeeks.includes(getWeekKey(anchorDate));
}

// ---------------------------------------------------------------------------
// Mutations (all return a new plan)

export function addPlanItem(plan, { date, type, presetId = null, label = null, repeatWeekly = false }) {
  const next = withPlanDefaults(plan);
  if (repeatWeekly) {
    const weekday = weekdayIndex(date);
    const slot = { id: makeId("slot"), type, presetId, label };
    return {
      ...next,
      template: { ...next.template, [weekday]: [...(next.template[weekday] || []), slot] },
    };
  }
  const entry = { id: makeId("entry"), date, type, presetId, label, status: null };
  return { ...next, entries: [...next.entries, entry] };
}

function upsertOccurrenceOverride(next, ref, patch) {
  const existing = next.entries.find((entry) => entry.slotId === ref.slotId && entry.date === ref.date && !entry.type);
  if (existing) {
    return {
      ...next,
      entries: next.entries.map((entry) => (entry === existing ? { ...entry, ...patch } : entry)),
    };
  }
  return {
    ...next,
    entries: [...next.entries, { id: makeId("entry"), date: ref.date, slotId: ref.slotId, ...patch }],
  };
}

// Set an occurrence's status ("skipped", "completed", or null to clear back to
// automatic). Only affects the one date — the recurring slot is untouched.
export function setOccurrenceStatus(plan, ref, status) {
  const next = withPlanDefaults(plan);
  if (ref.entryId) {
    return {
      ...next,
      entries: next.entries.map((entry) => (entry.id === ref.entryId ? { ...entry, status } : entry)),
    };
  }
  return upsertOccurrenceOverride(next, ref, { status, removed: false });
}

// Move one occurrence to another date (e.g. missed Tuesday → Wednesday). The
// recurring slot keeps its weekday for future weeks; only this occurrence moves.
export function moveOccurrence(plan, app, ref, toDate) {
  const next = withPlanDefaults(plan);
  const item = getPlanForDate(app, ref.date).find((candidate) =>
    ref.entryId ? candidate.ref.entryId === ref.entryId : candidate.ref.slotId === ref.slotId
  );
  if (!item || toDate === ref.date) return next;

  if (ref.entryId) {
    return {
      ...next,
      entries: next.entries.map((entry) =>
        entry.id === ref.entryId ? { ...entry, date: toDate, movedFrom: entry.movedFrom || ref.date, status: null } : entry
      ),
    };
  }

  const withRemoval = upsertOccurrenceOverride(next, ref, { removed: true, status: null });
  return {
    ...withRemoval,
    entries: [
      ...withRemoval.entries,
      { id: makeId("entry"), date: toDate, type: item.type, presetId: item.presetId, label: item.title, movedFrom: ref.date, status: null },
    ],
  };
}

// Remove one occurrence only (this date), or the whole recurring series.
export function removeOccurrence(plan, ref, { wholeSeries = false } = {}) {
  const next = withPlanDefaults(plan);
  if (ref.entryId) {
    return { ...next, entries: next.entries.filter((entry) => entry.id !== ref.entryId) };
  }
  if (wholeSeries) {
    return {
      ...next,
      template: Object.fromEntries(
        Object.entries(next.template).map(([weekday, slots]) => [weekday, slots.filter((slot) => slot.id !== ref.slotId)])
      ),
      entries: next.entries.filter((entry) => entry.slotId !== ref.slotId),
    };
  }
  return upsertOccurrenceOverride(next, ref, { removed: true, status: null });
}

export function toggleDeloadWeek(plan, anchorDate) {
  const next = withPlanDefaults(plan);
  const weekKey = getWeekKey(anchorDate);
  return {
    ...next,
    deloadWeeks: next.deloadWeeks.includes(weekKey)
      ? next.deloadWeeks.filter((key) => key !== weekKey)
      : [...next.deloadWeeks, weekKey],
  };
}

// ---------------------------------------------------------------------------
// Missed-workout prompt: recent trainable items that were neither done nor
// deliberately skipped. The Today dashboard offers "move to today or skip?".

export function getMissedItems(app, todayDate = today(), lookbackDays = 3) {
  const missed = [];
  for (let back = 1; back <= lookbackDays; back += 1) {
    const date = addDays(todayDate, -back);
    getPlanForDate(app, date, todayDate).forEach((item) => {
      if (item.status === "missed" && item.type !== "rest" && item.type !== "recovery") {
        missed.push({ ...item, date, weekday: WEEKDAY_LABELS[weekdayIndex(date)] });
      }
    });
  }
  return missed;
}

// ---------------------------------------------------------------------------
// Transparent scheduling warnings. Rule: hard lower-body gym work scheduled the
// day right after a basketball session is worth flagging (not blocking).

const LOWER_BODY_PATTERN = /lower|leg|squat|deadlift|glute|explosive|power/i;

export function getScheduleWarnings(app, anchorDate, todayDate = today()) {
  const days = getWeekPlan(app, anchorDate, todayDate);
  const warnings = [];
  for (let index = 1; index < days.length; index += 1) {
    const previous = days[index - 1];
    const current = days[index];
    const hadBasketball = previous.items.some((item) => item.type === "basketball" && item.status !== "skipped");
    if (!hadBasketball) continue;
    current.items.forEach((item) => {
      if (item.type === "gym" && item.status !== "skipped" && LOWER_BODY_PATTERN.test(item.title)) {
        warnings.push(
          `${current.weekday}: "${item.title}" is scheduled the day after basketball (${previous.weekday}). Consider spacing hard lower-body work after high-load basketball.`
        );
      }
    });
  }
  return warnings;
}
