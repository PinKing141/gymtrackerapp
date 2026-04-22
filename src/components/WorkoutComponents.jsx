import { useEffect, useRef, useState } from "react";
import { C, IS } from "../storage.js";

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
        minWidth: 72,
        background: running ? `${color}22` : "rgba(255,255,255,0.04)",
        color: running ? color : "#666",
        fontSize: 12,
        fontWeight: 600,
        position: "relative",
        overflow: "hidden",
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
      <span style={{ position: "relative", zIndex: 1 }}>
        {running ? `${minutes}:${secondsText}` : `⏱ ${seconds >= 60 ? `${seconds / 60}m` : `${seconds}s`}`}
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
  return (
    <>
      <span style={{ fontSize: 12, color: "#555", textAlign: "center", fontWeight: 600 }}>{setIndex + 1}</span>
      <input type="number" inputMode="decimal" placeholder="—" value={setData.kg} onChange={(event) => onSet(exerciseKey, setIndex, "kg", event.target.value)} style={IS} />
      <input type="number" inputMode="numeric" placeholder={exercise.reps.replace(/[^0-9]/g, "") || "—"} value={setData.reps} onChange={(event) => onSet(exerciseKey, setIndex, "reps", event.target.value)} style={IS} />
      {exercise.rest > 0 ? <RestTimer seconds={exercise.rest} color={color} /> : <span style={{ fontSize: 10, color: "#444", textAlign: "center" }}>Full</span>}
    </>
  );
}

export function ExerciseCard({ exercise, exerciseKey, sets, isOpen, onToggle, onSet, color, previousSets }) {
  const completedSets = sets.filter((setData) => setData.kg || setData.reps).length;
  const done = completedSets === exercise.sets;

  return (
    <div style={{ ...C, padding: 0, overflow: "hidden", background: done ? "rgba(69,182,73,0.05)" : C.background, borderColor: done ? "rgba(69,182,73,0.18)" : "rgba(255,255,255,0.06)" }}>
      <button onClick={() => onToggle(exerciseKey)} style={{ width: "100%", textAlign: "left", background: "none", border: "none", color: "#E8E6E1", padding: "13px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {done && <span style={{ color: "#45B649", fontSize: 13 }}>✓</span>}
            <span style={{ fontSize: 13, fontWeight: 600, color: done ? "#45B649" : "#fff" }}>{exercise.name}</span>
          </div>
          <p style={{ fontSize: 10, color: "#555", margin: "2px 0 0" }}>{exercise.type} · {exercise.sets}×{exercise.reps} · {exercise.restLabel}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {completedSets > 0 && !done && <span style={{ fontSize: 9, color: "#888", background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 6 }}>{completedSets}/{exercise.sets}</span>}
          <span style={{ color: "#555", fontSize: 16, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>›</span>
        </div>
      </button>
      {isOpen && (
        <div style={{ padding: "0 14px 12px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 1fr auto", gap: "5px 6px", alignItems: "center" }}>
            <span style={{ fontSize: 9, color: "#444", textAlign: "center" }}>SET</span>
            <span style={{ fontSize: 9, color: "#444" }}>KG</span>
            <span style={{ fontSize: 9, color: "#444" }}>REPS</span>
            <span style={{ fontSize: 9, color: "#444" }}>REST</span>
            {sets.map((setData, setIndex) => (
              <SetRow key={`${exerciseKey}-s${setIndex}`} exerciseKey={exerciseKey} setIndex={setIndex} setData={setData} exercise={exercise} color={color} onSet={onSet} />
            ))}
          </div>
          {previousSets?.some((setData) => setData.kg) && (
            <button
              onClick={() => previousSets.forEach((previousSet, setIndex) => {
                if (previousSet.kg) {
                  onSet(exerciseKey, setIndex, "kg", previousSet.kg);
                }
                if (previousSet.reps) {
                  onSet(exerciseKey, setIndex, "reps", previousSet.reps);
                }
              })}
              style={{ marginTop: 8, width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "8px", color: "#777", fontSize: 11, cursor: "pointer", fontWeight: 500 }}
            >
              📋 Copy last ({previousSets.filter((setData) => setData.kg).map((setData) => `${setData.kg}kg`).join(", ")})
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
