import { useMemo, useState } from "react";
import { IS, fd, today } from "../storage.js";
import { getWeekLabel } from "../streaks.js";
import {
  PLAN_TYPES,
  WEEKDAY_LABELS,
  addDays,
  addPlanItem,
  getScheduleWarnings,
  getWeekPlan,
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

const STATUS_GLYPHS = {
  completed: { glyph: "✓", color: "#3DDC97", label: "Completed" },
  missed: { glyph: "✕", color: "#FF5D5D", label: "Missed" },
  skipped: { glyph: "–", color: "#8A8F9C", label: "Skipped" },
  planned: { glyph: "○", color: "#9AA4B3", label: "Planned" },
};

function itemKey(item) {
  return `${item.ref.date}:${item.ref.slotId || item.ref.entryId}`;
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
  const [selectedKey, setSelectedKey] = useState(null);
  const [movingKey, setMovingKey] = useState(null);
  const [addingDate, setAddingDate] = useState(null);
  const [addForm, setAddForm] = useState({ type: "gym", presetId: "", repeatWeekly: true });

  const presets = useMemo(() => getWorkoutPresets(app), [app]);
  const week = getWeekPlan(app, anchor, todayDate);
  const warnings = getScheduleWarnings(app, anchor, todayDate);
  const deload = isDeloadWeek(app.trainingPlan, anchor);

  const closePanels = () => {
    setSelectedKey(null);
    setMovingKey(null);
    setAddingDate(null);
  };

  const shiftWeek = (weeks) => {
    setAnchor((current) => addDays(current, weeks * 7));
    closePanels();
  };

  const submitAdd = (date) => {
    const payload = {
      date,
      type: addForm.type,
      presetId: addForm.type === "gym" ? addForm.presetId || null : null,
      repeatWeekly: addForm.repeatWeekly,
    };
    if (payload.type === "gym" && !payload.presetId) return;
    onUpdatePlan((plan) => addPlanItem(plan, payload));
    closePanels();
  };

  const moveTargets = Array.from({ length: 7 }, (_, index) => addDays(todayDate, index));

  return (
    <Screen>
      <ScreenHeader
        action={<BackButton onClick={onBack} />}
        title="Training Calendar"
        subtitle={getWeekLabel(anchor)}
        topPadding="calc(env(safe-area-inset-top, 0px) + 20px)"
      />

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <SmallButton onClick={() => shiftWeek(-1)}>‹ Prev</SmallButton>
        <SmallButton onClick={() => { setAnchor(todayDate); closePanels(); }}>This week</SmallButton>
        <SmallButton onClick={() => shiftWeek(1)}>Next ›</SmallButton>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => onUpdatePlan((plan) => toggleDeloadWeek(plan, anchor))}
          style={{ background: deload ? "rgba(246,183,60,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${deload ? "rgba(246,183,60,0.5)" : colors.border}`, borderRadius: 999, color: deload ? colors.warning : colors.textMuted, fontFamily: "inherit", fontSize: 11, fontWeight: 700, padding: "6px 12px", cursor: "pointer" }}
        >
          {deload ? "Deload week ✓" : "Mark deload"}
        </button>
      </div>

      {warnings.map((warning) => (
        <SurfaceCard key={warning} style={{ border: "1px solid rgba(246,183,60,0.3)", background: "rgba(246,183,60,0.06)" }}>
          <p style={{ margin: 0, fontSize: 12, color: "#FFCA8A", lineHeight: 1.5 }}>{warning}</p>
        </SurfaceCard>
      ))}

      {week.map((day) => {
        const isToday = day.date === todayDate;
        return (
          <SurfaceCard key={day.date} style={isToday ? { border: "1px solid rgba(78,161,255,0.4)" } : undefined}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: day.items.length || addingDate === day.date ? 10 : 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: isToday ? colors.accent : colors.textPrimary }}>
                {day.weekday}
                <span style={{ marginLeft: 8, ...typeScale.caption, color: colors.textMuted, fontWeight: 600 }}>{fd(day.date)}{isToday ? " · Today" : ""}</span>
              </p>
              <button
                type="button"
                aria-label={`Add to ${day.weekday}`}
                onClick={() => {
                  setAddingDate((current) => (current === day.date ? null : day.date));
                  setSelectedKey(null);
                  setMovingKey(null);
                  setAddForm({ type: "gym", presetId: presets[0]?.id || "", repeatWeekly: true });
                }}
                style={{ width: 26, height: 26, borderRadius: 8, border: `1px solid ${colors.border}`, background: "rgba(255,255,255,0.04)", color: colors.textSecondary, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <Icon name="plus" size={14} color={colors.textSecondary} />
              </button>
            </div>

            {day.items.length === 0 && addingDate !== day.date && (
              <p style={{ margin: 0, ...typeScale.caption, color: colors.textMuted }}>Nothing planned</p>
            )}

            {day.items.map((item) => {
              const key = itemKey(item);
              const status = STATUS_GLYPHS[item.status] || STATUS_GLYPHS.planned;
              const typeColor = TYPE_COLORS[item.type] || colors.textMuted;
              const selected = selectedKey === key;
              return (
                <div key={key} style={{ marginBottom: 6 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedKey(selected ? null : key);
                      setMovingKey(null);
                      setAddingDate(null);
                    }}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, background: "rgba(255,255,255,0.03)", border: `1px solid ${selected ? typeColor : colors.border}`, borderRadius: 10, padding: "9px 11px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                  >
                    <span title={status.label} style={{ color: status.color, fontSize: 13, fontWeight: 800, width: 14, flexShrink: 0 }}>{status.glyph}</span>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: typeColor, flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: item.status === "skipped" ? colors.textMuted : colors.textPrimary, textDecoration: item.status === "skipped" ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
                      <span style={{ display: "block", fontSize: 10, color: colors.textMuted }}>
                        {status.label}{item.recurring ? " · repeats weekly" : ""}{item.movedFrom ? ` · moved from ${fd(item.movedFrom)}` : ""}
                      </span>
                    </span>
                  </button>

                  {selected && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 2px 2px" }}>
                      {item.type === "gym" && item.status === "planned" && day.date === todayDate && onStartWorkout && item.presetId && (
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
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "6px 2px 2px" }}>
                      {moveTargets.filter((target) => target !== item.ref.date).map((target, index) => (
                        <SmallButton
                          key={target}
                          onClick={() => { onUpdatePlan((plan, currentApp) => moveOccurrence(plan, currentApp, item.ref, target)); closePanels(); }}
                        >
                          {target === todayDate ? "Today" : index === 1 && target === addDays(todayDate, 1) ? "Tomorrow" : WEEKDAY_LABELS[weekdayIndex(target)].slice(0, 3)} {fd(target)}
                        </SmallButton>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {addingDate === day.date && (
              <div style={{ marginTop: 4, padding: 10, borderRadius: 10, border: `1px dashed ${colors.borderStrong || colors.border}`, display: "grid", gap: 8 }}>
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
                  {addForm.repeatWeekly ? `↻ Repeats every ${day.weekday}` : `→ Only ${fd(day.date)} (tap to repeat weekly)`}
                </button>

                <div style={{ display: "flex", gap: 8 }}>
                  <ActionButton compact tone="tinted" color="#2D7DD2" disabled={addForm.type === "gym" && !addForm.presetId} onClick={() => submitAdd(day.date)}>Add</ActionButton>
                  <ActionButton compact tone="secondary" onClick={() => setAddingDate(null)}>Cancel</ActionButton>
                </div>
              </div>
            )}
          </SurfaceCard>
        );
      })}

      <p style={{ margin: "8px 2px 0", ...typeScale.caption, color: colors.textMuted, lineHeight: 1.5 }}>
        Recurring items repeat weekly. Changing, moving or skipping a day only affects that occurrence — the programme keeps its shape.
      </p>
    </Screen>
  );
}
