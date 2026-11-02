import { createBallDetector } from "./ballDetector.js";
import { createRimDetector } from "./rimDetector.js";
import { createRimRelock } from "./rimRelock.js";
import { scaleCalibration } from "./rimCalibration.js";
import { createRimZoneBallFinder } from "./rimZoneBallFinder.js";
import { createShotTracker } from "./shotTracker.js";

// Below this relock confidence, hybrid mode goes back to searching for the rim.
const RELOCK_SEARCH_CONFIDENCE = 0.34;

export const DEFAULT_PIPELINE_SETTINGS = Object.freeze({
  // "manual" (only a saved calibration), "auto" (keep finding the rim from
  // the camera) or "hybrid" (use the calibration, search again if it's lost).
  rimDetectionMode: "manual",
  autoRelockEnabled: true,
  // Shots below this confidence are reported but not logged.
  minShotConfidence: 0.64,
  // Once the rim is known, look for the ball in a square around it rather
  // than the whole frame (see getBallSearchRegion).
  ballSearchAroundRim: true,
  // Fall back to the motion + colour finder near the rim when the object
  // detector doesn't see the ball (see rimZoneBallFinder.js).
  rimZoneFinder: true,
  // Keep running the object detector (COCO-SSD) once the rim is locked. Off by
  // default: on the evaluation video it never found the ball at shooting
  // distance, and it costs ~100x more per frame than the rim-zone finder.
  objectDetectorWithRim: false,
  // Frame interval once the rim is locked and only the finder runs. Shots are
  // fast; at ~7 fps a third of them were lost, at ~30 fps almost none.
  rimLockedIntervalMs: 33,
});

// Square area around the hoop to search for the ball once the rim is known,
// sized from the rim so it covers the last part of the shot arc and the drop
// below the net. Measured in rim radii.
export const BALL_SEARCH_REGION = Object.freeze({ size: 12, above: 0.62 });

// The rim and net shake after a make and look like a moving ball. Ignore
// finder hits centred on the rim ring itself (the ball is mostly hidden by
// the rim there anyway). Measured in rim radii.
export function isOnRimRing(ball, calibration) {
  const dx = Math.abs(ball.center.x - calibration.rimCenter.x);
  const dy = ball.center.y - calibration.rimCenter.y;
  return dx <= calibration.rimRadius * 1.2 && Math.abs(dy) <= calibration.rimRadius * 0.5;
}

export function getBallSearchRegion(calibration, frameWidth, frameHeight) {
  if (!calibration?.rimRadius || !frameWidth || !frameHeight) return null;
  const size = Math.min(calibration.rimRadius * BALL_SEARCH_REGION.size, frameWidth, frameHeight);
  // Searching nearly the whole frame anyway: skip the crop.
  if (size >= Math.min(frameWidth, frameHeight) * 0.95) return null;
  return {
    x: calibration.rimCenter.x - size / 2,
    y: calibration.rimCenter.y - size * BALL_SEARCH_REGION.above,
    size,
  };
}

function initialRimState(calibration) {
  return calibration
    ? { status: "manual", confidence: 1, mode: "manual", candidateCount: 0 }
    : { status: "searching", confidence: 0, mode: "auto", candidateCount: 0 };
}

function initialRelockState(enabled) {
  return { enabled, confidence: 0, shiftPx: 0, status: enabled ? "idle" : "disabled" };
}

/**
 * One frame of auto shot tracking: find the ball, keep the rim locked, and
 * turn the ball's path into make/miss events. This is plain JS (no React) so
 * the live camera hook and the offline evaluation harness run the same code.
 *
 * Time comes from Date.now() inside the detectors, so a harness can replay a
 * recorded video by stubbing the clock to the video's timeline.
 */
