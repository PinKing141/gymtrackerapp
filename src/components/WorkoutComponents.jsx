import { useEffect, useRef, useState } from "react";
import { C, IS } from "../storage.js";
import { getExerciseInputConfig, getResolvedSet, getSetSummary, isSetComplete, isSetStarted } from "../workouts.js";

const iconBase = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

function Glyph({ d, size = 16, color = "currentColor", fill = "none", strokeWidth = 1.8 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={fill === "none" ? color : "none"}
      strokeWidth={fill === "none" ? strokeWidth : 0}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={iconBase}
    >
      <path d={d} />
    </svg>
  );
}

function NumberInput({ value, onChange, placeholder, inputMode = "numeric" }) {
  return (
    <input
      type="number"
      inputMode={inputMode}
      placeholder={placeholder}
      value={value ?? ""}
      onChange={onChange}
      style={IS}
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

export function RestTimer({ seconds, color }) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const toggleTimer = () => {
    if (running) {
      clearInterval(intervalRef.current);
      setRunning(false);
      setRemaining(seconds);
      return;
    }

    setRunning(true);
    setRemaining(seconds);
    intervalRef.current = setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          clearInterval(intervalRef.current);
          setRunning(false);
          return seconds;
        }
        return value - 1;
      });
    }, 1000);
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
        color: running ? color : "#666",
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
        <Glyph d="M12 8v4l3 2M9 2h6M12 5a8 8 0 110 16 8 8 0 010-16z" size={13} color={running ? color : "#777"} />
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

export function LiveTimer({ color, timerState, onUpdate }) {
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
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(10,10,15,0.95)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: `1px solid ${running ? `${color}33` : "rgba(255,255,255,0.06)"}`,
        padding: "10px 16px",
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <button
        onClick={toggleTimer}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: fresh ? color : running ? "rgba(255,255,255,0.06)" : `${color}22`,
          border: "none",
          borderRadius: 10,
          padding: "8px 14px",
          cursor: "pointer",
        }}
      >
        {running ? (
          <svg width={14} height={14} viewBox="0 0 24 24" fill={color}>
            <rect x="5" y="4" width="5" height="16" rx="1" />
            <rect x="14" y="4" width="5" height="16" rx="1" />
          </svg>
        ) : (
          <svg width={14} height={14} viewBox="0 0 24 24" fill={fresh ? "#fff" : color}>
            <polygon points="5,3 19,12 5,21" />
          </svg>
        )}
        <span style={{ fontSize: 12, fontWeight: 700, color: fresh ? "#fff" : running ? "#999" : color }}>
          {fresh ? "Start" : running ? "Pause" : "Resume"}
        </span>
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {running && <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}88`, animation: "pulse 2s ease-in-out infinite" }} />}
        <div style={{ background: running ? `${color}15` : "rgba(255,255,255,0.04)", borderRadius: 10, padding: "5px 14px", border: `1px solid ${running ? `${color}30` : "rgba(255,255,255,0.08)"}` }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: fresh ? "#444" : "#fff", fontVariantNumeric: "tabular-nums", fontFamily: "'SF Mono','Menlo',monospace", letterSpacing: "0.04em" }}>
            {display}
          </span>
        </div>
      </div>
      <style>{"@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}"}</style>
    </div>
  );
}

function SetRow({ exerciseKey, setIndex, setData, exercise, color, onSet }) {
  const columns = getColumnConfig(exercise);
  const resolved = getResolvedSet(setData, exercise);

  return (
    <>
      <span style={{ fontSize: 12, color: "#555", textAlign: "center", fontWeight: 600 }}>{setIndex + 1}</span>
      {columns.map((column) => (
        <NumberInput
          key={`${exerciseKey}-${setIndex}-${column.field}`}
          value={resolved[column.field]}
          inputMode={column.inputMode}
          placeholder={column.placeholder}
          onChange={(event) => onSet(exerciseKey, setIndex, column.field, event.target.value)}
        />
      ))}
      {exercise.rest > 0 ? <RestTimer seconds={exercise.rest} color={color} /> : <span style={{ fontSize: 10, color: "#444", textAlign: "center" }}>Full</span>}
    </>
  );
}

export function ExerciseCard({ exercise, exerciseKey, sets, isOpen, onToggle, onSet, color, previousSets }) {
  const completedSets = sets.filter((setData) => isSetComplete(setData, exercise)).length;
  const startedSets = sets.filter((setData) => isSetStarted(setData, exercise)).length;
  const done = completedSets === exercise.sets;
  const columns = getColumnConfig(exercise);
  const gridTemplateColumns = `28px ${columns.map(() => "minmax(0,1fr)").join(" ")} auto`;
  const previousSummaries = (previousSets || []).map((setData) => getSetSummary(setData, exercise)).filter(Boolean);

  return (
    <div style={{ ...C, padding: 0, overflow: "hidden", background: done ? "rgba(69,182,73,0.05)" : C.background, borderColor: done ? "rgba(69,182,73,0.18)" : "rgba(255,255,255,0.06)" }}>
      <button onClick={() => onToggle(exerciseKey)} style={{ width: "100%", textAlign: "left", background: "none", border: "none", color: "#E8E6E1", padding: "13px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {done && <Glyph d="M5 12l4 4L19 7" size={14} color="#45B649" />}
            <span style={{ fontSize: 13, fontWeight: 600, color: done ? "#45B649" : "#fff" }}>{exercise.name}</span>
          </div>
          <p style={{ fontSize: 10, color: "#555", margin: "2px 0 0" }}>{exercise.type} · {exercise.sets}x{exercise.reps} · {exercise.restLabel}</p>
          {startedSets > 0 && (
            <p style={{ fontSize: 10, color: done ? "#5dcf67" : "#777", margin: "5px 0 0" }}>
              {sets.map((setData) => getSetSummary(setData, exercise)).filter(Boolean).slice(0, 2).join("  •  ")}
            </p>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {startedSets > 0 && !done && <span style={{ fontSize: 9, color: "#888", background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 6 }}>{completedSets}/{exercise.sets}</span>}
          <span style={{ color: "#555", fontSize: 16, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>›</span>
        </div>
      </button>
      {isOpen && (
        <div style={{ padding: "0 14px 12px" }}>
          <div style={{ display: "grid", gridTemplateColumns, gap: "5px 6px", alignItems: "center" }}>
            <span style={{ fontSize: 9, color: "#444", textAlign: "center" }}>SET</span>
            {columns.map((column) => <span key={`${exerciseKey}-${column.field}-label`} style={{ fontSize: 9, color: "#444" }}>{column.label}</span>)}
            <span style={{ fontSize: 9, color: "#444" }}>REST</span>
            {sets.map((setData, setIndex) => (
              <SetRow key={`${exerciseKey}-s${setIndex}`} exerciseKey={exerciseKey} setIndex={setIndex} setData={setData} exercise={exercise} color={color} onSet={onSet} />
            ))}
          </div>
          {previousSummaries.length > 0 && (
            <button
              onClick={() => copyPreviousSet(exercise, exerciseKey, previousSets, onSet)}
              style={{ marginTop: 8, width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "8px 10px", color: "#777", fontSize: 11, cursor: "pointer", fontWeight: 500, display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}
            >
              <Glyph d="M9 3h6a2 2 0 012 2v14l-5-3-5 3V5a2 2 0 012-2zM9 7h6" size={14} color="#888" />
              Copy last
              <span style={{ color: "#555" }}>{previousSummaries.slice(0, 2).join(" · ")}</span>
            </button>
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
