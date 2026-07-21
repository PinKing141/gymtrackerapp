import { useMemo, useState } from "react";
import { IS, fd, parseStoredDate, today } from "../storage.js";
import { getWeekKey } from "../streaks.js";
import {
  PLAN_TYPES,
  WEEKDAY_LABELS,
  addDays,
  addPlanItem,
  getPlanForDate,
  getScheduleWarnings,
  isDeloadWeek,
  moveOccurrence,
  removeOccurrence,
  setOccurrenceStatus,
  toggleDeloadWeek,
  weekdayIndex,
} from "../trainingPlan.js";
import { getWorkoutPresets } from "../workouts.js";
import { Icon } from "../components/icons.jsx";
import { ActionButton, BackButton, Screen, ScreenHeader, SurfaceCard } from "../components/ui.jsx";
import { colors, typeScale } from "../theme.js";

const TYPE_COLORS = {
  gym: "#4EA1FF",
  basketball: "#F5A623",
  cardio: "#3DDC97",
  recovery: "#8B5CF6",
  rest: "#8A8F9C",
};

const STATUS_LABELS = {
  completed: { label: "Completed", color: "#3DDC97" },
  missed: { label: "Missed", color: "#FF5D5D" },
  skipped: { label: "Skipped", color: "#8A8F9C" },
  planned: { label: "Planned", color: "#9AA4B3" },
};

function itemKey(item) {
  return `${item.ref.date}:${item.ref.slotId || item.ref.entryId}`;
}

// 6 rows × 7 columns of dates covering the anchor's month, Monday-first.
function monthMatrix(anchor) {
  const parsed = parseStoredDate(anchor) || new Date();
  const firstOfMonth = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-01`;
  const gridStart = getWeekKey(firstOfMonth);
  return Array.from({ length: 6 }, (_, row) =>
    Array.from({ length: 7 }, (_, column) => addDays(gridStart, row * 7 + column))
  );
}

function shiftMonth(anchor, delta) {
  const parsed = parseStoredDate(anchor) || new Date();
  const next = new Date(parsed.getFullYear(), parsed.getMonth() + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthLabel(anchor) {
  const parsed = parseStoredDate(anchor) || new Date();
  return parsed.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function statusDotStyle(item) {
  const typeColor = TYPE_COLORS[item.type] || "#9AA4B3";
  if (item.status === "missed") return { background: "#FF5D5D" };
  if (item.status === "skipped") return { background: "rgba(255,255,255,0.22)" };
  if (item.status === "completed") return { background: typeColor };
  return { background: "transparent", border: `1.5px solid ${typeColor}` };
}

function SmallButton({ children, tone = "neutral", onClick }) {
  const palette = {
    neutral: { color: "#C9CEDA", border: colors.border },
    danger: { color: "#FF8A8A", border: "rgba(255,93,93,0.35)" },
    accent: { color: colors.accent, border: "rgba(78,161,255,0.4)" },
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${palette.border}`, borderRadius: 8, color: palette.color, fontFamily: "inherit", fontSize: 11, fontWeight: 700, padding: "6px 9px", cursor: "pointer" }}
    >
      {children}
    </button>
  );
}

