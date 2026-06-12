const BALL_CLASS = "sports ball";
const DEFAULT_MIN_SCORE = 0.45;
const SMOOTHING_WINDOW = 5;

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

  return {
    get ready() {
      return Boolean(model);
    },

    get backend() {
      return backend;
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

      const startedAt = performance.now();
      const predictions = await model.detect(videoElement, 10, minScore);
      const inferenceMs = Math.round(performance.now() - startedAt);
      const bestBall = predictions
        .filter((prediction) => prediction.class === BALL_CLASS)
        .sort((left, right) => right.score - left.score)[0];

      if (!bestBall) {
        history.length = 0;
        return { ball: null, predictions, inferenceMs, timestamp: Date.now() };
      }

      const ball = smoothDetection(toBallDetection(bestBall, inferenceMs), history);
      return { ball, predictions, inferenceMs, timestamp: Date.now() };
    },

    reset() {
      history.length = 0;
    },
  };
}
