const BALL_CLASS = "sports ball";
const DEFAULT_MIN_SCORE = 0.45;
const SMOOTHING_WINDOW = 5;
const COLOR_SAMPLE_SIZE = 24;
const DEFAULT_CONFIG = Object.freeze({
  minScore: 0.52,
  minDiameterRatio: 0.012,
  maxDiameterRatio: 0.34,
  maxAspectRatio: 1.45,
  orangeMinRatio: 0.04,
  continuityMinScore: 0.56,
  strongScoreBypass: 0.74,
  maxMotionPadding: 38,
  continuityRadiusMultiplier: 5.2,
  continuityTtlMs: 850,
});

async function loadTensorFlowRuntime() {
  const [cocoSsd, tf] = await Promise.all([
    import("@tensorflow-models/coco-ssd"),
    import("@tensorflow/tfjs"),
    import("@tensorflow/tfjs-backend-webgl"),
  ]);

  return { cocoSsd, tf };
}

function toBallDetection(prediction, inferenceMs) {
  const [x, y, width, height] = prediction.bbox;
  return {
    className: prediction.class,
    score: prediction.score,
    bbox: { x, y, width, height },
    center: { x: x + width / 2, y: y + height / 2 },
    radius: Math.max(width, height) / 2,
    inferenceMs,
    timestamp: Date.now(),
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getRelativeDiameter(prediction, frameWidth, frameHeight) {
  const [, , width, height] = prediction.bbox;
  const diameter = Math.max(width, height);
  const shortSide = Math.max(1, Math.min(frameWidth, frameHeight));
  return diameter / shortSide;
}

function getAspectRatio(prediction) {
  const [, , width, height] = prediction.bbox;
  const shortest = Math.max(1, Math.min(width, height));
  return Math.max(width, height) / shortest;
}

function getCenterDistance(prediction, previousBall) {
  if (!previousBall) return 0;
  const [x, y, width, height] = prediction.bbox;
  const centerX = x + (width / 2);
  const centerY = y + (height / 2);
  return Math.hypot(centerX - previousBall.center.x, centerY - previousBall.center.y);
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

function getOrangePixelRatio(videoElement, prediction, sampleCanvas) {
  const context = sampleCanvas.getContext("2d", { willReadFrequently: true });
  if (!context) return 0;

  const [x, y, width, height] = prediction.bbox;
  const sourceWidth = Math.max(1, Math.round(width));
  const sourceHeight = Math.max(1, Math.round(height));
  sampleCanvas.width = COLOR_SAMPLE_SIZE;
  sampleCanvas.height = COLOR_SAMPLE_SIZE;

  context.clearRect(0, 0, COLOR_SAMPLE_SIZE, COLOR_SAMPLE_SIZE);
  context.drawImage(
    videoElement,
    Math.max(0, x),
    Math.max(0, y),
    sourceWidth,
    sourceHeight,
    0,
    0,
    COLOR_SAMPLE_SIZE,
    COLOR_SAMPLE_SIZE,
  );

  const imageData = context.getImageData(0, 0, COLOR_SAMPLE_SIZE, COLOR_SAMPLE_SIZE).data;
  let warmPixels = 0;
  let sampledPixels = 0;

  for (let index = 0; index < imageData.length; index += 4) {
    const alpha = imageData[index + 3];
    if (alpha < 120) continue;

    const red = imageData[index];
    const green = imageData[index + 1];
    const blue = imageData[index + 2];
    const { hue, saturation, lightness } = toHsl(red, green, blue);

    sampledPixels += 1;
    const looksOrange = hue >= 15 && hue <= 52 && saturation >= 0.3 && lightness >= 0.18 && lightness <= 0.8;
    if (looksOrange) {
      warmPixels += 1;
    }
  }

  if (!sampledPixels) return 0;
  return warmPixels / sampledPixels;
}

function passesSizeAndShapeChecks(prediction, videoElement, config) {
  const relativeDiameter = getRelativeDiameter(prediction, videoElement.videoWidth, videoElement.videoHeight);
  const aspectRatio = getAspectRatio(prediction);
  return {
    relativeDiameter,
    aspectRatio,
    passes: (
      relativeDiameter >= config.minDiameterRatio &&
      relativeDiameter <= config.maxDiameterRatio &&
      aspectRatio <= config.maxAspectRatio
    ),
  };
}

function chooseBestBallCandidate(predictions, videoElement, previousBall, config, sampleCanvas) {
  const candidates = predictions
    .filter((prediction) => prediction.class === BALL_CLASS)
    .map((prediction) => {
      const sizeCheck = passesSizeAndShapeChecks(prediction, videoElement, config);
      if (!sizeCheck.passes) {
        return null;
      }

      const orangeRatio = getOrangePixelRatio(videoElement, prediction, sampleCanvas);
      const distanceFromPrevious = getCenterDistance(prediction, previousBall);
      const maxMotion = previousBall
        ? Math.max(48, (previousBall.radius * config.continuityRadiusMultiplier) + config.maxMotionPadding)
        : Infinity;
      const continuityOk = previousBall
        ? distanceFromPrevious <= maxMotion
        : false;
      const colorOk = orangeRatio >= config.orangeMinRatio;
      const scoreOk = prediction.score >= config.strongScoreBypass;
      const continuityScoreOk = previousBall && continuityOk && prediction.score >= config.continuityMinScore;

      if (!colorOk && !scoreOk && !continuityScoreOk) {
        return null;
      }

      const continuityScore = previousBall && Number.isFinite(maxMotion)
        ? 1 - clamp(distanceFromPrevious / maxMotion, 0, 1)
        : 0.45;
      const weightedScore = (prediction.score * 0.56) + (orangeRatio * 0.26) + (continuityScore * 0.18);

      return {
        prediction,
        orangeRatio,
        continuityOk,
        weightedScore,
        relativeDiameter: sizeCheck.relativeDiameter,
        aspectRatio: sizeCheck.aspectRatio,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.weightedScore - left.weightedScore);

  return candidates[0] || null;
}

function smoothDetection(detection, history) {
  if (!detection) return null;

  history.push(detection);
  if (history.length > SMOOTHING_WINDOW) {
    history.shift();
  }

  const totals = history.reduce(
    (accumulator, item) => ({
      x: accumulator.x + item.center.x,
      y: accumulator.y + item.center.y,
      radius: accumulator.radius + item.radius,
    }),
    { x: 0, y: 0, radius: 0 },
  );

  return {
    ...detection,
    center: {
      x: totals.x / history.length,
      y: totals.y / history.length,
    },
    radius: totals.radius / history.length,
    rawCenter: detection.center,
  };
}

export function createBallDetector({ minScore = DEFAULT_MIN_SCORE } = {}) {
  const history = [];
  let model = null;
  let backend = "unknown";
  let config = { ...DEFAULT_CONFIG, minScore: Math.max(DEFAULT_CONFIG.minScore, minScore) };
  let lastAcceptedBall = null;
  let sampleCanvas = null;

  return {
    get ready() {
      return Boolean(model);
    },

    get backend() {
      return backend;
    },

    get config() {
      return config;
    },

    setConfig(nextConfig = {}) {
      config = {
        ...config,
        ...nextConfig,
      };
    },

    async init() {
      if (model) return { backend };

      const { cocoSsd, tf } = await loadTensorFlowRuntime();

      try {
        await tf.setBackend("webgl");
      } catch (webGlError) {
        await tf.setBackend("cpu");
      }

      await tf.ready();
      backend = tf.getBackend();
      model = await cocoSsd.load({ base: "lite_mobilenet_v2" });
      return { backend };
    },

    async detect(videoElement) {
      if (!model || !videoElement) return null;

      if (!sampleCanvas && typeof document !== "undefined") {
        sampleCanvas = document.createElement("canvas");
      }

      const now = Date.now();
      if (lastAcceptedBall && now - lastAcceptedBall.timestamp > config.continuityTtlMs) {
        lastAcceptedBall = null;
      }

      const startedAt = performance.now();
      const predictions = await model.detect(videoElement, 10, config.minScore);
      const inferenceMs = Math.round(performance.now() - startedAt);
      const chosenCandidate = chooseBestBallCandidate(predictions, videoElement, lastAcceptedBall, config, sampleCanvas);
      const bestBall = chosenCandidate?.prediction || null;

      if (!bestBall) {
        history.length = 0;
        return {
          ball: null,
          predictions,
          inferenceMs,
          timestamp: now,
          debug: {
            candidateCount: predictions.filter((prediction) => prediction.class === BALL_CLASS).length,
            filterMode: "size-shape-color-continuity",
          },
        };
      }

      const ball = smoothDetection(toBallDetection(bestBall, inferenceMs), history);
      lastAcceptedBall = ball;
      return {
        ball,
        predictions,
        inferenceMs,
        timestamp: now,
        debug: {
          candidateCount: predictions.filter((prediction) => prediction.class === BALL_CLASS).length,
          orangeRatio: Number((chosenCandidate?.orangeRatio || 0).toFixed(2)),
          relativeDiameter: Number((chosenCandidate?.relativeDiameter || 0).toFixed(3)),
          aspectRatio: Number((chosenCandidate?.aspectRatio || 0).toFixed(2)),
          filterMode: "size-shape-color-continuity",
        },
      };
    },

    reset() {
      history.length = 0;
      lastAcceptedBall = null;
    },
  };
}
