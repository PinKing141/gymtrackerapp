import { useCallback, useEffect, useRef, useState } from "react";
import { createRimZoneBallFinder } from "../lib/rimZoneBallFinder.js";
import { colors, radii, typeScale } from "../theme.js";

const CHECK_EVERY_MS = 50;
// Keep the box up briefly between sightings so it doesn't flicker.
const HOLD_BALL_MS = 200;
// With no rim to size the ball from, accept anything from ~4% to ~30% of the
// search square across (the finder normally expects a ball next to a rim).
const TEST_AREA_RANGE = [0.1, 7];

function getCameraError(error) {
  if (error?.name === "NotAllowedError") return "Camera access was blocked. Allow the camera for this site, then try again.";
  if (error?.name === "NotFoundError") return "No camera was found on this device.";
  return "Couldn't start the camera.";
}

// The centre square of the frame, where you'd hold or bounce the ball.
function centreSquare(video) {
  const size = Math.min(video.videoWidth, video.videoHeight);
  return { x: (video.videoWidth - size) / 2, y: (video.videoHeight - size) / 2, size };
}

function drawOverlay(canvas, video, region, ball) {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  const line = Math.max(3, canvas.width * 0.006);

  context.setLineDash([line * 3, line * 3]);
  context.strokeStyle = "rgba(255,255,255,0.35)";
  context.lineWidth = line / 2;
  context.strokeRect(region.x, region.y, region.size, region.size);
  context.setLineDash([]);

  if (!ball) return;
  context.strokeStyle = colors.success;
  context.lineWidth = line;
  context.beginPath();
  context.arc(ball.center.x, ball.center.y, ball.radius * 1.15, 0, Math.PI * 2);
  context.stroke();
}

/**
 * Prop the phone up and move a basketball in front of it: this runs the same
 * ball finder the shot tracker uses near the hoop (a moving, ball-coloured,
 * round blob), so you can see it lock on before trying it at a court.
 */
export function BallTestView({ onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const finderRef = useRef(null);
  const frameRef = useRef(null);
  const lastCheckRef = useRef(0);
  const lastBallRef = useRef(null);
  const [facingMode, setFacingMode] = useState("environment");
  const [cameraState, setCameraState] = useState("starting");
  const [cameraError, setCameraError] = useState("");
  const [status, setStatus] = useState({ found: false, checkMs: null });

  if (!finderRef.current) {
    finderRef.current = createRimZoneBallFinder();
  }

  // (Re)start the camera whenever the facing mode changes.
  useEffect(() => {
    let cancelled = false;
    async function start() {
      setCameraState("starting");
      setCameraError("");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        setCameraState("on");
      } catch (error) {
        if (!cancelled) {
          setCameraError(getCameraError(error));
          setCameraState("error");
        }
      }
    }
    if (navigator.mediaDevices?.getUserMedia) {
      start();
    } else {
      setCameraError("This browser doesn't support camera access.");
      setCameraState("error");
    }
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      finderRef.current?.reset();
      lastBallRef.current = null;
    };
  }, [facingMode]);

  const tick = useCallback((timestamp) => {
    frameRef.current = requestAnimationFrame(tick);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2 || !video.videoWidth) return;
    if (timestamp - lastCheckRef.current < CHECK_EVERY_MS) return;
    lastCheckRef.current = timestamp;

    const region = centreSquare(video);
    const startedAt = performance.now();
    const found = finderRef.current.find(video, region, region.size * 0.2, lastBallRef.current, { areaRange: TEST_AREA_RANGE });
    const checkMs = Math.round(performance.now() - startedAt);

    if (found) {
      lastBallRef.current = { ...found, seenAt: timestamp };
    } else if (lastBallRef.current && timestamp - lastBallRef.current.seenAt > HOLD_BALL_MS) {
      lastBallRef.current = null;
    }
    drawOverlay(canvas, video, region, lastBallRef.current);
    setStatus((current) => (current.found === Boolean(lastBallRef.current) && current.checkMs === checkMs
      ? current
      : { found: Boolean(lastBallRef.current), checkMs }));
  }, []);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [tick]);

  let headline = "Starting camera…";
  if (cameraState === "error") headline = cameraError;
  else if (cameraState === "on") headline = status.found ? "Ball found" : "Move a basketball in the square";

  const mirror = facingMode === "user" ? "scaleX(-1)" : "none";
  return (
    <div role="dialog" aria-label="Ball test" style={{ position: "fixed", inset: 0, zIndex: 400, background: "#000", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: colors.surface }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ ...typeScale.overline, margin: 0, color: colors.textMuted, textTransform: "uppercase" }}>Ball test</p>
          <p style={{ margin: "2px 0 0", fontWeight: 800, color: status.found ? colors.success : colors.textPrimary }}>{headline}</p>
        </div>
        <button type="button" onClick={onClose} style={{ border: 0, borderRadius: radii.pill, padding: "10px 14px", background: "rgba(255,255,255,0.1)", color: colors.textPrimary, fontWeight: 700, cursor: "pointer" }}>
          Close
        </button>
      </div>

      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <video ref={videoRef} muted playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", transform: mirror }} />
        <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none", transform: mirror }} />
      </div>

      <div style={{ padding: "12px 16px calc(env(safe-area-inset-bottom, 0px) + 14px)", display: "grid", gap: 10, background: colors.surface }}>
        <p style={{ ...typeScale.bodySm, margin: 0, color: colors.textSecondary }}>
          Prop the phone up so it stays still, then move, dribble or toss the ball inside the dashed square. A green circle means it's locked on.
          {status.checkMs !== null ? ` (${status.checkMs} ms per check)` : ""}
        </p>
        <p style={{ ...typeScale.caption, margin: 0, color: colors.textMuted }}>
          This is the same ball finder the shot tracker uses around the hoop. It looks for a moving, ball-coloured, round shape, so a ball held perfectly still, or a shaking phone, won't lock.
        </p>
        <button type="button" onClick={() => setFacingMode((current) => (current === "environment" ? "user" : "environment"))} style={{ border: `1px solid ${colors.border}`, borderRadius: radii.pill, padding: "11px 14px", background: "transparent", color: colors.textPrimary, fontWeight: 700, cursor: "pointer" }}>
          Switch camera
        </button>
      </div>
    </div>
  );
}
