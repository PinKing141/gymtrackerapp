import { useCallback, useEffect, useRef, useState } from "react";
import { useAutoShotMode } from "../hooks/useAutoShotMode.js";
import { AUTO_SHOT_PRESET_OPTIONS, getPresetSettings, recommendAutoShotPreset } from "../lib/autoShotPresets.js";
import {
  clearRimCalibration,
  isStaleCalibration,
  isValidCalibration,
  loadRimCalibration,
  saveRimCalibration,
} from "../lib/rimCalibration.js";
import { AutoShotInstructionScreen } from "./AutoShotInstructionScreen.jsx";
import { RimCalibrationScreen } from "./RimCalibrationScreen.jsx";
import { colors, radii, typeScale } from "../theme.js";

const DETECTOR_SETTINGS_KEY = "basketball_detector_settings_v1";
const DEFAULT_DETECTOR_SETTINGS = {
  presetKey: "auto",
  minScore: 0.52,
  minShotConfidence: 0.64,
  rimDetectionMode: "hybrid",
  autoRelockEnabled: true,
  detectionIntervalMs: 140,
};

function loadDetectorSettings() {
  try {
    const raw = localStorage.getItem(DETECTOR_SETTINGS_KEY);
    if (!raw) return DEFAULT_DETECTOR_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_DETECTOR_SETTINGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_DETECTOR_SETTINGS;
  }
}

