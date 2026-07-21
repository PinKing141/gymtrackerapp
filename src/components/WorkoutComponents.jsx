import { useEffect, useRef, useState } from "react";
import { colors, radii, typeScale } from "../theme.js";
import { getExerciseInputConfig, getResolvedSet, getSetSummary, isSetComplete, isSetStarted } from "../workouts.js";
import { PROGRESSION_METHODS } from "../progression.js";
import { calculatePlates } from "../lib/plates.js";
import { haptic, playCue, unlockAudio } from "../services/sound.js";
import { notifyIfHidden } from "../services/notify.js";
import { Icon } from "./icons.jsx";
import { IS } from "../storage.js";

function NumberInput({ value, onChange, placeholder, inputMode = "numeric" }) {
  return (
    <input
      type="number"
      inputMode={inputMode}
      placeholder={placeholder}
      value={value ?? ""}
      onChange={onChange}
      style={{
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        background: "rgba(255,255,255,0.055)",
        border: `1px solid ${colors.border}`,
        borderRadius: radii.sm,
        padding: "10px 9px",
        color: colors.textPrimary,
        fontSize: 16,
        fontWeight: 800,
        fontVariantNumeric: "tabular-nums",
        outline: "none",
        WebkitAppearance: "none",
      }}
    />
  );
}

function getColumnConfig(exercise) {
  const config = getExerciseInputConfig(exercise);
  const columns = [];

  if (config.loadMode === "single") {
    columns.push({ field: "kg", label: "KG", inputMode: "decimal", placeholder: "0" });
  }
  if (config.loadMode === "paired") {
    columns.push({ field: "leftKg", label: "L KG", inputMode: "decimal", placeholder: "0" });
    columns.push({ field: "rightKg", label: "R KG", inputMode: "decimal", placeholder: "0" });
  }

  if (config.metricMode === "distance") {
    columns.push({ field: "distance", label: config.metricLabel, inputMode: "decimal", placeholder: config.metricPlaceholder });
  } else if (config.perSideMetric) {
    const suffix = config.metricMode === "duration" ? "SEC" : "REPS";
    const prefix = config.metricMode === "duration" ? "Duration" : "Reps";
    columns.push({ field: `left${prefix}`, label: `L ${suffix}`, inputMode: "numeric", placeholder: config.metricPlaceholder });
    columns.push({ field: `right${prefix}`, label: `R ${suffix}`, inputMode: "numeric", placeholder: config.metricPlaceholder });
  } else {
    columns.push({
      field: config.metricMode === "duration" ? "duration" : "reps",
      label: config.metricLabel,
      inputMode: config.metricMode === "reps" ? "numeric" : "decimal",
      placeholder: config.metricPlaceholder,
    });
  }

  return columns;
}

function getTrackingTags(exercise) {
  const config = getExerciseInputConfig(exercise);
  const tags = [];

  if (config.metricMode === "duration") {
    tags.push("Timed");
  }
  if (config.metricMode === "distance") {
    tags.push("Distance");
  }
  if (config.perSideMetric) {
    tags.push("Per Side");
  }
  if (config.loadMode === "paired") {
    tags.push("L/R Load");
  }

  return tags;
}

function copyPreviousSet(exercise, exerciseKey, previousSets, onSet) {
  previousSets.forEach((setData, setIndex) => {
    const resolved = getResolvedSet(setData, exercise);
    Object.entries(resolved).forEach(([field, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        onSet(exerciseKey, setIndex, field, value);
      }
    });
  });
}