export function CalendarScreen({ app, onBack, onUpdatePlan, onStartWorkout }) {
  const todayDate = today();
  const [anchor, setAnchor] = useState(todayDate);
  const [selectedDate, setSelectedDate] = useState(todayDate);
  const [selectedKey, setSelectedKey] = useState(null);
  const [movingKey, setMovingKey] = useState(null);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({ type: "gym", presetId: "", repeatWeekly: true });

  const presets = useMemo(() => getWorkoutPresets(app), [app]);
  const matrix = useMemo(() => monthMatrix(anchor), [anchor]);
  const anchorParsed = parseStoredDate(anchor) || new Date();
  const monthPrefix = `${anchorParsed.getFullYear()}-${String(anchorParsed.getMonth() + 1).padStart(2, "0")}`;

  const dayItems = getPlanForDate(app, selectedDate, todayDate);
  const warnings = getScheduleWarnings(app, selectedDate, todayDate);
  const deload = isDeloadWeek(app.trainingPlan, selectedDate);
  const selectedWeekKey = getWeekKey(selectedDate);

  const closePanels = () => {
    setSelectedKey(null);
    setMovingKey(null);
    setAdding(false);
  };

  const pickDate = (date) => {
    setSelectedDate(date);
    closePanels();
  };

  const submitAdd = () => {
    const payload = {
      date: selectedDate,
      type: addForm.type,
      presetId: addForm.type === "gym" ? addForm.presetId || null : null,
      repeatWeekly: addForm.repeatWeekly,
    };
    if (payload.type === "gym" && !payload.presetId) return;
    onUpdatePlan((plan) => addPlanItem(plan, payload));
    closePanels();
  };

  const moveTargets = Array.from({ length: 7 }, (_, index) => addDays(todayDate, index));
  const selectedWeekdayLabel = WEEKDAY_LABELS[weekdayIndex(selectedDate)];

  return (
    <Screen>
      <ScreenHeader
        action={<BackButton onClick={onBack} />}
        title="Training Calendar"
        topPadding="calc(env(safe-area-inset-top, 0px) + 20px)"
      />

      {/* Month header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <button type="button" aria-label="Previous month" onClick={() => setAnchor((current) => shiftMonth(current, -1))} style={{ width: 30, height: 30, borderRadius: 9, border: `1px solid ${colors.border}`, background: "rgba(255,255,255,0.04)", color: colors.textSecondary, cursor: "pointer", fontSize: 15, fontWeight: 700 }}>‹</button>
        <p style={{ flex: 1, margin: 0, textAlign: "center", fontSize: 15, fontWeight: 800, color: colors.textPrimary }}>{monthLabel(anchor)}</p>
        <button type="button" aria-label="Next month" onClick={() => setAnchor((current) => shiftMonth(current, 1))} style={{ width: 30, height: 30, borderRadius: 9, border: `1px solid ${colors.border}`, background: "rgba(255,255,255,0.04)", color: colors.textSecondary, cursor: "pointer", fontSize: 15, fontWeight: 700 }}>›</button>
        <SmallButton onClick={() => { setAnchor(todayDate); pickDate(todayDate); }}>Today</SmallButton>
      </div>

      {/* Month grid */}
      <SurfaceCard style={{ padding: "12px 10px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 6 }}>
          {WEEKDAY_LABELS.map((label) => (
            <p key={label} style={{ margin: 0, textAlign: "center", fontSize: 9, fontWeight: 800, letterSpacing: "0.06em", color: colors.textMuted }}>{label.slice(0, 3).toUpperCase()}</p>
          ))}
        </div>

        {matrix.map((weekRow) => {
          const weekIsDeload = isDeloadWeek(app.trainingPlan, weekRow[0]);
          return (
            <div key={weekRow[0]} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 2, borderRadius: 10, background: weekIsDeload ? "rgba(246,183,60,0.05)" : "transparent" }}>
              {weekRow.map((date) => {
                const inMonth = date.slice(0, 7) === monthPrefix;
                const isToday = date === todayDate;
                const isSelected = date === selectedDate;
                const items = getPlanForDate(app, date, todayDate);
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => pickDate(date)}
                    aria-label={`${fd(date)}${items.length ? `, ${items.length} planned` : ""}`}
                    style={{
                      fontFamily: "inherit",
                      cursor: "pointer",
                      padding: "6px 0 5px",
                      minHeight: 46,
                      borderRadius: 10,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      background: isSelected ? "rgba(78,161,255,0.16)" : "transparent",
                      border: isSelected ? `1px solid ${colors.accent}` : isToday ? `1px solid rgba(78,161,255,0.45)` : "1px solid transparent",
                      borderBottom: weekIsDeload && !isSelected && !isToday ? "2px solid rgba(246,183,60,0.45)" : undefined,
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: isToday || isSelected ? 800 : 600, color: !inMonth ? "rgba(255,255,255,0.22)" : isToday ? colors.accent : colors.textPrimary, lineHeight: 1 }}>
                      {Number(date.slice(8, 10))}
                    </span>
                    <span style={{ display: "flex", gap: 3, minHeight: 6, alignItems: "center" }}>
                      {items.slice(0, 3).map((item) => (
                        <span key={itemKey(item)} style={{ width: 6, height: 6, borderRadius: 999, boxSizing: "border-box", opacity: inMonth ? 1 : 0.35, ...statusDotStyle(item) }} />
                      ))}
                      {items.length > 3 && <span style={{ fontSize: 8, color: colors.textMuted, lineHeight: 1 }}>+{items.length - 3}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}

        {/* Legend */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", marginTop: 10, paddingTop: 10, borderTop: `1px solid ${colors.border}` }}>
          {PLAN_TYPES.filter((type) => type.id !== "rest").map((type) => (
            <span key={type.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 9, fontWeight: 700, color: colors.textMuted }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: TYPE_COLORS[type.id] }} />
              {type.label}
            </span>
          ))}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 9, fontWeight: 700, color: colors.textMuted }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "#FF5D5D" }} />
            Missed
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 9, fontWeight: 700, color: colors.textMuted }}>
            <span style={{ width: 10, height: 2, borderRadius: 2, background: "rgba(246,183,60,0.6)" }} />
            Deload week
          </span>
        </div>
      </SurfaceCard>

      {/* Selected day */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "14px 0 10px" }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: selectedDate === todayDate ? colors.accent : colors.textPrimary }}>
          {selectedWeekdayLabel}, {fd(selectedDate)}{selectedDate === todayDate ? " · Today" : ""}
        </p>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => onUpdatePlan((plan) => toggleDeloadWeek(plan, selectedWeekKey))}
            style={{ background: deload ? "rgba(246,183,60,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${deload ? "rgba(246,183,60,0.5)" : colors.border}`, borderRadius: 999, color: deload ? colors.warning : colors.textMuted, fontFamily: "inherit", fontSize: 10, fontWeight: 700, padding: "6px 10px", cursor: "pointer" }}
          >
            {deload ? "Deload ✓" : "Deload"}
          </button>
          <button
            type="button"
            aria-label={`Add to ${selectedWeekdayLabel}`}
            onClick={() => {
              setAdding((current) => !current);
              setSelectedKey(null);
              setMovingKey(null);
              setAddForm({ type: "gym", presetId: presets[0]?.id || "", repeatWeekly: true });
            }}
            style={{ width: 28, height: 28, borderRadius: 9, border: `1px solid ${colors.border}`, background: "rgba(255,255,255,0.04)", color: colors.textSecondary, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <Icon name="plus" size={14} color={colors.textSecondary} />
          </button>
        </div>
      </div>

      {warnings.map((warning) => (
        <SurfaceCard key={warning} style={{ border: "1px solid rgba(246,183,60,0.3)", background: "rgba(246,183,60,0.06)" }}>
          <p style={{ margin: 0, fontSize: 12, color: "#FFCA8A", lineHeight: 1.5 }}>{warning}</p>
        </SurfaceCard>
      ))}

      {dayItems.length === 0 && !adding && (
        <SurfaceCard>
          <p style={{ margin: 0, ...typeScale.caption, color: colors.textMuted }}>Nothing planned — tap + to schedule a session.</p>
        </SurfaceCard>
      )}

      {dayItems.map((item) => {
        const key = itemKey(item);
        const status = STATUS_LABELS[item.status] || STATUS_LABELS.planned;
        const typeColor = TYPE_COLORS[item.type] || colors.textMuted;
        const selected = selectedKey === key;
        return (
          <SurfaceCard key={key} style={{ padding: "11px 13px", border: `1px solid ${selected ? typeColor : "rgba(255,255,255,0.06)"}` }}>
            <button
              type="button"
              onClick={() => {
                setSelectedKey(selected ? null : key);
                setMovingKey(null);
                setAdding(false);
              }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
            >
              <span style={{ width: 10, height: 10, borderRadius: 999, boxSizing: "border-box", flexShrink: 0, ...statusDotStyle(item) }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: item.status === "skipped" ? colors.textMuted : colors.textPrimary, textDecoration: item.status === "skipped" ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
                <span style={{ display: "block", fontSize: 10, color: colors.textMuted }}>
                  <span style={{ color: status.color, fontWeight: 700 }}>{status.label}</span>
                  {item.recurring ? " · repeats weekly" : ""}{item.movedFrom ? ` · moved from ${fd(item.movedFrom)}` : ""}
                </span>
              </span>
              <span style={{ color: colors.textMuted, fontSize: 15 }}>{selected ? "▾" : "▸"}</span>
            </button>

            {selected && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 10 }}>
                {item.type === "gym" && item.status === "planned" && selectedDate === todayDate && onStartWorkout && item.presetId && (
                  <SmallButton tone="accent" onClick={() => onStartWorkout(item.presetId)}>Start now</SmallButton>
                )}
                {item.status !== "skipped" && item.status !== "completed" && (
                  <SmallButton onClick={() => { onUpdatePlan((plan) => setOccurrenceStatus(plan, item.ref, "skipped")); closePanels(); }}>Mark skipped</SmallButton>
                )}
                {item.status === "skipped" && (
                  <SmallButton onClick={() => { onUpdatePlan((plan) => setOccurrenceStatus(plan, item.ref, null)); closePanels(); }}>Restore</SmallButton>
                )}
                {item.type !== "rest" && item.status !== "completed" && (
                  <SmallButton tone="accent" onClick={() => setMovingKey(movingKey === key ? null : key)}>Move…</SmallButton>
                )}
                <SmallButton tone="danger" onClick={() => { onUpdatePlan((plan) => removeOccurrence(plan, item.ref)); closePanels(); }}>
                  {item.recurring ? "Remove this day" : "Remove"}
                </SmallButton>
                {item.recurring && (
                  <SmallButton tone="danger" onClick={() => { onUpdatePlan((plan) => removeOccurrence(plan, item.ref, { wholeSeries: true })); closePanels(); }}>End series</SmallButton>
                )}
              </div>
            )}

            {selected && movingKey === key && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 8 }}>
                {moveTargets.filter((target) => target !== item.ref.date).map((target) => (
                  <SmallButton
                    key={target}
                    onClick={() => { onUpdatePlan((plan, currentApp) => moveOccurrence(plan, currentApp, item.ref, target)); setSelectedDate(target); closePanels(); }}
                  >
                    {target === todayDate ? "Today" : target === addDays(todayDate, 1) ? "Tomorrow" : `${WEEKDAY_LABELS[weekdayIndex(target)].slice(0, 3)} ${fd(target)}`}
                  </SmallButton>
                ))}
              </div>
            )}
          </SurfaceCard>
        );
      })}

      {adding && (
        <SurfaceCard style={{ border: `1px dashed ${colors.borderStrong || colors.border}` }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {PLAN_TYPES.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setAddForm((current) => ({ ...current, type: type.id }))}
                  style={{ background: addForm.type === type.id ? `${TYPE_COLORS[type.id]}22` : "rgba(255,255,255,0.04)", border: `1px solid ${addForm.type === type.id ? TYPE_COLORS[type.id] : colors.border}`, borderRadius: 999, color: addForm.type === type.id ? colors.textPrimary : colors.textMuted, fontFamily: "inherit", fontSize: 11, fontWeight: 700, padding: "6px 10px", cursor: "pointer" }}
                >
                  {type.label}
                </button>
              ))}
            </div>

            {addForm.type === "gym" && (presets.length ? (
              <select value={addForm.presetId} onChange={(event) => setAddForm((current) => ({ ...current, presetId: event.target.value }))} style={IS}>
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.title}</option>
                ))}
              </select>
            ) : (
              <p style={{ margin: 0, ...typeScale.caption, color: colors.warning }}>No workout presets yet — build one in Train first.</p>
            ))}

            <button
              type="button"
              onClick={() => setAddForm((current) => ({ ...current, repeatWeekly: !current.repeatWeekly }))}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left", fontSize: 11, fontWeight: 700, color: addForm.repeatWeekly ? colors.accent : colors.textMuted }}
            >
              {addForm.repeatWeekly ? `↻ Repeats every ${selectedWeekdayLabel}` : `→ Only ${fd(selectedDate)} (tap to repeat weekly)`}
            </button>

            <div style={{ display: "flex", gap: 8 }}>
              <ActionButton compact tone="tinted" color="#2D7DD2" disabled={addForm.type === "gym" && !addForm.presetId} onClick={submitAdd}>Add</ActionButton>
              <ActionButton compact tone="secondary" onClick={() => setAdding(false)}>Cancel</ActionButton>
            </div>
          </div>
        </SurfaceCard>
      )}

      <p style={{ margin: "8px 2px 0", ...typeScale.caption, color: colors.textMuted, lineHeight: 1.5 }}>
        Recurring items repeat weekly. Changing, moving or skipping a day only affects that occurrence — the programme keeps its shape.
      </p>
    </Screen>
  );
}