function saveDetectorSettings(settings) {
  try {
    localStorage.setItem(DETECTOR_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage failures
  }
}

function StatusPill({ label, value, accent = "#FF9F1C" }) {
  return (
    <div style={{
      padding: "9px 10px",
      borderRadius: radii.md,
      background: "rgba(255,255,255,0.07)",
      border: `1px solid ${colors.border}`,
    }}>
      <p style={{ ...typeScale.caption, color: colors.textMuted, margin: 0, textTransform: "uppercase", fontWeight: 850 }}>{label}</p>
      <p style={{ margin: "2px 0 0", color: accent, fontWeight: 950 }}>{value}</p>
    </div>
  );
}

export function AutoShotMode({ onRecordShot, currentZoneName, currentType, disabled = false }) {
  // Rim calibration state — loaded from localStorage, held here so it feeds the hook
  const [rimCalibration, setRimCalibration] = useState(() => loadRimCalibration());
  const [detectorSettings, setDetectorSettings] = useState(() => loadDetectorSettings());
  const [showCalibration, setShowCalibration] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [autoRecommendedPresetKey, setAutoRecommendedPresetKey] = useState("indoor");
  const lastCalibrationPersistAtRef = useRef(0);

  const activePresetKey = detectorSettings.presetKey === "auto" ? autoRecommendedPresetKey : detectorSettings.presetKey;
  const activePresetSettings = getPresetSettings(activePresetKey) || {};
  const effectiveSettings = detectorSettings.presetKey === "auto"
    ? { ...detectorSettings, ...activePresetSettings }
    : detectorSettings;

  const handleDetectedShot = useCallback((shotEvent) => {
    if (disabled) return;
    onRecordShot?.(shotEvent);
  }, [disabled, onRecordShot]);

  const {
    videoRef,
    canvasRef,
    status,
    error,
    fps,
    videoSize,
    modelStatus,
    modelError,
    detection,
    trackingState,
    lastShotEvent,
    rimDetectionState,
    relockState,
    sceneState,
    qaMetrics,
    startCamera,
    stopCamera,
    isStreaming,
  } = useAutoShotMode({
    rimCalibration,
    detectorConfig: effectiveSettings,
    detectionIntervalMs: effectiveSettings.detectionIntervalMs,
    rimDetectionMode: effectiveSettings.rimDetectionMode,
    autoRelockEnabled: effectiveSettings.autoRelockEnabled !== false,
    minShotConfidence: effectiveSettings.minShotConfidence,
    onRimCalibrationUpdate: (calibration, info) => {
      if (info?.source !== "relock") {
        setRimCalibration(calibration);
      }
      const now = Date.now();
      if (info?.source !== "relock" && now - lastCalibrationPersistAtRef.current > 1400) {
        saveRimCalibration(calibration);
        lastCalibrationPersistAtRef.current = now;
      }
    },
    onShotDetected: handleDetectedShot,
  });

  useEffect(() => {
    setAutoRecommendedPresetKey(recommendAutoShotPreset({
      brightness: sceneState.brightness,
      avgFps: qaMetrics.avgFps,
      avgInferenceMs: qaMetrics.avgInferenceMs,
    }));
  }, [qaMetrics.avgFps, qaMetrics.avgInferenceMs, sceneState.brightness]);

  const ball = detection?.ball;
  const rimValid = isValidCalibration(rimCalibration);
  const rimStale = isStaleCalibration(rimCalibration);
  const trackerReady = rimValid && modelStatus === "ready";
  const trackerLabel = !rimValid
    ? "Needs Rim"
    : trackingState.phase === "armed"
      ? "Tracking"
      : trackerReady
        ? "Ready"
        : modelStatus === "loading"
          ? "Loading"
          : "Idle";
  const trackerAccent = trackingState.phase === "armed"
    ? "#FF9F1C"
    : trackerReady
      ? colors.success
      : colors.textMuted;
  const filterDebug = detection?.debug || null;
  const rimDetectLabel = rimDetectionState.status === "locked"
    ? `${Math.round((rimDetectionState.confidence || 0) * 100)}%`
    : rimDetectionState.status === "searching"
      ? "Search"
      : rimDetectionState.status === "manual"
        ? "Manual"
        : "Idle";
  const rimDetectAccent = rimDetectionState.status === "locked"
    ? colors.success
    : rimDetectionState.status === "searching"
      ? "#FF9F1C"
      : colors.textMuted;
  const relockLabel = !rimValid
    ? "Needs Rim"
    : detectorSettings.autoRelockEnabled === false
      ? "Off"
      : relockState.status === "locked"
        ? `${Math.round((relockState.confidence || 0) * 100)}%`
        : relockState.status === "searching"
          ? "Search"
          : "Idle";
  const relockAccent = relockState.status === "locked" ? colors.success : relockState.status === "searching" ? "#FF9F1C" : colors.textMuted;

  const handleCalibrationSave = useCallback((calibration) => {
    setRimCalibration(calibration);
    const nextSettings = {
      ...detectorSettings,
      rimDetectionMode: "manual",
    };
    setDetectorSettings(nextSettings);
    saveDetectorSettings(nextSettings);
    setShowCalibration(false);
  }, [detectorSettings]);

  const handleCalibrationCancel = useCallback(() => {
    setShowCalibration(false);
  }, []);

  const handleClearCalibration = useCallback(() => {
    clearRimCalibration();
    setRimCalibration(null);
  }, []);

  const handleMinScoreChange = useCallback((event) => {
    const minScore = Number(event.target.value);
    const nextSettings = {
      ...detectorSettings,
      presetKey: "custom",
      minScore,
    };
    setDetectorSettings(nextSettings);
    saveDetectorSettings(nextSettings);
  }, [detectorSettings]);

  const handleMinShotConfidenceChange = useCallback((event) => {
    const minShotConfidence = Number(event.target.value);
    const nextSettings = {
      ...detectorSettings,
      presetKey: "custom",
      minShotConfidence,
    };
    setDetectorSettings(nextSettings);
    saveDetectorSettings(nextSettings);
  }, [detectorSettings]);

  const handleToggleRelock = useCallback(() => {
    const nextSettings = {
      ...detectorSettings,
      presetKey: detectorSettings.presetKey === "auto" ? "custom" : detectorSettings.presetKey,
      autoRelockEnabled: detectorSettings.autoRelockEnabled === false,
    };
    setDetectorSettings(nextSettings);
    saveDetectorSettings(nextSettings);
  }, [detectorSettings]);

  const handleRimDetectionModeChange = useCallback((event) => {
    const rimDetectionMode = event.target.value;
    const nextSettings = {
      ...detectorSettings,
      rimDetectionMode,
    };
    setDetectorSettings(nextSettings);
    saveDetectorSettings(nextSettings);
  }, [detectorSettings]);

  const handlePresetChange = useCallback((event) => {
    const presetKey = event.target.value;
    if (presetKey === "auto") {
      const nextSettings = {
        ...detectorSettings,
        presetKey,
      };
      setDetectorSettings(nextSettings);
      saveDetectorSettings(nextSettings);
      return;
    }

    const presetSettings = getPresetSettings(presetKey);
    const nextSettings = {
      ...detectorSettings,
      ...presetSettings,
      presetKey,
    };
    setDetectorSettings(nextSettings);
    saveDetectorSettings(nextSettings);
  }, [detectorSettings]);

  const handleExportQaReport = useCallback(() => {
    const payload = {
      generatedAt: new Date().toISOString(),
      zone: currentZoneName,
      shotType: currentType,
      detectorSettings,
      activePresetKey,
      sceneState,
      rimDetectionState,
      qaMetrics,
      relockState,
      lastShotEvent,
      currentBall: ball ? {
        score: ball.score,
        center: ball.center,
        radius: ball.radius,
      } : null,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `auto-shot-qa-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [activePresetKey, ball, currentType, currentZoneName, detectorSettings, lastShotEvent, qaMetrics, relockState, rimDetectionState, sceneState]);

  // ── Rim calibration overlay ───────────────────────────────────────────────
  if (showCalibration) {
    return (
      <RimCalibrationScreen
        existingCalibration={rimCalibration}
        onSave={handleCalibrationSave}
        onCancel={handleCalibrationCancel}
      />
    );
  }

  if (showGuide) {
    return <AutoShotInstructionScreen onClose={() => setShowGuide(false)} />;
  }

  // ── Main auto mode UI ─────────────────────────────────────────────────────
  return (
    <div style={{ width: "100%", maxWidth: 430, display: "grid", gap: 12 }}>

      {/* Camera viewport */}
      <div style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 24,
        border: `1px solid ${colors.border}`,
        background: "#050507",
        boxShadow: "0 18px 55px rgba(0,0,0,0.35)",
        aspectRatio: "9 / 16",
      }}>
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: isStreaming ? "block" : "none",
          }}
        />
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        />

        {/* Idle / start prompt */}
        {!isStreaming && (
          <div style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            padding: 24,
            textAlign: "center",
            background: "linear-gradient(135deg, rgba(255,122,26,0.16), rgba(88,80,236,0.14))",
          }}>
            <div>
              <p style={{ fontSize: 44, margin: "0 0 12px" }}>📷</p>
              <h3 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 950 }}>Auto Shot Mode</h3>
              <p style={{ ...typeScale.bodySm, margin: "0 0 16px", color: colors.textSecondary }}>
                {rimValid
                  ? "Rim calibrated · Start the camera to begin detection."
                  : "Start the camera, then calibrate the rim to enable shot tracking."}
              </p>
              <button
                onClick={startCamera}
                disabled={disabled || status === "requesting"}
                style={{
                  border: 0,
                  borderRadius: radii.pill,
                  padding: "12px 16px",
                  background: "#FF7A1A",
                  color: "#fff",
                  fontWeight: 950,
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.45 : 1,
                }}
              >
                {status === "requesting" ? "REQUESTING CAMERA…" : "START CAMERA"}
              </button>
              <button
                onClick={() => setShowGuide(true)}
                style={{
                  marginTop: 10,
                  border: `1px solid ${colors.border}`,
                  borderRadius: radii.pill,
                  padding: "11px 14px",
                  background: "rgba(255,255,255,0.06)",
                  color: colors.textPrimary,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                HOW TO SET IT UP
              </button>
            </div>
          </div>
        )}

        {/* Error banner */}
        {(error || modelError) && (
          <div style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 12,
            padding: 12,
            borderRadius: radii.md,
            background: "rgba(244,63,94,0.16)",
            border: "1px solid rgba(244,63,94,0.38)",
            color: "#FFC2CD",
            fontWeight: 800,
          }}>
            {error || modelError}
          </div>
        )}
      </div>

      {/* Status pills */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <StatusPill
          label="Camera"
          value={isStreaming ? "Live" : status === "error" ? "Blocked" : "Ready"}
          accent={isStreaming ? colors.success : "#FF9F1C"}
        />
        <StatusPill
          label="Model"
          value={
            modelStatus === "ready" ? "Loaded"
            : modelStatus === "loading" ? "Loading…"
            : modelStatus === "error" ? "Error"
            : "Idle"
          }
          accent={modelStatus === "ready" ? colors.success : "#FF9F1C"}
        />
        <StatusPill
          label="FPS"
          value={isStreaming ? (fps || "…") : "—"}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <StatusPill
          label="Frame"
          value={videoSize.width ? `${videoSize.width}p` : "—"}
        />
        <StatusPill
          label="Ball"
          value={ball ? `${Math.round(ball.score * 100)}%` : isStreaming ? "Searching" : "—"}
          accent={ball ? colors.success : "#FF9F1C"}
        />
        <StatusPill
          label="Infer"
          value={detection?.inferenceMs ? `${detection.inferenceMs}ms` : "—"}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <StatusPill
          label="Tracker"
          value={trackerLabel}
          accent={trackerAccent}
        />
        <StatusPill
          label="Samples"
          value={trackingState.sampleCount || "—"}
        />
        <StatusPill
          label="Last Shot"
          value={lastShotEvent ? lastShotEvent.result.toUpperCase() : "—"}
          accent={lastShotEvent?.result === "make" ? colors.success : lastShotEvent?.result === "miss" ? colors.danger : "#FF9F1C"}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <StatusPill
          label="Rim AI"
          value={rimDetectLabel}
          accent={rimDetectAccent}
        />
        <StatusPill
          label="Re-Lock"
          value={relockLabel}
          accent={relockAccent}
        />
        <StatusPill
          label="Logged"
          value={qaMetrics.loggedShots || "—"}
          accent={colors.success}
        />
        <StatusPill
          label="Suppressed"
          value={qaMetrics.suppressedShots || "—"}
          accent={colors.danger}
        />
      </div>

      <div style={{
        padding: 12,
        borderRadius: radii.lg,
        background: "rgba(255,255,255,0.05)",
        border: `1px solid ${colors.border}`,
      }}>
        <p style={{ ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase", margin: "0 0 6px" }}>
          Device Preset
        </p>
        <select
          value={detectorSettings.presetKey}
          onChange={handlePresetChange}
          style={{ width: "100%", padding: 12, borderRadius: radii.md, border: `1px solid ${colors.border}`, background: colors.surfaceElevated, color: colors.textPrimary, fontWeight: 800 }}
        >
          {AUTO_SHOT_PRESET_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
          <option value="custom">Custom</option>
        </select>
        <p style={{ margin: "8px 0 0", color: colors.textSecondary, fontSize: 12 }}>
          Active preset: {AUTO_SHOT_PRESET_OPTIONS.find((option) => option.value === activePresetKey)?.label || "Custom"} · Brightness {Math.round((sceneState.brightness || 0) * 100)}% · Avg {qaMetrics.avgFps || 0} FPS
        </p>
        {detectorSettings.presetKey === "auto" && (
          <p style={{ margin: "6px 0 0", color: colors.textMuted, fontSize: 11 }}>
            Auto mode is currently recommending {AUTO_SHOT_PRESET_OPTIONS.find((option) => option.value === autoRecommendedPresetKey)?.label || autoRecommendedPresetKey}.
          </p>
        )}
      </div>

      <div style={{
        padding: 12,
        borderRadius: radii.lg,
        background: "rgba(255,255,255,0.05)",
        border: `1px solid ${colors.border}`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 8 }}>
          <p style={{ ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase", margin: 0 }}>
            Setup Help
          </p>
          <button
            onClick={() => setShowGuide(true)}
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: radii.pill,
              padding: "7px 11px",
              background: colors.surface,
              color: colors.textPrimary,
              fontWeight: 900,
              fontSize: 11,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            OPEN GUIDE
          </button>
        </div>
        <p style={{ margin: "0 0 8px", color: colors.textSecondary, fontSize: 12 }}>
          Read the in-app setup guide if you need help placing the phone, calibrating the rim, or tuning detection.
        </p>
      </div>

      <div style={{
        padding: 12,
        borderRadius: radii.lg,
        background: "rgba(255,255,255,0.05)",
        border: `1px solid ${colors.border}`,
      }}>
        <p style={{ ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase", margin: "0 0 6px" }}>
          Rim Source
        </p>
        <select
          value={effectiveSettings.rimDetectionMode}
          onChange={handleRimDetectionModeChange}
          style={{ width: "100%", padding: 12, borderRadius: radii.md, border: `1px solid ${colors.border}`, background: colors.surfaceElevated, color: colors.textPrimary, fontWeight: 800 }}
        >
          <option value="hybrid">Hybrid: Auto first, manual fallback</option>
          <option value="manual">Manual lock only</option>
          <option value="auto">Auto detect only</option>
        </select>
        <p style={{ margin: "8px 0 0", color: colors.textSecondary, fontSize: 12 }}>
          Manual calibration is still available. Saving a manual rim lock switches this setting to Manual lock only so auto detection does not overwrite it.
        </p>
      </div>

      <div style={{
        padding: 12,
        borderRadius: radii.lg,
        background: "rgba(255,255,255,0.05)",
        border: `1px solid ${colors.border}`,
      }}>
        <p style={{ ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase", margin: "0 0 6px" }}>
          Detection Tuning
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, color: colors.textPrimary, fontWeight: 900 }}>Confidence threshold</p>
            <p style={{ margin: "4px 0 0", color: colors.textSecondary, fontSize: 12 }}>
              Higher values reduce false locks. Lower values help the model find the ball sooner.
            </p>
          </div>
          <p style={{ margin: 0, color: "#FF9F1C", fontWeight: 950 }}>{Math.round(effectiveSettings.minScore * 100)}%</p>
        </div>
        <input
          type="range"
          min="0.45"
          max="0.8"
          step="0.01"
          value={effectiveSettings.minScore}
          onChange={handleMinScoreChange}
          disabled={detectorSettings.presetKey === "auto"}
          style={{ width: "100%", marginTop: 10, accentColor: "#FF7A1A" }}
        />
        <p style={{ margin: "8px 0 0", color: colors.textSecondary, fontSize: 12 }}>
          Phase 1 filters active: score + size + shape + orange-color bias + motion continuity.
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginTop: 12 }}>
          <div>
            <p style={{ margin: 0, color: colors.textPrimary, fontWeight: 900 }}>Shot log threshold</p>
            <p style={{ margin: "4px 0 0", color: colors.textSecondary, fontSize: 12 }}>
              Low-confidence make or miss events are shown but not logged below this score.
            </p>
          </div>
          <p style={{ margin: 0, color: "#FF9F1C", fontWeight: 950 }}>{Math.round(effectiveSettings.minShotConfidence * 100)}%</p>
        </div>
        <input
          type="range"
          min="0.45"
          max="0.9"
          step="0.01"
          value={effectiveSettings.minShotConfidence}
          onChange={handleMinShotConfidenceChange}
          disabled={detectorSettings.presetKey === "auto"}
          style={{ width: "100%", marginTop: 10, accentColor: "#FF7A1A" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 12 }}>
          <div>
            <p style={{ margin: 0, color: colors.textPrimary, fontWeight: 900 }}>Auto rim re-lock</p>
            <p style={{ margin: "4px 0 0", color: colors.textSecondary, fontSize: 12 }}>
              Keeps the saved rim centered after small camera drift using orange rim pixels near the hoop.
            </p>
          </div>
          <button
            onClick={handleToggleRelock}
            style={{
              border: `1px solid ${detectorSettings.autoRelockEnabled === false ? colors.border : "rgba(61,220,151,0.35)"}`,
              borderRadius: radii.pill,
              padding: "8px 12px",
              background: detectorSettings.autoRelockEnabled === false ? "transparent" : "rgba(61,220,151,0.12)",
              color: detectorSettings.autoRelockEnabled === false ? colors.textMuted : colors.success,
              fontWeight: 900,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {detectorSettings.autoRelockEnabled === false ? "OFF" : "ON"}
          </button>
        </div>
        {isStreaming && !ball && filterDebug?.candidateCount > 0 && (
          <p style={{ margin: "6px 0 0", color: colors.textMuted, fontSize: 11 }}>
            Filtered {filterDebug.candidateCount} sports-ball candidate{filterDebug.candidateCount === 1 ? "" : "s"} this frame.
          </p>
        )}
        {ball && filterDebug && (
          <p style={{ margin: "6px 0 0", color: colors.textMuted, fontSize: 11 }}>
            Orange {Math.round((filterDebug.orangeRatio || 0) * 100)}% · Aspect {filterDebug.aspectRatio || "—"} · Size {Math.round((filterDebug.relativeDiameter || 0) * 100)}%
          </p>
        )}
        {rimValid && detectorSettings.autoRelockEnabled !== false && (
          <p style={{ margin: "6px 0 0", color: colors.textMuted, fontSize: 11 }}>
            Re-lock {relockState.status} · Confidence {Math.round((relockState.confidence || 0) * 100)}% · Shift {Math.round(relockState.shiftPx || 0)}px
          </p>
        )}
        {!rimValid && (
          <p style={{ margin: "6px 0 0", color: colors.textMuted, fontSize: 11 }}>
            Rim AI {rimDetectionState.status} · Confidence {Math.round((rimDetectionState.confidence || 0) * 100)}% · Candidates {rimDetectionState.candidateCount || 0}
          </p>
        )}
      </div>

      <div style={{
        padding: 12,
        borderRadius: radii.lg,
        background: "rgba(255,255,255,0.05)",
        border: `1px solid ${colors.border}`,
      }}>
        <p style={{ ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase", margin: "0 0 6px" }}>
          Phone QA
        </p>
        <p style={{ margin: 0, color: colors.textPrimary, fontWeight: 900 }}>
          Avg {qaMetrics.avgFps || 0} FPS · {qaMetrics.avgInferenceMs || 0}ms inference
        </p>
        <p style={{ margin: "4px 0 0", color: colors.textSecondary, fontSize: 12 }}>
          Lock rate {Math.round((qaMetrics.lockRate || 0) * 100)}% · {qaMetrics.relocks || 0} re-locks · {qaMetrics.durationSec || 0}s sampled
        </p>
        <button
          onClick={handleExportQaReport}
          style={{
            marginTop: 10,
            border: `1px solid ${colors.border}`,
            borderRadius: radii.pill,
            padding: "9px 12px",
            background: colors.surface,
            color: colors.textPrimary,
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          EXPORT QA REPORT
        </button>
      </div>

      {/* Rim calibration status card */}
      <div style={{
        padding: 12,
        borderRadius: radii.lg,
        background: rimValid
          ? (rimStale ? "rgba(255,93,93,0.08)" : "rgba(255,122,26,0.1)")
          : "rgba(255,255,255,0.05)",
        border: `1px solid ${rimValid ? (rimStale ? colors.danger + "44" : "rgba(255,122,26,0.35)") : colors.border}`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <p style={{ ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase", margin: "0 0 4px" }}>
              Rim Calibration
            </p>
            {rimValid ? (
              <>
                <p style={{ margin: 0, color: rimStale ? colors.danger : "#FF9F1C", fontWeight: 900, fontSize: 13 }}>
                  {rimStale ? "⚠ Stale — recalibrate recommended" : "✓ Rim locked"}
                </p>
                {ball && (
                  <p style={{ ...typeScale.caption, margin: "4px 0 0", color: colors.textSecondary }}>
                    Ball centre: ({Math.round(ball.center.x)}, {Math.round(ball.center.y)})
                  </p>
                )}
              </>
            ) : (
              <p style={{ margin: 0, color: colors.textSecondary, fontSize: 12 }}>
                No calibration — tap "Calibrate Rim" to mark the hoop.
              </p>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <button
              onClick={() => setShowCalibration(true)}
              style={{
                border: "1px solid rgba(255,122,26,0.45)",
                borderRadius: radii.pill,
                padding: "7px 12px",
                background: "rgba(255,122,26,0.14)",
                color: "#FF9F1C",
                fontWeight: 900,
                fontSize: 12,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {rimValid ? "Recalibrate" : "Calibrate Rim"}
            </button>
            {rimValid && (
              <button
                onClick={handleClearCalibration}
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: radii.pill,
                  padding: "5px 10px",
                  background: "transparent",
                  color: colors.textMuted,
                  fontWeight: 700,
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Current logging target */}
      <div style={{
        padding: 12,
        borderRadius: radii.lg,
        background: "rgba(255,255,255,0.05)",
        border: `1px solid ${colors.border}`,
        textAlign: "left",
      }}>
        <p style={{ ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase", margin: "0 0 4px" }}>
          Logging target
        </p>
        <p style={{ margin: 0, color: colors.textPrimary, fontWeight: 900 }}>
          {currentZoneName || "Selected zone"} • {currentType || "Selected shot"}
        </p>
        <p style={{ margin: "6px 0 0", color: colors.textSecondary, fontSize: 12 }}>
          Auto detections log straight into this target. Manual override buttons below still work if you need them.
        </p>
      </div>

      {lastShotEvent && (
        <div style={{
          padding: 12,
          borderRadius: radii.lg,
          background: lastShotEvent.suppressed ? "rgba(255,159,28,0.12)" : lastShotEvent.result === "make" ? "rgba(61,220,151,0.12)" : "rgba(244,63,94,0.12)",
          border: `1px solid ${lastShotEvent.suppressed ? "rgba(255,159,28,0.3)" : lastShotEvent.result === "make" ? "rgba(61,220,151,0.3)" : "rgba(244,63,94,0.28)"}`,
        }}>
          <p style={{ ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase", margin: "0 0 4px" }}>
            Last Auto Detection
          </p>
          <p style={{ margin: 0, fontWeight: 950, color: lastShotEvent.suppressed ? "#FF9F1C" : lastShotEvent.result === "make" ? colors.success : colors.danger }}>
            {lastShotEvent.suppressed
              ? `${lastShotEvent.result.toUpperCase()} suppressed`
              : lastShotEvent.result === "make"
                ? "MAKE logged"
                : "MISS logged"}
          </p>
          <p style={{ margin: "4px 0 0", color: colors.textSecondary, fontSize: 12 }}>
            Confidence {Math.round((lastShotEvent.confidence || 0) * 100)}%
          </p>
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={isStreaming ? stopCamera : startCamera}
          disabled={disabled || status === "requesting"}
          style={{
            width: "100%",
            border: `1px solid ${colors.border}`,
            borderRadius: radii.pill,
            padding: "11px 12px",
            background: colors.surface,
            color: colors.textPrimary,
            fontWeight: 900,
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.45 : 1,
          }}
        >
          {isStreaming ? "STOP CAMERA" : "START CAMERA"}
        </button>
      </div>
    </div>
  );
}
