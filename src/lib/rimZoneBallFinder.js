// Finds the basketball near the hoop without a neural network.
//
// Once the rim is locked we know two things a general object detector doesn't:
// where the ball has to pass, and how big it should look (a ball is about 0.6
// of the rim's radius). Inside a square around the hoop, the ball is the thing
// that is both moving between frames and ball-coloured. That's cheap to compute
// on a phone and works when the ball is only ~20 px across, where COCO-SSD sees
// nothing.

const SAMPLE_SIZE = 128;
// Ball radius relative to rim radius (24 cm ball vs 45 cm rim, plus a little
// motion blur), and how far a blob's area may stray from that.
const BALL_TO_RIM_RADIUS = 0.6;
const MIN_AREA_FACTOR = 0.2;
const MAX_AREA_FACTOR = 2.6;
const MAX_ASPECT = 2.4;
const MIN_FILL = 0.3;
const MOTION_THRESHOLD = 16;
// If this much of the area changed, the camera moved: skip the frame.
const MAX_MOVING_SHARE = 0.25;

function toHsl(red, green, blue) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  if (max === min) return { hue: 0, saturation: 0, lightness };
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue;
  if (max === r) hue = ((g - b) / delta) + (g < b ? 6 : 0);
  else if (max === g) hue = ((b - r) / delta) + 2;
  else hue = ((r - g) / delta) + 4;
  return { hue: hue * 60, saturation, lightness };
}

// Basketballs on camera range from bright orange to dark red-brown in shade.
export function isBallColored(red, green, blue) {
  const { hue, saturation, lightness } = toHsl(red, green, blue);
  return (hue <= 40 || hue >= 340) && saturation >= 0.18 && lightness >= 0.1 && lightness <= 0.65;
}

export function toLuma(rgba, size) {
  const luma = new Uint8Array(size * size);
  for (let index = 0; index < luma.length; index += 1) {
    const offset = index * 4;
    luma[index] = (rgba[offset] * 77 + rgba[offset + 1] * 150 + rgba[offset + 2] * 29) >> 8;
  }
  return luma;
}

// 4-connected components of a boolean mask, with area and bounding box.
function findBlobs(mask, size) {
  const labels = new Int32Array(mask.length).fill(-1);
  const blobs = [];
  const stack = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || labels[start] !== -1) continue;
    const blob = { area: 0, sumX: 0, sumY: 0, minX: size, maxX: 0, minY: size, maxY: 0 };
    labels[start] = blobs.length;
    stack.push(start);
    while (stack.length) {
      const index = stack.pop();
      const x = index % size;
      const y = (index - x) / size;
      blob.area += 1;
      blob.sumX += x;
      blob.sumY += y;
      if (x < blob.minX) blob.minX = x;
      if (x > blob.maxX) blob.maxX = x;
      if (y < blob.minY) blob.minY = y;
      if (y > blob.maxY) blob.maxY = y;
      const neighbours = [x > 0 ? index - 1 : -1, x < size - 1 ? index + 1 : -1, y > 0 ? index - size : -1, y < size - 1 ? index + size : -1];
      for (const next of neighbours) {
        if (next >= 0 && mask[next] && labels[next] === -1) {
          labels[next] = blobs.length;
          stack.push(next);
        }
      }
    }
    blobs.push(blob);
  }
  return blobs;
}

/**
 * Core search on one sampled square (pure, so it can be unit tested).
 * @param {{ rgba: Uint8ClampedArray, previousLuma: Uint8Array|null, size: number,
 *   expectedRadius: number, previousCenter?: {x:number,y:number}|null,
 *   areaRange?: [number, number] }} input
 *   All coordinates are in sample pixels. areaRange widens or narrows the
 *   accepted blob area, as factors of the expected ball area.
 * @returns {{ center: {x:number,y:number}, radius: number, score: number, area: number } | null}
 */