export function RestTimer({ seconds, color, autoStart = 0 }) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const begin = () => {
    clearInterval(intervalRef.current);
    setRunning(true);
    setRemaining(seconds);
    // Unlock audio within the triggering tap so the interval-driven end cue
    // can play on iOS (set completion is also a tap).
    unlockAudio();
    intervalRef.current = setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          clearInterval(intervalRef.current);
          setRunning(false);
          playCue("restEnd");
          haptic("success");
          notifyIfHidden("Rest complete", "Time for your next set.", "orion-rest-timer");
          return seconds;
        }
        // Tick for the final few seconds before rest ends.
        if (value <= 4) {
          playCue("countdown");
        }
        return value - 1;
      });
    }, 1000);
  };

  const beginRef = useRef(begin);
  beginRef.current = begin;

  // Completing a set auto-starts this set's rest countdown.
  useEffect(() => {
    if (autoStart > 0) {
      beginRef.current();
    }
  }, [autoStart]);

  const toggleTimer = () => {
    if (running) {
      clearInterval(intervalRef.current);
      setRunning(false);
      setRemaining(seconds);
      return;
    }
    begin();
  };

  const minutes = Math.floor(remaining / 60);
  const secondsText = (remaining % 60).toString().padStart(2, "0");

  return (
    <button
      onClick={toggleTimer}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "6px 10px",
        borderRadius: 8,
        border: "none",
        cursor: "pointer",
        minWidth: 78,
        background: running ? `${color}22` : "rgba(255,255,255,0.04)",
        color: running ? color : colors.textMuted,
        fontSize: 12,
        fontWeight: 600,
        position: "relative",
        overflow: "hidden",
        justifyContent: "center",
      }}
    >
      {running && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${(remaining / seconds) * 100}%`,
            background: `${color}15`,
            transition: "width 1s linear",
          }}
        />
      )}
      <span style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 4 }}>
        <Icon name="calendar" paths={["M12 8v4l3 2", "M9 2h6", "M12 5a8 8 0 110 16 8 8 0 010-16z"]} size={13} color={running ? color : colors.textMuted} />
        {running ? `${minutes}:${secondsText}` : seconds >= 60 ? `${seconds / 60}m` : `${seconds}s`}
      </span>
    </button>
  );
}

export function Spark({ data, color, height = 40 }) {
  if (!data || data.length < 2) {
    return null;
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 200;
  const points = data
    .map((value, index) => `${(index / (data.length - 1)) * width},${height - ((value - min) / range) * (height - 4) - 2}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height }} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={height - ((data[data.length - 1] - min) / range) * (height - 4) - 2} r="3" fill={color} />
    </svg>
  );
}

