// src/screens/RimCalibrationScreen.jsx
// Phase 2: Full-screen rim calibration — live camera + tap/drag UI

import { useCallback, useEffect, useRef, useState } from "react";
import { colors, radii, typeScale } from "../theme.js";
import { saveRimCalibration, isValidCalibration, isStaleCalibration, scaleCalibration } from "../lib/rimCalibration.js";

const CAMERA_CONSTRAINTS = {
  audio: false,
  video: {
    facingMode: "environment",
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 60, min: 24 },
  },
};

function useCalibrationCamera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState("idle"); // idle | requesting | streaming | error
  const [error, setError] = useState("");

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera not supported in this browser.");
      setStatus("error");
      return;
    }
    setStatus("requesting");
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus("streaming");
    } catch (err) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setError(err.name === "NotAllowedError" ? "Camera access denied." : err.message || "Camera error.");
      setStatus("error");
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  return { videoRef, status, error, startCamera, stopCamera, isStreaming: status === "streaming" };
}

/**
 * Convert a pointer/touch event position to canvas-local pixel coords,
 * accounting for the canvas being CSS-scaled (rendered at video resolution
 * but displayed at a smaller CSS size).
 */
function eventToCanvasCoords(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

export function RimCalibrationScreen({ existingCalibration, onSave, onCancel }) {
  const { videoRef, status, error, startCamera, stopCamera, isStreaming } = useCalibrationCamera();
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  // calibration draft state
  const [phase, setPhase] = useState("idle"); // idle | tap-center | drag-radius | preview
  const [center, setCenter] = useState(null); // { x, y } in canvas px
  const [radius, setRadius] = useState(0);
  const [dragStart, setDragStart] = useState(null);
  const [saved, setSaved] = useState(false);

  const isStale = isStaleCalibration(existingCalibration);
  const hasExisting = isValidCalibration(existingCalibration);

  // Animation loop — draws video frame + overlays onto canvas
  const drawFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) {
      animFrameRef.current = requestAnimationFrame(drawFrame);
      return;
    }
    if (canvas.width !== vw || canvas.height !== vh) {
      canvas.width = vw;
      canvas.height = vh;
    }

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, vw, vh);
    ctx.drawImage(video, 0, 0, vw, vh);

    // Draw existing calibration faintly
    if (hasExisting && phase === "idle") {
      const scaled = scaleCalibration(existingCalibration, vw, vh);
      if (scaled) {
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(scaled.rimCenter.x, scaled.rimCenter.y, scaled.rimRadius, 0, Math.PI * 2);
        ctx.strokeStyle = "#FF9F1C";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // Draw current draft
    if (center && radius > 0) {
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "#FF9F1C";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 159, 28, 0.1)";
      ctx.fill();
    } else if (center && phase !== "idle") {
      ctx.fillStyle = "rgba(255, 159, 28, 0.2)";
      ctx.fillRect(center.x - 20, center.y - 20, 40, 40);
    }

    // Instruction overlay
    if (phase === "tap-center") {
      ctx.fillStyle = "rgba(10, 10, 15, 0.7)";
      ctx.fillRect(0, 0, vw, vh);
      ctx.fillStyle = "#FF9F1C";
      ctx.font = "700 20px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Tap the centre of the rim", vw / 2, vh / 2);
    }
    if (phase === "drag-radius") {
      ctx.fillStyle = "rgba(10, 10, 15, 0.5)";
      ctx.fillRect(0, 0, vw, vh);
      ctx.fillStyle = "#FF9F1C";
      ctx.font = "700 18px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Drag to the rim edge (r = ${Math.round(radius)}px)`, vw / 2, vh / 2);
    }

    animFrameRef.current = requestAnimationFrame(drawFrame);
  }, [videoRef, phase, center, radius, hasExisting, existingCalibration]);

  useEffect(() => {
    if (isStreaming) {
      animFrameRef.current = requestAnimationFrame(drawFrame);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isStreaming, drawFrame]);

  // ── Pointer handlers ──────────────────────────────────────────────────────

  const handlePointerDown = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas || !isStreaming) return;
    e.preventDefault();
    const pos = eventToCanvasCoords(e, canvas);

    if (phase === "tap-center" || phase === "idle" || phase === "preview") {
      setCenter(pos);
      setRadius(0);
      setDragStart(null);
      setPhase("drag-radius");
    } else if (phase === "drag-radius") {
      setDragStart(pos);
    }
  }, [phase, center, isStreaming]);

  const handlePointerMove = useCallback((e) => {
    if (phase !== "drag-radius" || !center || !dragStart) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = eventToCanvasCoords(e, canvas);
    const r = Math.hypot(pos.x - center.x, pos.y - center.y);
    setRadius(r);
  }, [phase, center, dragStart]);

  const handlePointerUp = useCallback((e) => {
    if (phase !== "drag-radius") return;
    e.preventDefault();
    if (radius > 10) {
      setPhase("preview");
    } else {
      setCenter(null);
      setRadius(0);
      setPhase("tap-center");
    }
    setDragStart(null);
  }, [phase, radius]);

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !center || radius <= 0) return;
    const calibration = {
      rimCenter: center,
      rimRadius: radius,
      videoWidth: canvas.width,
      videoHeight: canvas.height,
    };
    saveRimCalibration(calibration);
    setSaved(true);
    setTimeout(() => {
      stopCamera();
      onSave(calibration);
    }, 600);
  }, [center, radius, stopCamera, onSave]);

  const handleReset = () => {
    setPhase("tap-center");
    setCenter(null);
    setRadius(0);
    setDragStart(null);
  };

  const handleStart = () => {
    startCamera().then(() => setPhase("tap-center"));
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 300,
      background: "#050507",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        padding: "calc(env(safe-area-inset-top, 0px) + 14px) 16px 12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(10,10,15,0.92)",
        borderBottom: `1px solid ${colors.border}`,
        backdropFilter: "blur(12px)",
        flexShrink: 0,
      }}>
        <button
          onClick={() => { stopCamera(); onCancel(); }}
          style={{ border: 0, background: "none", color: colors.textMuted, fontWeight: 700, fontSize: 14, cursor: "pointer", padding: "6px 0" }}
        >
          ✕ Cancel
        </button>
        <div style={{ textAlign: "center" }}>
          <p style={{ ...typeScale.overline, color: "#FF9F1C", textTransform: "uppercase", margin: 0 }}>Phase 2</p>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: colors.textPrimary }}>Rim Calibration</h2>
        </div>
        <div style={{ width: 70 }} />
      </div>

      {/* Camera / placeholder */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", display: isStreaming ? "block" : "none", background: "#000" }}
        />
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            touchAction: "none",
            cursor: phase === "tap-center" ? "crosshair" : phase === "drag-radius" ? "cell" : "default",
            display: isStreaming ? "block" : "none",
          }}
        />

        {/* Idle state — start prompt */}
        {!isStreaming && (
          <div style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 24,
            textAlign: "center",
            background: "linear-gradient(135deg, rgba(255,122,26,0.12), rgba(45,125,210,0.1))",
          }}>
            <div style={{ fontSize: 52 }}>🏀</div>
            <h3 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Calibrate the Rim</h3>
            <p style={{ ...typeScale.bodySm, color: colors.textSecondary, maxWidth: 280, margin: 0 }}>
              Point your camera at the hoop. You'll tap the rim centre, then drag to its edge. This only takes 5 seconds and stays saved across sessions.
            </p>
            {hasExisting && (
              <div style={{
                padding: "10px 14px",
                borderRadius: radii.md,
                background: isStale ? "rgba(255,93,93,0.12)" : "rgba(61,220,151,0.12)",
                border: `1px solid ${isStale ? colors.danger : colors.success}44`,
                color: isStale ? colors.danger : colors.success,
                fontSize: 12,
                fontWeight: 700,
              }}>
                {isStale ? "⚠ Saved calibration is over 30 days old" : "✓ Calibration already saved — recalibrating will overwrite it"}
              </div>
            )}
            {error && (
              <p style={{ color: colors.danger, fontSize: 13, fontWeight: 700, margin: 0 }}>{error}</p>
            )}
            <button
              onClick={handleStart}
              disabled={status === "requesting"}
              style={{
                border: 0,
                borderRadius: radii.pill,
                padding: "14px 24px",
                background: "#FF7A1A",
                color: "#fff",
                fontWeight: 950,
                fontSize: 15,
                cursor: "pointer",
                opacity: status === "requesting" ? 0.6 : 1,
              }}
            >
              {status === "requesting" ? "Starting camera…" : "Start Camera"}
            </button>
            {hasExisting && (
              <button
                onClick={() => { stopCamera(); onCancel(); }}
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: radii.pill,
                  padding: "11px 18px",
                  background: "transparent",
                  color: colors.textSecondary,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Keep existing calibration
              </button>
            )}
          </div>
        )}

        {/* Error overlay */}
        {error && isStreaming && (
          <div style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            right: 12,
            padding: 12,
            borderRadius: radii.md,
            background: "rgba(244,63,94,0.18)",
            border: "1px solid rgba(244,63,94,0.4)",
            color: "#FFC2CD",
            fontWeight: 700,
            fontSize: 13,
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Bottom controls */}
      {isStreaming && (
        <div style={{
          padding: "14px 16px calc(env(safe-area-inset-bottom, 0px) + 14px)",
          background: "rgba(10,10,15,0.94)",
          borderTop: `1px solid ${colors.border}`,
          backdropFilter: "blur(12px)",
          display: "grid",
          gap: 10,
          flexShrink: 0,
        }}>
          {/* Step indicator */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center" }}>
            {[
              { key: "tap-center", label: "1. Tap centre" },
              { key: "drag-radius", label: "2. Drag to edge" },
              { key: "preview", label: "3. Confirm" },
            ].map((step) => {
              const isActive = phase === step.key;
              const isDone =
                (step.key === "tap-center" && (phase === "drag-radius" || phase === "preview")) ||
                (step.key === "drag-radius" && phase === "preview");
              return (
                <div key={step.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 11,
                    fontWeight: 900,
                    background: isDone ? colors.success : isActive ? "#FF7A1A" : "rgba(255,255,255,0.08)",
                    color: isDone || isActive ? "#fff" : colors.textMuted,
                    transition: "background 0.2s",
                  }}>
                    {isDone ? "✓" : step.key.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: 11, color: isActive ? "#FF9F1C" : colors.textMuted, fontWeight: isActive ? 800 : 500 }}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Action buttons */}
          {phase === "preview" && (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleReset}
                style={{
                  flex: 1,
                  border: `1px solid ${colors.border}`,
                  borderRadius: radii.pill,
                  padding: "13px 0",
                  background: "transparent",
                  color: colors.textSecondary,
                  fontWeight: 900,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Redo
              </button>
              <button
                onClick={handleSave}
                disabled={saved}
                style={{
                  flex: 2,
                  border: 0,
                  borderRadius: radii.pill,
                  padding: "13px 0",
                  background: saved ? colors.success : "#FF7A1A",
                  color: "#fff",
                  fontWeight: 950,
                  fontSize: 15,
                  cursor: "pointer",
                  transition: "background 0.3s",
                }}
              >
                {saved ? "✓ Saved!" : "Save Calibration"}
              </button>
            </div>
          )}

          {phase === "tap-center" && (
            <p style={{ ...typeScale.bodySm, color: colors.textSecondary, textAlign: "center", margin: 0 }}>
              Tap anywhere on the rim circle's centre point
            </p>
          )}

          {phase === "drag-radius" && (
            <p style={{ ...typeScale.bodySm, color: colors.textSecondary, textAlign: "center", margin: 0 }}>
              Keep finger down and drag to the rim edge • {radius > 0 ? `r = ${Math.round(radius)}px` : "drag to set radius"}
            </p>
          )}

          {phase === "idle" && (
            <p style={{ ...typeScale.bodySm, color: colors.textMuted, textAlign: "center", margin: 0 }}>
              Position camera so the whole hoop is visible, then tap to begin
            </p>
          )}
        </div>
      )}
    </div>
  );
}
