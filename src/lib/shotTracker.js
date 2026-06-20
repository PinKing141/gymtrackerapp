const MAX_HISTORY = 20;
const SAMPLE_EXPIRY_MS = 2200;
const SHOT_COOLDOWN_MS = 1400;
const MIN_TRACKING_SAMPLES = 6;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getDistance(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function getAverageRadius(samples) {
  if (!samples.length) return 0;
  const totalRadius = samples.reduce((sum, sample) => sum + sample.radius, 0);
  return totalRadius / samples.length;
}

function getVerticalVelocity(samples) {
  if (samples.length < 2) return 0;

  const latest = samples[samples.length - 1];
  const baseline = samples[Math.max(0, samples.length - 4)];
  const deltaTime = latest.timestamp - baseline.timestamp;

  if (deltaTime <= 0) return 0;
  return (latest.y - baseline.y) / deltaTime;
}

function getCrossingPoint(samples, rimY) {
  for (let index = samples.length - 1; index > 0; index -= 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    const crossedPlane = previous.y <= rimY && current.y >= rimY;

    if (!crossedPlane) continue;

    const deltaY = current.y - previous.y;
    if (Math.abs(deltaY) < 0.001) {
      return {
        x: current.x,
        y: rimY,
        timestamp: current.timestamp,
      };
    }

    const progress = clamp((rimY - previous.y) / deltaY, 0, 1);
    return {
      x: previous.x + (current.x - previous.x) * progress,
      y: rimY,
      timestamp: previous.timestamp + (current.timestamp - previous.timestamp) * progress,
    };
  }

  return null;
}

function getNearestApproach(samples, rimCenter) {
  return samples.reduce((best, sample) => {
    const distance = getDistance(sample, rimCenter);
    if (!best || distance < best.distance) {
      return { distance, sample };
    }
    return best;
  }, null);
}

function getConfidence({ crossingPoint, nearestApproach, rimRadius, averageRadius }) {
  const horizontalOffset = Math.abs(crossingPoint.x - nearestApproach.rimCenter.x);
  const horizontalScore = 1 - clamp(horizontalOffset / (rimRadius * 1.35), 0, 1);
  const approachScore = 1 - clamp(nearestApproach.distance / (rimRadius * 2.2), 0, 1);
  const sizeScore = clamp(averageRadius / Math.max(1, rimRadius * 0.35), 0.3, 1);

  return Number(((horizontalScore * 0.45) + (approachScore * 0.4) + (sizeScore * 0.15)).toFixed(2));
}

function isValidRim(rim) {
  return (
    rim &&
    typeof rim.rimCenter?.x === "number" &&
    typeof rim.rimCenter?.y === "number" &&
    typeof rim.rimRadius === "number" &&
    rim.rimRadius > 0
  );
}

export function createShotTracker() {
  const state = {
    samples: [],
    phase: "idle",
    upDetectedAt: 0,
    lastShotAt: 0,
    lastOutcome: null,
  };

  function resetAttempt() {
    state.phase = "idle";
    state.upDetectedAt = 0;
  }

  function trimSamples(now) {
    while (state.samples.length && now - state.samples[0].timestamp > SAMPLE_EXPIRY_MS) {
      state.samples.shift();
    }

    while (state.samples.length > MAX_HISTORY) {
      state.samples.shift();
    }
  }

  return {
    reset() {
      state.samples = [];
      state.phase = "idle";
      state.upDetectedAt = 0;
      state.lastOutcome = null;
    },

    getSnapshot() {
      return {
        phase: state.phase,
        sampleCount: state.samples.length,
        lastOutcome: state.lastOutcome,
        lastShotAt: state.lastShotAt,
      };
    },

    update(ball, rimCalibration) {
      const now = ball?.timestamp || Date.now();

      if (!ball || !isValidRim(rimCalibration)) {
        trimSamples(now);
        return null;
      }

      trimSamples(now);
      state.samples.push({
        x: ball.center.x,
        y: ball.center.y,
        radius: ball.radius,
        score: ball.score,
        timestamp: ball.timestamp || now,
      });

      if (state.samples.length < MIN_TRACKING_SAMPLES) {
        return null;
      }

      const rimCenter = rimCalibration.rimCenter;
      const rimRadius = rimCalibration.rimRadius;
      const latest = state.samples[state.samples.length - 1];
      const verticalVelocity = getVerticalVelocity(state.samples);

      const inUpWindow = (
        latest.x > rimCenter.x - (rimRadius * 4) &&
        latest.x < rimCenter.x + (rimRadius * 4) &&
        latest.y > rimCenter.y - (rimRadius * 4.4) &&
        latest.y < rimCenter.y - (rimRadius * 0.7)
      );

      if (state.phase === "idle" && inUpWindow && verticalVelocity < -0.02) {
        state.phase = "armed";
        state.upDetectedAt = latest.timestamp;
        return null;
      }

      if (state.phase !== "armed") {
        return null;
      }

      const isBelowRim = latest.y > rimCenter.y + (rimRadius * 1.05);
      if (!isBelowRim || verticalVelocity < 0.015) {
        if (latest.timestamp - state.upDetectedAt > SAMPLE_EXPIRY_MS) {
          resetAttempt();
        }
        return null;
      }

      if (latest.timestamp - state.lastShotAt < SHOT_COOLDOWN_MS) {
        return null;
      }

      const crossingPoint = getCrossingPoint(state.samples, rimCenter.y);
      const nearestApproach = getNearestApproach(state.samples, rimCenter);

      if (!crossingPoint || !nearestApproach) {
        resetAttempt();
        return null;
      }

      const nearestWithCenter = {
        ...nearestApproach,
        rimCenter,
      };
      const averageRadius = getAverageRadius(state.samples);
      const horizontalOffset = Math.abs(crossingPoint.x - rimCenter.x);
      const makeWindow = rimRadius * 0.95;
      const softWindow = rimRadius * 1.25;
      const isMake = horizontalOffset <= makeWindow || (
        horizontalOffset <= softWindow && nearestApproach.distance <= rimRadius * 1.15
      );

      const event = {
        result: isMake ? "make" : "miss",
        confidence: getConfidence({
          crossingPoint,
          nearestApproach: nearestWithCenter,
          rimRadius,
          averageRadius,
        }),
        timestamp: latest.timestamp,
        details: {
          crossingX: Math.round(crossingPoint.x),
          rimX: Math.round(rimCenter.x),
          nearestDistance: Math.round(nearestApproach.distance),
          averageRadius: Number(averageRadius.toFixed(1)),
        },
      };

      state.lastShotAt = latest.timestamp;
      state.lastOutcome = event;
      state.samples = state.samples.slice(-6);
      resetAttempt();
      return event;
    },
  };
}