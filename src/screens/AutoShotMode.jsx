import { useAutoShotMode } from "../hooks/useAutoShotMode.js";
import { colors, radii, typeScale } from "../theme.js";

function StatusPill({ label, value, accent = "#FF9F1C" }) {
  return (
    <div style={{ padding: "9px 10px", borderRadius: radii.md, background: "rgba(255,255,255,0.07)", border: `1px solid ${colors.border}` }}>
      <p style={{ ...typeScale.caption, color: colors.textMuted, margin: 0, textTransform: "uppercase", fontWeight: 850 }}>{label}</p>
      <p style={{ margin: "2px 0 0", color: accent, fontWeight: 950 }}>{value}</p>
    </div>
  );
}

export function AutoShotMode({ onRecordShot, currentZoneName, currentType, disabled = false }) {
  const { videoRef, canvasRef, status, error, fps, videoSize, startCamera, stopCamera, isStreaming } = useAutoShotMode();

  const logTestShot = (result) => {
    onRecordShot?.({ result, source: "auto-test", confidence: 1 });
  };

  return (
    <div style={{ width: "100%", maxWidth: 430, display: "grid", gap: 12 }}>
      <div style={{ position: "relative", overflow: "hidden", borderRadius: 24, border: `1px solid ${colors.border}`, background: "#050507", boxShadow: "0 18px 55px rgba(0,0,0,0.35)", aspectRatio: "9 / 16" }}>
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          style={{ width: "100%", height: "100%", objectFit: "cover", display: isStreaming ? "block" : "none" }}
        />
        <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
        {!isStreaming && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 24, textAlign: "center", background: "linear-gradient(135deg, rgba(255,122,26,0.16), rgba(88,80,236,0.14))" }}>
            <div>
              <p style={{ fontSize: 44, margin: "0 0 12px" }}>📷</p>
              <h3 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 950 }}>Auto Shot Mode</h3>
              <p style={{ ...typeScale.bodySm, margin: "0 0 16px", color: colors.textSecondary }}>Start the camera to verify the Phase 0 video feed and canvas overlay.</p>
              <button onClick={startCamera} disabled={disabled || status === "requesting"} style={{ border: 0, borderRadius: radii.pill, padding: "12px 16px", background: "#FF7A1A", color: "#fff", fontWeight: 950, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1 }}>
                {status === "requesting" ? "REQUESTING CAMERA…" : "START CAMERA"}
              </button>
            </div>
          </div>
        )}
        {error && <div style={{ position: "absolute", left: 12, right: 12, bottom: 12, padding: 12, borderRadius: radii.md, background: "rgba(244,63,94,0.16)", border: "1px solid rgba(244,63,94,0.38)", color: "#FFC2CD", fontWeight: 800 }}>{error}</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <StatusPill label="Status" value={isStreaming ? "Live" : status === "error" ? "Blocked" : "Ready"} accent={isStreaming ? colors.success : "#FF9F1C"} />
        <StatusPill label="FPS" value={isStreaming ? fps || "…" : "—"} />
        <StatusPill label="Frame" value={videoSize.width ? `${videoSize.width}p` : "—"} />
      </div>

      <div style={{ padding: 12, borderRadius: radii.lg, background: "rgba(255,255,255,0.05)", border: `1px solid ${colors.border}`, textAlign: "left" }}>
        <p style={{ ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase", margin: "0 0 6px" }}>Current logging target</p>
        <p style={{ margin: 0, color: colors.textPrimary, fontWeight: 900 }}>{currentZoneName || "Selected zone"} • {currentType || "Selected shot"}</p>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={isStreaming ? stopCamera : startCamera} disabled={disabled || status === "requesting"} style={{ flex: 1, border: `1px solid ${colors.border}`, borderRadius: radii.pill, padding: "11px 12px", background: colors.surface, color: colors.textPrimary, fontWeight: 900, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1 }}>
          {isStreaming ? "STOP CAMERA" : "START CAMERA"}
        </button>
        <button onClick={() => logTestShot("make")} disabled={disabled} style={{ border: 0, borderRadius: radii.pill, padding: "11px 12px", background: "rgba(61,220,151,0.16)", color: colors.success, fontWeight: 950, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1 }}>TEST MAKE</button>
        <button onClick={() => logTestShot("miss")} disabled={disabled} style={{ border: 0, borderRadius: radii.pill, padding: "11px 12px", background: "rgba(244,63,94,0.16)", color: "#FF9A9A", fontWeight: 950, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1 }}>TEST MISS</button>
      </div>
    </div>
  );
}
