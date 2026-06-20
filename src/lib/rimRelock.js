const SAMPLE_WIDTH = 96;
const SAMPLE_HEIGHT = 72;
const UPDATE_INTERVAL_MS = 650;
const MIN_ORANGE_PIXELS = 28;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getDistance(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function toHsl(red, green, blue) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { hue: 0, saturation: 0, lightness };
  }

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue;

  switch (max) {
    case r:
      hue = ((g - b) / delta) + (g < b ? 6 : 0);
      break;
    case g:
      hue = ((b - r) / delta) + 2;
      break;
    default:
      hue = ((r - g) / delta) + 4;
      break;
  }

  return {
    hue: hue * 60,
    saturation,
    lightness,
  };
}

function isLikelyRimPixel(red, green, blue, alpha) {
  if (alpha < 120) return false;
  const { hue, saturation, lightness } = toHsl(red, green, blue);
  return hue >= 10 && hue <= 52 && saturation >= 0.32 && lightness >= 0.16 && lightness <= 0.78;
}

function isValidCalibration(calibration) {
  return (
    calibration &&
    typeof calibration.rimCenter?.x === "number" &&
    typeof calibration.rimCenter?.y === "number" &&
    typeof calibration.rimRadius === "number" &&
    calibration.rimRadius > 0
  );
}

export function createRimRelock() {
  let sampleCanvas = null;
  let lastUpdateAt = 0;

  return {
    reset() {
      lastUpdateAt = 0;
    },

    update(videoElement, calibration) {
      if (!videoElement || !isValidCalibration(calibration) || typeof document === "undefined") {
        return null;
      }

      const now = Date.now();
      if (now - lastUpdateAt < UPDATE_INTERVAL_MS) {
        return null;
      }

      if (!sampleCanvas) {
        sampleCanvas = document.createElement("canvas");
      }

      const videoWidth = videoElement.videoWidth || calibration.videoWidth;
      const videoHeight = videoElement.videoHeight || calibration.videoHeight;
      if (!videoWidth || !videoHeight) {
        return null;
      }

      const roiWidth = clamp(Math.round(calibration.rimRadius * 4.6), 36, videoWidth);
      const roiHeight = clamp(Math.round(calibration.rimRadius * 2.8), 28, videoHeight);
      const roiX = clamp(Math.round(calibration.rimCenter.x - (roiWidth / 2)), 0, Math.max(0, videoWidth - roiWidth));
      const roiY = clamp(Math.round(calibration.rimCenter.y - (roiHeight / 2)), 0, Math.max(0, videoHeight - roiHeight));

      sampleCanvas.width = SAMPLE_WIDTH;
      sampleCanvas.height = SAMPLE_HEIGHT;

      const context = sampleCanvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        return null;
      }

      context.clearRect(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
      context.drawImage(videoElement, roiX, roiY, roiWidth, roiHeight, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);

      const pixels = context.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT).data;
      let minX = SAMPLE_WIDTH;
      let maxX = 0;
      let minY = SAMPLE_HEIGHT;
      let maxY = 0;
      let orangePixels = 0;

      for (let y = 0; y < SAMPLE_HEIGHT; y += 1) {
        for (let x = 0; x < SAMPLE_WIDTH; x += 1) {
          const index = ((y * SAMPLE_WIDTH) + x) * 4;
          if (!isLikelyRimPixel(pixels[index], pixels[index + 1], pixels[index + 2], pixels[index + 3])) {
            continue;
          }

          orangePixels += 1;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }

      if (orangePixels < MIN_ORANGE_PIXELS) {
        return {
          calibration: null,
          confidence: 0,
          orangePixels,
        };
      }

      const scaleX = roiWidth / SAMPLE_WIDTH;
      const scaleY = roiHeight / SAMPLE_HEIGHT;
      const detectedCenter = {
        x: roiX + (((minX + maxX) / 2) * scaleX),
        y: roiY + (((minY + maxY) / 2) * scaleY),
      };
      const detectedRadius = clamp((((maxX - minX + 1) * scaleX) / 2), calibration.rimRadius * 0.82, calibration.rimRadius * 1.18);
      const shiftPx = getDistance(detectedCenter, calibration.rimCenter);
      const pixelCoverage = orangePixels / (SAMPLE_WIDTH * SAMPLE_HEIGHT);
      const confidence = Number((
        (1 - clamp(shiftPx / Math.max(1, calibration.rimRadius * 0.9), 0, 1)) * 0.6 +
        clamp(pixelCoverage / 0.08, 0, 1) * 0.4
      ).toFixed(2));

      if (shiftPx > calibration.rimRadius || confidence < 0.46) {
        return {
          calibration: null,
          confidence,
          orangePixels,
          shiftPx,
        };
      }

      lastUpdateAt = now;
      return {
        calibration: {
          ...calibration,
          rimCenter: {
            x: (calibration.rimCenter.x * 0.72) + (detectedCenter.x * 0.28),
            y: (calibration.rimCenter.y * 0.72) + (detectedCenter.y * 0.28),
          },
          rimRadius: (calibration.rimRadius * 0.8) + (detectedRadius * 0.2),
          videoWidth,
          videoHeight,
        },
        confidence,
        orangePixels,
        shiftPx: Number(shiftPx.toFixed(1)),
      };
    },
  };
}