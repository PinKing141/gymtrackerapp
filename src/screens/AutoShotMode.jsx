import { useCallback, useState } from "react";
import { useAutoShotMode } from "../hooks/useAutoShotMode.js";
import {
  clearRimCalibration,
  isStaleCalibration,
  isValidCalibration,
  loadRimCalibration,
} from "../lib/rimCalibration.js";
import { RimCalibrationScreen } from "./RimCalibrationScreen.jsx";
import { colors, radii, typeScale } from "../theme.js";

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
  const [showCalibration, setShowCalibration] = useState(false);

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
    startCamera,
    stopCamera,
    isStreaming,
  } = useAutoShotMode({ rimCalibration });

  const ball = detection?.ball;
  const rimValid = isValidCalibration(rimCalibration);
  const rimStale = isStaleCalibration(rimCalibration);

  const handleCalibrationSave = useCallback((calibration) => {
    setRimCalibration(calibration);
    setShowCalibration(false);
  }, []);

  const handleCalibrationCancel = useCallback(() => {
    setShowCalibration(false);
  }, []);

  const handleClearCalibration = useCallback(() => {
    clearRimCalibration();
    setRimCalibration(null);
  }, []);

  const logTestShot = (result) => {
    onRecordShot?.({ result, source: "auto-test", confidence: 1 });
  };

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
      </div>

      {/* Camera toggle + test buttons */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={isStreaming ? stopCamera : startCamera}
          disabled={disabled || status === "requesting"}
          style={{
            flex: 1,
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
        <button
          onClick={() => logTestShot("make")}
          disabled={disabled}
          style={{
            border: 0,
            borderRadius: radii.pill,
            padding: "11px 12px",
            background: "rgba(61,220,151,0.16)",
            color: colors.success,
            fontWeight: 950,
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.45 : 1,
          }}
        >
          TEST MAKE
        </button>
        <button
          onClick={() => logTestShot("miss")}
          disabled={disabled}
          style={{
            border: 0,
            borderRadius: radii.pill,
            padding: "11px 12px",
            background: "rgba(244,63,94,0.16)",
            color: "#FF9A9A",
            fontWeight: 950,
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.45 : 1,
          }}
        >
          TEST MISS
        </button>
      </div>
    </div>
  );
}