export function createShotPipeline({
  detector = createBallDetector(),
  rimDetector = createRimDetector(),
  rimRelock = createRimRelock(),
  tracker = createShotTracker(),
  ballFinder = createRimZoneBallFinder(),
  settings: initialSettings = {},
} = {}) {
  const settings = { ...DEFAULT_PIPELINE_SETTINGS, ...initialSettings };
  let calibration = null;
  let rimState = initialRimState(null);
  let relockState = initialRelockState(settings.autoRelockEnabled);
  let lastBall = null;

  function shouldSearchForRim(scaledCalibration) {
    const mode = settings.rimDetectionMode;
    if (mode === "manual") return false;
    // Auto keeps re-checking (the rim detector throttles itself), so a phone
    // that gets nudged between shots still finds the hoop again.
    if (mode === "auto" || !scaledCalibration) return true;
    // Hybrid: only look again once the relock has clearly lost the rim.
    return relockState.status === "searching" && relockState.confidence < RELOCK_SEARCH_CONFIDENCE;
  }

  return {
    detector,
    tracker,

    get settings() {
      return { ...settings };
    },

    get calibration() {
      return calibration;
    },

    get rimState() {
      return rimState;
    },

    get relockState() {
      return relockState;
    },

    // True when frames can be processed before the object detector has loaded.
    get canRunWithoutDetector() {
      return Boolean(calibration) && settings.objectDetectorWithRim === false;
    },

    // How long to wait between frames: fast once the cheap finder takes over.
    getFrameInterval(defaultMs) {
      return calibration && settings.objectDetectorWithRim === false
        ? Math.min(defaultMs, settings.rimLockedIntervalMs)
        : defaultMs;
    },

    configure(nextSettings = {}) {
      Object.assign(settings, nextSettings);
      if ("autoRelockEnabled" in nextSettings) {
        const enabled = nextSettings.autoRelockEnabled !== false;
        relockState = { ...relockState, enabled, status: enabled ? relockState.status : "disabled" };
      }
    },

    // A new calibration from outside (manual lock or a saved one). A big jump
    // means a different hoop or camera angle, so the shot in progress is dropped.
    setCalibration(nextCalibration, { hardReset = true } = {}) {
      calibration = nextCalibration;
      rimState = initialRimState(nextCalibration);
      if (hardReset) {
        rimDetector.reset();
        tracker.reset();
      }
    },

    reset() {
      detector.reset();
      ballFinder.reset();
      lastBall = null;
      rimDetector.reset();
      rimRelock.reset();
      tracker.reset();
      rimState = initialRimState(calibration);
      relockState = initialRelockState(settings.autoRelockEnabled);
    },

    /**
     * Run detection on the current video frame.
     * @returns {Promise<{
     *   detection: object|null,
     *   calibration: object|null,
     *   calibrationUpdates: Array<{ calibration: object, meta: object }>,
     *   shotEvent: object|null,
     *   trackerSnapshot: object,
     *   rimState: object,
     *   relockState: object,
     * }>}
     */
    async processFrame(video) {
      const width = video.videoWidth || video.clientWidth || 0;
      const height = video.videoHeight || video.clientHeight || 0;
      const calibrationUpdates = [];
      let scaledCalibration = calibration ? scaleCalibration(calibration, width, height) : null;
      const searchRegion = getBallSearchRegion(scaledCalibration, width, height);
      const skipObjectDetector = !detector.ready || (Boolean(searchRegion) && settings.objectDetectorWithRim === false);
      const startedAt = performance.now();
      let detection = skipObjectDetector
        ? { ball: null, predictions: [], inferenceMs: 0, timestamp: Date.now(), region: searchRegion }
        : await detector.detect(video, { region: settings.ballSearchAroundRim === false ? null : searchRegion });
      // The finder compares against the previous frame, so feed it every frame.
      const foundNearRim = settings.rimZoneFinder === false || !searchRegion
        ? null
        : ballFinder.find(video, searchRegion, scaledCalibration.rimRadius, lastBall);
      if (!detection?.ball && foundNearRim && !isOnRimRing(foundNearRim, scaledCalibration)) {
        detection = { ...(detection || {}), ball: foundNearRim };
      }
      if (skipObjectDetector) {
        detection.inferenceMs = Math.round(performance.now() - startedAt);
      }
      lastBall = detection?.ball || null;

      if (shouldSearchForRim(scaledCalibration)) {
        const rimDetection = rimDetector.detect(video);
        if (rimDetection?.calibration) {
          calibration = rimDetection.calibration;
          scaledCalibration = rimDetection.calibration;
          rimState = {
            status: "locked",
            confidence: rimDetection.confidence,
            mode: "auto",
            candidateCount: rimDetection.candidateCount || 0,
          };
          calibrationUpdates.push({
            calibration: rimDetection.calibration,
            meta: { confidence: rimDetection.confidence, source: "auto-detect" },
          });
        } else if (rimDetection) {
          rimState = {
            status: rimDetection.status || "searching",
            confidence: rimDetection.confidence || 0,
            mode: "auto",
            candidateCount: rimDetection.candidateCount || 0,
          };
        }
      } else if (relockState.status === "locked") {
        rimState = { status: "locked", confidence: relockState.confidence, mode: "relock", candidateCount: 0 };
      } else if (settings.rimDetectionMode === "manual") {
        rimState = { status: "manual", confidence: scaledCalibration ? 1 : 0, mode: "manual", candidateCount: 0 };
      } else if (rimState.status !== "locked") {
        rimState = { status: "idle", confidence: scaledCalibration ? 1 : 0, mode: "idle", candidateCount: 0 };
      }

      if (settings.autoRelockEnabled && scaledCalibration) {
        const relockResult = rimRelock.update(video, scaledCalibration);
        if (relockResult?.calibration) {
          calibration = relockResult.calibration;
          relockState = {
            enabled: true,
            confidence: relockResult.confidence,
            shiftPx: relockResult.shiftPx || 0,
            status: "locked",
          };
          calibrationUpdates.push({
            calibration: relockResult.calibration,
            meta: {
              confidence: relockResult.confidence,
              shiftPx: relockResult.shiftPx,
              orangePixels: relockResult.orangePixels,
              source: "relock",
            },
          });
        } else if (relockResult) {
          relockState = {
            enabled: true,
            confidence: relockResult.confidence || 0,
            shiftPx: relockResult.shiftPx || 0,
            status: "searching",
          };
        }
      }

      const rawEvent = tracker.update(detection?.ball, scaledCalibration);
      const shotEvent = rawEvent
        ? { ...rawEvent, source: "auto", suppressed: rawEvent.confidence < settings.minShotConfidence }
        : null;

      return {
        detection,
        calibration: scaledCalibration,
        calibrationUpdates,
        shotEvent,
        trackerSnapshot: tracker.getSnapshot(),
        rimState,
        relockState,
      };
    },
  };
}