export function findBallBlob({
  rgba,
  previousLuma,
  size,
  expectedRadius,
  previousCenter = null,
  areaRange = [MIN_AREA_FACTOR, MAX_AREA_FACTOR],
}) {
  const [minAreaFactor, maxAreaFactor] = areaRange;
  if (!previousLuma) return null;
  const luma = toLuma(rgba, size);
  const mask = new Uint8Array(size * size);
  let moving = 0;
  for (let index = 0; index < mask.length; index += 1) {
    if (Math.abs(luma[index] - previousLuma[index]) < MOTION_THRESHOLD) continue;
    moving += 1;
    const offset = index * 4;
    if (isBallColored(rgba[offset], rgba[offset + 1], rgba[offset + 2])) {
      mask[index] = 1;
    }
  }
  if (moving > mask.length * MAX_MOVING_SHARE) return null;

  const expectedArea = Math.PI * expectedRadius * expectedRadius;
  let best = null;
  for (const blob of findBlobs(mask, size)) {
    if (blob.area < expectedArea * minAreaFactor || blob.area > expectedArea * maxAreaFactor) continue;
    const width = blob.maxX - blob.minX + 1;
    const height = blob.maxY - blob.minY + 1;
    if (Math.max(width, height) / Math.min(width, height) > MAX_ASPECT) continue;
    if (blob.area / (width * height) < MIN_FILL) continue;

    const center = { x: blob.sumX / blob.area, y: blob.sumY / blob.area };
    const sizeScore = 1 - Math.min(1, Math.abs(Math.log(blob.area / expectedArea)) / Math.log(maxAreaFactor));
    const fillScore = Math.min(1, (blob.area / (width * height)) / 0.75);
    const continuityScore = previousCenter
      ? 1 - Math.min(1, Math.hypot(center.x - previousCenter.x, center.y - previousCenter.y) / (expectedRadius * 8))
      : 0.5;
    const score = (sizeScore * 0.45) + (fillScore * 0.25) + (continuityScore * 0.3);
    if (!best || score > best.score) {
      best = { center, radius: Math.sqrt(blob.area / Math.PI), score: Number(score.toFixed(2)), area: blob.area };
    }
  }
  return best;
}

export function createRimZoneBallFinder() {
  let canvas = null;
  let previous = null;

  return {
    reset() {
      previous = null;
    },

    /**
     * @param {HTMLVideoElement} video
     * @param {{ x: number, y: number, size: number }} region square to search, video pixels
     * @param {number} rimRadius in video pixels
     * @param {{ center: {x:number,y:number} } | null} previousBall last ball, video pixels
     * @param {{ areaRange?: [number, number] }} [options] see findBallBlob
     */
    find(video, region, rimRadius, previousBall = null, { areaRange } = {}) {
      if (!video || !region || !rimRadius || typeof document === "undefined") return null;
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.width = SAMPLE_SIZE;
        canvas.height = SAMPLE_SIZE;
      }
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return null;
      const x = Math.max(0, Math.min(video.videoWidth - region.size, region.x));
      const y = Math.max(0, Math.min(video.videoHeight - region.size, region.y));
      context.drawImage(video, x, y, region.size, region.size, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
      const rgba = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;

      const scale = region.size / SAMPLE_SIZE;
      const key = `${Math.round(x)}:${Math.round(y)}:${Math.round(region.size)}`;
      const previousLuma = previous?.key === key ? previous.luma : null;
      previous = { key, luma: toLuma(rgba, SAMPLE_SIZE) };

      const blob = findBallBlob({
        rgba,
        previousLuma,
        size: SAMPLE_SIZE,
        expectedRadius: (rimRadius * BALL_TO_RIM_RADIUS) / scale,
        areaRange,
        previousCenter: previousBall ? { x: (previousBall.center.x - x) / scale, y: (previousBall.center.y - y) / scale } : null,
      });
      if (!blob) return null;

      const center = { x: x + blob.center.x * scale, y: y + blob.center.y * scale };
      const radius = blob.radius * scale;
      return {
        className: "basketball",
        score: blob.score,
        bbox: { x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2 },
        center,
        radius,
        source: "rim-zone",
        timestamp: Date.now(),
      };
    },
  };
}
