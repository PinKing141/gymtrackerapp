// src/lib/rimCalibration.js
// Phase 2: Rim calibration — persist, load, validate, draw helpers

const STORAGE_KEY = "basketball_rim_calibration_v1";
const STALE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * @typedef {Object} RimCalibration
 * @property {{ x: number, y: number }} rimCenter   — pixel coords in the video frame
 * @property {number}                   rimRadius   — pixels
 * @property {number}                   videoWidth  — frame width at calibration time
 * @property {number}                   videoHeight — frame height at calibration time
 * @property {number}                   timestamp   — Date.now() when saved
 */

export function saveRimCalibration(calibration) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...calibration, timestamp: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function loadRimCalibration() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isValidCalibration(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearRimCalibration() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function isValidCalibration(cal) {
  return (
    cal &&
    typeof cal.rimCenter?.x === "number" &&
    typeof cal.rimCenter?.y === "number" &&
    typeof cal.rimRadius === "number" &&
    cal.rimRadius > 0 &&
    typeof cal.videoWidth === "number" &&
    typeof cal.videoHeight === "number"
  );
}

export function isStaleCalibration(cal) {
  if (!cal?.timestamp) return true;
  return Date.now() - cal.timestamp > STALE_MS;
}

/**
 * Scale stored calibration to the current canvas/video size.
 * Returns adjusted calibration so it works even if the user changed device orientation.
 */
export function scaleCalibration(cal, currentWidth, currentHeight) {
  if (!isValidCalibration(cal)) return null;
  if (cal.videoWidth === currentWidth && cal.videoHeight === currentHeight) return cal;

  const scaleX = currentWidth / cal.videoWidth;
  const scaleY = currentHeight / cal.videoHeight;
  const scale = Math.min(scaleX, scaleY);

  return {
    ...cal,
    rimCenter: {
      x: cal.rimCenter.x * scaleX,
      y: cal.rimCenter.y * scaleY,
    },
    rimRadius: cal.rimRadius * scale,
    videoWidth: currentWidth,
    videoHeight: currentHeight,
  };
}

/**
 * Draw the calibrated rim on a canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {RimCalibration} cal
 * @param {{ pulse?: boolean, alpha?: number }} opts
 */
export function drawRimOverlay(ctx, cal, { pulse = false, alpha = 1 } = {}) {
  if (!isValidCalibration(cal)) return;

  const { rimCenter, rimRadius } = cal;
  ctx.save();
  ctx.globalAlpha = alpha;

  // Outer glow ring
  ctx.beginPath();
  ctx.arc(rimCenter.x, rimCenter.y, rimRadius + 6, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255, 122, 26, ${pulse ? 0.9 : 0.55})`;
  ctx.lineWidth = pulse ? 3 : 2;
  ctx.setLineDash(pulse ? [] : [8, 6]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Rim circle
  ctx.beginPath();
  ctx.arc(rimCenter.x, rimCenter.y, rimRadius, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255, 159, 28, 0.95)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Fill zone (1.5x radius zone used by trajectory tracker)
  ctx.beginPath();
  ctx.arc(rimCenter.x, rimCenter.y, rimRadius * 1.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 122, 26, 0.08)";
  ctx.fill();

  // Center crosshair
  const arm = 10;
  ctx.strokeStyle = "#FF9F1C";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(rimCenter.x - arm, rimCenter.y);
  ctx.lineTo(rimCenter.x + arm, rimCenter.y);
  ctx.moveTo(rimCenter.x, rimCenter.y - arm);
  ctx.lineTo(rimCenter.x, rimCenter.y + arm);
  ctx.stroke();

  // Label
  ctx.fillStyle = "rgba(10, 10, 15, 0.85)";
  const labelW = 90;
  const labelH = 22;
  const lx = rimCenter.x - labelW / 2;
  const ly = rimCenter.y + rimRadius + 14;
  ctx.beginPath();
  ctx.roundRect(lx, ly, labelW, labelH, 6);
  ctx.fill();
  ctx.fillStyle = "#FF9F1C";
  ctx.font = "700 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("RIM LOCKED", rimCenter.x, ly + 15);
  ctx.textAlign = "left";

  ctx.restore();
}