export function LiveTimer({ color, timerState, onUpdate, title = "Workout", onCancel, completedExercises = 0, totalExercises = 0 }) {
  const [now, setNow] = useState(Date.now());
  const { running, startedAt, lastResumedAt, accumulated } = timerState;

  useEffect(() => {
    if (!running) {
      return undefined;
    }

    const intervalId = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(intervalId);
  }, [running]);

  const currentSeconds = running && lastResumedAt ? Math.floor((now - lastResumedAt) / 1000) : 0;
  const totalSeconds = accumulated + currentSeconds;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const display = hours > 0
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    : `${minutes}:${seconds.toString().padStart(2, "0")}`;
  const fresh = !startedAt;
  const progress = totalExercises > 0 ? completedExercises / totalExercises : 0;

  const toggleTimer = () => {
    if (running) {
      onUpdate({
        running: false,
        startedAt,
        lastResumedAt: null,
        accumulated: accumulated + Math.floor((Date.now() - lastResumedAt) / 1000),
      });
      return;
    }

    const timestamp = Date.now();
    onUpdate({
      running: true,
      startedAt: startedAt || timestamp,
      lastResumedAt: timestamp,
      accumulated,
    });
  };

  return (
    <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(10,10,15,0.95)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderBottom: `1px solid ${colors.border}`, padding: "10px 16px", paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: colors.textMuted, cursor: "pointer", padding: 0, fontSize: 24, lineHeight: 1 }}>‹</button>
        <div style={{ width: 3, height: 24, borderRadius: 99, background: color }} />
        <h2 style={{ ...typeScale.titleMd, color: colors.textPrimary, margin: 0, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</h2>
        {running && <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}88`, animation: "pulse 2s ease-in-out infinite" }} />}
        <span style={{ fontSize: 22, fontWeight: 800, color: fresh ? colors.textMuted : colors.textPrimary, fontVariantNumeric: "tabular-nums", fontFamily: "'SF Mono','Menlo',monospace", letterSpacing: "0.03em" }}>{display}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
        <button onClick={toggleTimer} style={{ display: "flex", alignItems: "center", gap: 7, background: fresh ? color : running ? "rgba(255,255,255,0.06)" : `${color}22`, border: `1px solid ${fresh ? "transparent" : `${color}30`}`, borderRadius: radii.pill, padding: "8px 13px", cursor: "pointer" }}>
          <span style={{ ...typeScale.bodySm, fontWeight: 800, color: fresh ? colors.textPrimary : running ? colors.textSecondary : color }}>{fresh ? "Start" : running ? "Pause" : "Resume"}</span>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ ...typeScale.caption, color: colors.textMuted }}>Progress</span>
            <span style={{ ...typeScale.caption, color: colors.textSecondary }}>{completedExercises}/{totalExercises} · {Math.round(progress * 100)}%</span>
          </div>
          <div style={{ height: 3, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <div style={{ width: `${progress * 100}%`, height: "100%", background: color, transition: "width 220ms ease" }} />
          </div>
        </div>
      </div>
      <style>{"@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}"}</style>
    </div>
  );
}

function SetRow({ exerciseKey, setIndex, setData, exercise, color, onSet, workingNumber }) {
  const baseColumns = getColumnConfig(exercise);
  // RPE fits when the row isn't already carrying per-side columns.
  const columns = baseColumns.length <= 2
    ? [...baseColumns, { field: "rpe", label: "RPE", inputMode: "decimal", placeholder: "–" }]
    : baseColumns;
  const resolved = getResolvedSet(setData, exercise);
  const complete = isSetComplete(setData, exercise);
  const warmup = Boolean(resolved.warmup);
  const [noteOpen, setNoteOpen] = useState(false);
  const [restTick, setRestTick] = useState(0);
  const badgeColor = warmup ? colors.warning : color;

  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: radii.md, border: `1px solid ${complete ? (warmup ? `${colors.warning}4d` : `${colors.success}4d`) : colors.border}`, background: complete ? (warmup ? `${colors.warning}0d` : `${colors.success}10`) : "rgba(255,255,255,0.035)" }}>
      <div style={{ minHeight: 54, display: "grid", gridTemplateColumns: `34px ${columns.map((column) => (column.field === "rpe" ? "56px" : "minmax(0,1fr)")).join(" ")} auto`, gap: 8, alignItems: "center", padding: 8 }}>
        <button
          type="button"
          title={warmup ? "Warm-up set — tap for working set" : "Tap to mark as warm-up"}
          onClick={() => onSet(exerciseKey, setIndex, "warmup", !warmup)}
          style={{ width: 26, height: 26, borderRadius: "50%", border: "none", cursor: "pointer", display: "grid", placeItems: "center", background: complete ? (warmup ? colors.warning : colors.success) : `${badgeColor}18`, color: complete ? colors.background : badgeColor, fontSize: 11, fontWeight: 900 }}
        >
          {warmup ? "W" : complete ? "✓" : workingNumber}
        </button>
        {columns.map((column) => (
          <label key={`${exerciseKey}-${setIndex}-${column.field}`} style={{ minWidth: 0, position: "relative" }}>
            <NumberInput
              value={resolved[column.field]}
              inputMode={column.inputMode}
              placeholder={column.placeholder}
              onChange={(event) => {
                const nextValue = event.target.value;
                const wasComplete = isSetComplete(setData, exercise);
                onSet(exerciseKey, setIndex, column.field, nextValue);
                if (column.field !== "rpe" && !wasComplete && isSetComplete({ ...setData, [column.field]: nextValue }, exercise)) {
                  playCue("setLogged");
                  haptic("light");
                  if (exercise.rest > 0) {
                    setRestTick((tick) => tick + 1);
                  }
                }
              }}
            />
            {column.field !== "rpe" && (
              <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", ...typeScale.caption, color: colors.textMuted, pointerEvents: "none" }}>{column.label.toLowerCase()}</span>
            )}
            {column.field === "rpe" && (
              <span style={{ position: "absolute", right: 6, top: 2, fontSize: 8, color: colors.textMuted, pointerEvents: "none" }}>rpe</span>
            )}
          </label>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {exercise.rest > 0 ? <RestTimer seconds={exercise.rest} color={color} autoStart={restTick} /> : <span style={{ ...typeScale.caption, color: colors.textMuted, textAlign: "center" }}>Full</span>}
          <button
            type="button"
            aria-label="Set note"
            onClick={() => setNoteOpen((open) => !open)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: resolved.note || noteOpen ? color : colors.textMuted, fontSize: 12 }}
          >
            ✎
          </button>
        </div>
      </div>
      {(noteOpen || resolved.note) && (
        <input
          value={resolved.note || ""}
          onChange={(event) => onSet(exerciseKey, setIndex, "note", event.target.value)}
          placeholder="Set note — grip, tempo, pain…"
          style={{ ...IS, borderRadius: 0, borderLeft: "none", borderRight: "none", borderBottom: "none", background: "rgba(255,255,255,0.03)", fontSize: 12, fontWeight: 600, padding: "8px 12px" }}
        />
      )}
    </div>
  );
}

export function ExerciseCard({
  exercise,
  exerciseKey,
  sets,
  isOpen,
  onToggle,
  onSet,
  color,
  previousSets,
  groupLabel = null,
  note = "",
  onNoteChange,
  substitution = null,
  onSubstitute,
  suggestion = null,
  progressionMethod = "double",
  onProgressionMethodChange,
}) {
  // Warm-ups never count toward the working-set target.
  const workingSets = sets.filter((setData) => !getResolvedSet(setData, exercise).warmup);
  const completedSets = workingSets.filter((setData) => isSetComplete(setData, exercise)).length;
  const startedSets = sets.filter((setData) => isSetStarted(setData, exercise)).length;
  const done = completedSets >= exercise.sets;
  const tags = getTrackingTags(exercise);
  const previousSummaries = (previousSets || []).map((setData) => getSetSummary(setData, exercise)).filter(Boolean);
  const statusColor = done ? colors.success : startedSets > 0 || isOpen ? color : colors.textMuted;
  const displayName = substitution || exercise.name;
  const [whyOpen, setWhyOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapText, setSwapText] = useState(displayName);
  const [platesOpen, setPlatesOpen] = useState(false);
  const isBarbell = /barbell|trap bar/i.test(`${exercise.type} ${displayName}`);
  const topWeight = Math.max(0, ...sets.map((setData) => Number(getResolvedSet(setData, exercise).kg) || 0));
  const [plateTarget, setPlateTarget] = useState("");
  const plates = platesOpen ? calculatePlates(plateTarget || topWeight) : null;

  return (
    <div style={{ position: "relative", padding: 0, overflow: "hidden", background: isOpen ? colors.surfaceElevated : done ? `${colors.success}0d` : colors.surface, border: `1px solid ${done ? `${colors.success}4d` : isOpen ? `${color}42` : colors.border}`, borderRadius: radii.lg, marginBottom: 12, opacity: done && !isOpen ? 0.78 : 1, boxShadow: isOpen ? `0 12px 30px rgba(0,0,0,0.24), 0 0 0 1px ${color}14 inset` : "none" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: statusColor }} />
      <button onClick={() => onToggle(exerciseKey)} style={{ width: "100%", textAlign: "left", background: "none", border: "none", color: colors.textPrimary, padding: "14px 14px 14px 18px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {groupLabel && <span style={{ ...typeScale.caption, fontWeight: 900, color, background: `${color}1a`, border: `1px solid ${color}40`, borderRadius: 6, padding: "1px 6px" }}>{groupLabel}</span>}
            {done && <Icon name="check" size={15} color={colors.success} />}
            <span style={{ ...typeScale.body, fontWeight: 800, color: done ? colors.success : colors.textPrimary }}>{displayName}</span>
          </div>
          {substitution && <p style={{ ...typeScale.caption, color: colors.warning, margin: "2px 0 0" }}>Swapped from {exercise.name}</p>}
          <p style={{ ...typeScale.caption, color: colors.textSecondary, margin: "3px 0 0" }}>{exercise.type} · {exercise.sets}×{exercise.reps}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {exercise.restLabel && <span style={{ ...typeScale.caption, color: colors.textSecondary, background: "rgba(255,255,255,0.05)", border: `1px solid ${colors.border}`, borderRadius: radii.pill, padding: "3px 7px" }}>◷ {exercise.restLabel}</span>}
            {tags.map((tag) => (
              <span key={tag} style={{ ...typeScale.caption, color, background: `${color}12`, border: `1px solid ${color}30`, borderRadius: radii.pill, padding: "3px 7px" }}>{tag}</span>
            ))}
          </div>
          {startedSets > 0 && (
            <p style={{ ...typeScale.caption, color: done ? colors.success : colors.textSecondary, margin: "7px 0 0" }}>
              {sets.map((setData) => getSetSummary(setData, exercise)).filter(Boolean).slice(0, 2).join("  •  ")}
            </p>
          )}
        </div>
        <div style={{ display: "grid", justifyItems: "center", gap: 4 }}>
          <span style={{ minWidth: 38, textAlign: "center", ...typeScale.caption, color: done ? colors.success : colors.textPrimary, background: done ? `${colors.success}18` : "rgba(255,255,255,0.06)", border: `1px solid ${done ? `${colors.success}4d` : colors.border}`, padding: "4px 7px", borderRadius: radii.pill }}>{completedSets}/{exercise.sets}</span>
          <span style={{ color: colors.textMuted, fontSize: 16, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>›</span>
        </div>
      </button>
      {isOpen && (
        <div style={{ padding: "0 14px 14px 18px", display: "grid", gap: 8 }}>
          {suggestion && (
            <div style={{ borderRadius: radii.md, border: `1px solid ${color}30`, background: `${color}0d`, padding: "9px 11px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ ...typeScale.caption, fontWeight: 800, color }}>Target: {suggestion.target}</span>
                <button type="button" onClick={() => setWhyOpen((open) => !open)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", ...typeScale.caption, fontWeight: 700, color: colors.textMuted, textDecoration: "underline" }}>
                  {whyOpen ? "hide why" : "why?"}
                </button>
                {onProgressionMethodChange && (
                  <select
                    value={progressionMethod}
                    onChange={(event) => onProgressionMethodChange(event.target.value)}
                    style={{ marginLeft: "auto", background: "rgba(255,255,255,0.06)", border: `1px solid ${colors.border}`, borderRadius: 7, color: colors.textSecondary, fontSize: 10, fontWeight: 700, padding: "3px 5px" }}
                  >
                    {PROGRESSION_METHODS.map((method) => (
                      <option key={method.id} value={method.id}>{method.label}</option>
                    ))}
                  </select>
                )}
              </div>
              {whyOpen && <p style={{ margin: "6px 0 0", ...typeScale.caption, color: colors.textSecondary, lineHeight: 1.5 }}>{suggestion.reason} It's a suggestion — log whatever you actually do.</p>}
            </div>
          )}

          {(() => {
            let workingNumber = 0;
            return sets.map((setData, setIndex) => {
              const isWarmup = Boolean(getResolvedSet(setData, exercise).warmup);
              if (!isWarmup) workingNumber += 1;
              return (
                <SetRow key={`${exerciseKey}-s${setIndex}`} exerciseKey={exerciseKey} setIndex={setIndex} setData={setData} exercise={exercise} color={color} onSet={onSet} workingNumber={isWarmup ? "W" : workingNumber} />
              );
            });
          })()}

          <div style={{ display: "grid", gridTemplateColumns: previousSummaries.length > 0 ? "1fr 1fr 1fr" : "1fr 1fr", gap: 8, marginTop: 2 }}>
            {previousSummaries.length > 0 && (
              <button onClick={() => copyPreviousSet(exercise, exerciseKey, previousSets, onSet)} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${colors.border}`, borderRadius: radii.md, padding: "10px 6px", color: colors.textSecondary, ...typeScale.caption, cursor: "pointer", fontWeight: 700 }}>
                Copy last
              </button>
            )}
            <button onClick={() => onSet(exerciseKey, sets.length, "warmup", true)} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${colors.border}`, borderRadius: radii.md, padding: "10px 6px", color: colors.warning, ...typeScale.caption, cursor: "pointer", fontWeight: 700 }}>+ Warm-up</button>
            <button onClick={() => onSet(exerciseKey, sets.length, getColumnConfig(exercise)[0]?.field || "reps", "")} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${colors.border}`, borderRadius: radii.md, padding: "10px 6px", color: colors.textSecondary, ...typeScale.caption, cursor: "pointer", fontWeight: 700 }}>+ Add set</button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {isBarbell && (
              <button type="button" onClick={() => { setPlatesOpen((open) => !open); setPlateTarget(String(topWeight || "")); }} style={{ background: platesOpen ? `${color}18` : "rgba(255,255,255,0.04)", border: `1px solid ${platesOpen ? color : colors.border}`, borderRadius: radii.pill, padding: "5px 10px", color: platesOpen ? color : colors.textSecondary, ...typeScale.caption, fontWeight: 700, cursor: "pointer" }}>
                Plates
              </button>
            )}
            {onSubstitute && (
              <button type="button" onClick={() => { setSwapOpen((open) => !open); setSwapText(displayName); }} style={{ background: swapOpen ? `${colors.warning}18` : "rgba(255,255,255,0.04)", border: `1px solid ${swapOpen ? colors.warning : colors.border}`, borderRadius: radii.pill, padding: "5px 10px", color: swapOpen ? colors.warning : colors.textSecondary, ...typeScale.caption, fontWeight: 700, cursor: "pointer" }}>
                Swap exercise
              </button>
            )}
          </div>

          {platesOpen && (
            <div style={{ borderRadius: radii.md, border: `1px solid ${colors.border}`, background: "rgba(255,255,255,0.03)", padding: "9px 11px", display: "grid", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ ...typeScale.caption, color: colors.textMuted }}>Target</span>
                <input type="number" inputMode="decimal" value={plateTarget} onChange={(event) => setPlateTarget(event.target.value)} style={{ ...IS, width: 84, padding: "6px 8px", fontSize: 13 }} />
                <span style={{ ...typeScale.caption, color: colors.textMuted }}>kg · 20kg bar</span>
              </div>
              {plates?.valid ? (
                <p style={{ margin: 0, ...typeScale.caption, color: colors.textPrimary, fontWeight: 700 }}>
                  Each side: {plates.perSideLabel}
                  {!plates.exact && <span style={{ color: colors.warning, fontWeight: 600 }}> · closest loadable: {plates.loadedKg}kg</span>}
                </p>
              ) : (
                <p style={{ margin: 0, ...typeScale.caption, color: colors.textMuted }}>{plates?.reason}</p>
              )}
            </div>
          )}

          {swapOpen && (
            <div style={{ borderRadius: radii.md, border: `1px solid ${colors.border}`, background: "rgba(255,255,255,0.03)", padding: "9px 11px", display: "grid", gap: 6 }}>
              <input value={swapText} onChange={(event) => setSwapText(event.target.value)} placeholder="e.g. Dumbbell Bench Press" style={{ ...IS, fontSize: 13 }} />
              <p style={{ margin: 0, ...typeScale.caption, color: colors.textMuted }}>Keep the same movement pattern (press for press, row for row). Applies to this session; history credits the movement you actually did.</p>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" onClick={() => { onSubstitute(swapText.trim()); setSwapOpen(false); }} disabled={!swapText.trim()} style={{ background: `${colors.warning}18`, border: `1px solid ${colors.warning}55`, borderRadius: radii.md, padding: "7px 12px", color: colors.warning, ...typeScale.caption, fontWeight: 800, cursor: "pointer" }}>Swap</button>
                {substitution && (
                  <button type="button" onClick={() => { onSubstitute(null); setSwapOpen(false); }} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${colors.border}`, borderRadius: radii.md, padding: "7px 12px", color: colors.textSecondary, ...typeScale.caption, fontWeight: 700, cursor: "pointer" }}>Back to {exercise.name}</button>
                )}
              </div>
            </div>
          )}

          {onNoteChange && (
            <input
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder="Exercise cue — e.g. pause at chest, elbows 45°"
              style={{ ...IS, fontSize: 12, fontWeight: 600, background: "rgba(255,255,255,0.03)" }}
            />
          )}
        </div>
      )}
    </div>
  );
}

export function NI({ d }) {
  return (
    <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
