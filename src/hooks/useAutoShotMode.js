import { useCallback, useEffect, useRef, useState } from "react";
import { createBallDetector } from "../lib/ballDetector.js";
import { createRimDetector } from "../lib/rimDetector.js";
import { createRimRelock } from "../lib/rimRelock.js";
import { createShotTracker } from "../lib/shotTracker.js";
import { drawRimOverlay, scaleCalibration } from "../lib/rimCalibration.js";

const CAMERA_CONSTRAINTS = {
  audio: false,
  video: {
    facingMode: "environment",
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 60, min: 24 },
  },
};

const DEFAULT_DETECTION_INTERVAL_MS = 140;
const TRAIL_MAX_POINTS = 10;
const TRAIL_MAX_AGE_MS = 1200;
const DEFAULT_MIN_SHOT_CONFIDENCE = 0.64;
const BRIGHTNESS_SAMPLE_INTERVAL_MS = 850;

function getCameraErrorMessage(error) {
  if (!error) return "Camera unavailable.";
  if (error.name === "NotAllowedError") return "Camera permission was denied. Enable camera access to use Auto Mode.";
  if (error.name === "NotFoundError") return "No camera was found on this device.";
  if (error.name === "NotReadableError") return "The camera is already in use by another app.";
  return error.message || "Unable to start camera.";
}

function drawRoundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function drawBallOverlay(context, ball) {
  if (!ball) return;

  const { bbox, center, radius, score } = ball;
  context.lineWidth = 4;
  context.strokeStyle = "rgba(61, 220, 151, 0.96)";
  context.fillStyle = "rgba(61, 220, 151, 0.14)";
  drawRoundedRect(context, bbox.x, bbox.y, bbox.width, bbox.height, 12);
  context.fill();
  context.stroke();

  context.beginPath();
  context.arc(center.x, center.y, Math.max(5, radius * 0.18), 0, Math.PI * 2);
  context.fillStyle = "#3DDC97";
  context.fill();

  context.fillStyle = "rgba(4, 20, 13, 0.88)";
  drawRoundedRect(context, bbox.x, Math.max(8, bbox.y - 34), 128, 26, 8);
  context.fill();
  context.fillStyle = "#D9FFF0";
  context.font = "700 16px system-ui, sans-serif";
  context.fillText(`Ball ${Math.round(score * 100)}%`, bbox.x + 10, Math.max(27, bbox.y - 15));
}

function trimTrail(trail, now = Date.now()) {
  return trail
    .filter((point) => now - point.timestamp <= TRAIL_MAX_AGE_MS)
    .slice(-TRAIL_MAX_POINTS);
}

function drawBallTrail(context, trail) {
  if (!trail || trail.length < 2) return;

  for (let index = 1; index < trail.length; index += 1) {
    const previous = trail[index - 1];
    const current = trail[index];
    const alpha = index / trail.length;

    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(current.x, current.y);
    context.lineWidth = 2 + (alpha * 4);
    context.strokeStyle = `rgba(255, 159, 28, ${0.18 + (alpha * 0.5)})`;
    context.stroke();

    context.beginPath();
    context.arc(current.x, current.y, Math.max(2, current.radius * 0.12), 0, Math.PI * 2);
    context.fillStyle = `rgba(255, 214, 102, ${0.2 + (alpha * 0.55)})`;
    context.fill();
  }
}

function sampleFrameBrightness(videoElement, sampleCanvas) {
  const context = sampleCanvas.getContext("2d", { willReadFrequently: true });
  if (!context) return 0.5;

  sampleCanvas.width = 32;
  sampleCanvas.height = 24;
  context.drawImage(videoElement, 0, 0, videoElement.videoWidth, videoElement.videoHeight, 0, 0, 32, 24);
  const data = context.getImageData(0, 0, 32, 24).data;
  let total = 0;
  let count = 0;
  for (let index = 0; index < data.length; index += 4) {
    total += (0.2126 * data[index]) + (0.7152 * data[index + 1]) + (0.0722 * data[index + 2]);
    count += 1;
  }
  return count ? Number(((total / count) / 255).toFixed(2)) : 0.5;
}

function buildQaSnapshot(metrics) {
  const durationSec = metrics.startedAt ? Math.max(1, Math.round((Date.now() - metrics.startedAt) / 1000)) : 0;
  const avgFps = metrics.fpsSamples ? Math.round(metrics.fpsTotal / metrics.fpsSamples) : 0;
  const avgInferenceMs = metrics.inferenceSamples ? Math.round(metrics.inferenceTotal / metrics.inferenceSamples) : 0;
  return {
    durationSec,
    avgFps,
    avgInferenceMs,
    detectionCycles: metrics.detectionCycles,
    ballLocks: metrics.ballLocks,
    lockRate: metrics.detectionCycles ? Number((metrics.ballLocks / metrics.detectionCycles).toFixed(2)) : 0,
    loggedShots: metrics.loggedShots,
    suppressedShots: metrics.suppressedShots,
    relocks: metrics.relocks,
    lastRelockConfidence: metrics.lastRelockConfidence,
    autoRimLocks: metrics.autoRimLocks,
  };
}

/**
 * @param {{
 *   rimCalibration?: import('../lib/rimCalibration.js').RimCalibration | null,
 *   detectorConfig?: Record<string, number> | null,
 *   detectionIntervalMs?: number,
 *   rimDetectionMode?: 'auto' | 'hybrid' | 'manual',
 *   autoRelockEnabled?: boolean,
 *   minShotConfidence?: number,
 *   onRimCalibrationUpdate?: ((calibration: import('../lib/rimCalibration.js').RimCalibration, info: { confidence: number, shiftPx?: number, orangePixels?: number, source?: 'auto-detect' | 'manual' | 'relock' }) => void) | null,
 *   onShotDetected?: ((event: { result: 'make' | 'miss', confidence: number, timestamp: number, details?: Record<string, number> }) => void) | null,
 * }} options
 */
export function useAutoShotMode({
  rimCalibration = null,
  detectorConfig = null,
  detectionIntervalMs = DEFAULT_DETECTION_INTERVAL_MS,
  rimDetectionMode = "hybrid",
  autoRelockEnabled = true,
  minShotConfidence = DEFAULT_MIN_SHOT_CONFIDENCE,
  onRimCalibrationUpdate = null,
  onShotDetected = null,
} = {}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const fpsSampleRef = useRef({ lastTime: 0, frames: 0 });
  const previousCalibrationRef = useRef(rimCalibration);
  const detectorRef = useRef(createBallDetector());
  const rimDetectorRef = useRef(createRimDetector());
  const rimRelockRef = useRef(createRimRelock());
  const trackerRef = useRef(createShotTracker());
  const detectionInFlightRef = useRef(false);
  const lastDetectionTimeRef = useRef(0);
  const latestDetectionRef = useRef(null);
  const trajectoryTrailRef = useRef([]);
  const brightnessCanvasRef = useRef(null);
  const lastBrightnessSampleAtRef = useRef(0);
  // Keep a ref so the animation loop always sees the latest calibration without needing to re-bind
  const rimCalibrationRef = useRef(rimCalibration);
  const onRimCalibrationUpdateRef = useRef(onRimCalibrationUpdate);
  const onShotDetectedRef = useRef(onShotDetected);
  const detectionIntervalRef = useRef(detectionIntervalMs);
  const autoRelockEnabledRef = useRef(autoRelockEnabled);
  const minShotConfidenceRef = useRef(minShotConfidence);
  const rimDetectionModeRef = useRef(rimDetectionMode);
  const relockStateRef = useRef({ enabled: autoRelockEnabled, confidence: 0, shiftPx: 0, status: "idle" });
  const qaMetricsRef = useRef({
    startedAt: 0,
    fpsSamples: 0,
    fpsTotal: 0,
    inferenceSamples: 0,
    inferenceTotal: 0,
    detectionCycles: 0,
    ballLocks: 0,
    loggedShots: 0,
    suppressedShots: 0,
    relocks: 0,
    lastRelockConfidence: 0,
    autoRimLocks: 0,
  });

  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [fps, setFps] = useState(0);
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [modelStatus, setModelStatus] = useState("idle");
  const [modelError, setModelError] = useState("");
  const [detection, setDetection] = useState(null);
  const [trackingState, setTrackingState] = useState({ phase: "idle", sampleCount: 0, lastOutcome: null, lastShotAt: 0 });
  const [lastShotEvent, setLastShotEvent] = useState(null);
  const [rimDetectionState, setRimDetectionState] = useState({ status: rimCalibration ? "manual" : "searching", confidence: rimCalibration ? 1 : 0, mode: rimCalibration ? "manual" : "auto", candidateCount: 0 });
  const [relockState, setRelockState] = useState({ enabled: autoRelockEnabled, confidence: 0, shiftPx: 0, status: "idle" });
  const [sceneState, setSceneState] = useState({ brightness: 0.5 });
  const [qaMetrics, setQaMetrics] = useState(buildQaSnapshot(qaMetricsRef.current));

  // Keep ref in sync
  useEffect(() => {
    const previousCalibration = previousCalibrationRef.current;
    rimCalibrationRef.current = rimCalibration;
    const shouldHardReset = !previousCalibration || !rimCalibration || (
      Math.abs((previousCalibration.rimCenter?.x || 0) - (rimCalibration.rimCenter?.x || 0)) > Math.max(previousCalibration?.rimRadius || 0, rimCalibration?.rimRadius || 0) * 0.75 ||
      Math.abs((previousCalibration.rimCenter?.y || 0) - (rimCalibration.rimCenter?.y || 0)) > Math.max(previousCalibration?.rimRadius || 0, rimCalibration?.rimRadius || 0) * 0.5 ||
      Math.abs((previousCalibration?.rimRadius || 0) - (rimCalibration?.rimRadius || 0)) > Math.max(previousCalibration?.rimRadius || 0, rimCalibration?.rimRadius || 0) * 0.35
    );

    if (shouldHardReset) {
      rimDetectorRef.current.reset();
      trackerRef.current.reset();
      setTrackingState(trackerRef.current.getSnapshot());
      setLastShotEvent(null);
    }

    setRimDetectionState({ status: rimCalibration ? "manual" : "searching", confidence: rimCalibration ? 1 : 0, mode: rimCalibration ? "manual" : "auto", candidateCount: 0 });
    previousCalibrationRef.current = rimCalibration;
  }, [rimCalibration]);

  useEffect(() => {
    onShotDetectedRef.current = onShotDetected;
  }, [onShotDetected]);

  useEffect(() => {
    onRimCalibrationUpdateRef.current = onRimCalibrationUpdate;
  }, [onRimCalibrationUpdate]);

  useEffect(() => {
    detectorRef.current.setConfig(detectorConfig || {});
  }, [detectorConfig]);

  useEffect(() => {
    detectionIntervalRef.current = detectionIntervalMs;
  }, [detectionIntervalMs]);

  useEffect(() => {
    autoRelockEnabledRef.current = autoRelockEnabled;
  }, [autoRelockEnabled]);

  useEffect(() => {
    minShotConfidenceRef.current = minShotConfidence;
  }, [minShotConfidence]);

  useEffect(() => {
    rimDetectionModeRef.current = rimDetectionMode;
  }, [rimDetectionMode]);

  useEffect(() => {
    relockStateRef.current = relockState;
    setRelockState((current) => ({
      ...current,
      enabled: autoRelockEnabled,
      status: autoRelockEnabled ? current.status : "disabled",
    }));
  }, [autoRelockEnabled]);

  const initDetector = useCallback(async () => {
    if (detectorRef.current.ready || modelStatus === "loading" || modelStatus === "ready") return;

    setModelStatus("loading");
    setModelError("");

    try {
      await detectorRef.current.init();
      setModelStatus("ready");
    } catch (detectorError) {
      setModelStatus("error");
      setModelError(detectorError.message || "Unable to load the ball detection model.");
    }
  }, [modelStatus]);

  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    detectorRef.current.reset();
  rimDetectorRef.current.reset();
    rimRelockRef.current.reset();
    trackerRef.current.reset();
    detectionInFlightRef.current = false;
    lastDetectionTimeRef.current = 0;
    latestDetectionRef.current = null;
    trajectoryTrailRef.current = [];
    setDetection(null);
    setTrackingState(trackerRef.current.getSnapshot());
    setLastShotEvent(null);
    setRimDetectionState({ status: autoRelockEnabled ? "searching" : "idle", confidence: 0, mode: "auto", candidateCount: 0 });
    setRelockState({ enabled: autoRelockEnabled, confidence: 0, shiftPx: 0, status: autoRelockEnabled ? "idle" : "disabled" });
    setStatus("idle");
    setFps(0);
  }, []);

  const runDetection = useCallback((timestamp) => {
    const video = videoRef.current;
    const detector = detectorRef.current;
    if (!video || !detector.ready || detectionInFlightRef.current || timestamp - lastDetectionTimeRef.current < detectionIntervalRef.current) return;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

    detectionInFlightRef.current = true;
    lastDetectionTimeRef.current = timestamp;

    detector
      .detect(video)
      .then((result) => {
        latestDetectionRef.current = result;
        setDetection(result);
        qaMetricsRef.current.detectionCycles += 1;
        qaMetricsRef.current.inferenceSamples += 1;
        qaMetricsRef.current.inferenceTotal += result?.inferenceMs || 0;

        if (!brightnessCanvasRef.current && typeof document !== "undefined") {
          brightnessCanvasRef.current = document.createElement("canvas");
        }
        if (brightnessCanvasRef.current && Date.now() - lastBrightnessSampleAtRef.current > BRIGHTNESS_SAMPLE_INTERVAL_MS) {
          lastBrightnessSampleAtRef.current = Date.now();
          setSceneState({ brightness: sampleFrameBrightness(video, brightnessCanvasRef.current) });
        }

        const trail = trimTrail(trajectoryTrailRef.current, result?.timestamp || Date.now());
        if (result?.ball) {
          qaMetricsRef.current.ballLocks += 1;
          trail.push({
            x: result.ball.center.x,
            y: result.ball.center.y,
            radius: result.ball.radius,
            timestamp: result.ball.timestamp || result.timestamp || Date.now(),
          });
        }
        trajectoryTrailRef.current = trimTrail(trail, result?.timestamp || Date.now());

        let scaledCalibration = rimCalibrationRef.current
          ? scaleCalibration(rimCalibrationRef.current, video.videoWidth || video.clientWidth || 0, video.videoHeight || video.clientHeight || 0)
          : null;

        const currentRimDetectionMode = rimDetectionModeRef.current;
        const currentRelockState = relockStateRef.current;
        const shouldRunAutoRimSearch = currentRimDetectionMode !== "manual" && (
          currentRimDetectionMode === "auto"
            ? (!scaledCalibration || rimDetectionState.status !== "locked")
            : (!scaledCalibration || (currentRelockState.status === "searching" && currentRelockState.confidence < 0.34))
        );
        if (shouldRunAutoRimSearch) {
          const rimDetection = rimDetectorRef.current.detect(video);
          if (rimDetection?.calibration) {
            qaMetricsRef.current.autoRimLocks += 1;
            rimCalibrationRef.current = rimDetection.calibration;
            scaledCalibration = rimDetection.calibration;
            setRimDetectionState({
              status: "locked",
              confidence: rimDetection.confidence,
              mode: "auto",
              candidateCount: rimDetection.candidateCount || 0,
            });
            onRimCalibrationUpdateRef.current?.(rimDetection.calibration, {
              confidence: rimDetection.confidence,
              source: "auto-detect",
            });
          } else if (rimDetection) {
            setRimDetectionState({
              status: rimDetection.status || "searching",
              confidence: rimDetection.confidence || 0,
              mode: "auto",
              candidateCount: rimDetection.candidateCount || 0,
            });
          }
        } else {
          setRimDetectionState({
            status: relockState.status === "locked" ? "locked" : (rimDetectionMode === "manual" ? "manual" : "idle"),
            confidence: relockState.status === "locked" ? relockState.confidence : (scaledCalibration ? 1 : 0),
            mode: relockState.status === "locked" ? "relock" : (rimDetectionMode === "manual" ? "manual" : "idle"),
            candidateCount: 0,
          });
        }

        if (autoRelockEnabledRef.current && scaledCalibration) {
          const relockResult = rimRelockRef.current.update(video, scaledCalibration);
          if (relockResult?.calibration) {
            qaMetricsRef.current.relocks += 1;
            qaMetricsRef.current.lastRelockConfidence = relockResult.confidence;
            rimCalibrationRef.current = relockResult.calibration;
            setRelockState({
              enabled: true,
              confidence: relockResult.confidence,
              shiftPx: relockResult.shiftPx || 0,
              status: "locked",
            });
            onRimCalibrationUpdateRef.current?.(relockResult.calibration, {
              confidence: relockResult.confidence,
              shiftPx: relockResult.shiftPx,
              orangePixels: relockResult.orangePixels,
              source: "relock",
            });
          } else if (relockResult) {
            setRelockState({
              enabled: true,
              confidence: relockResult.confidence || 0,
              shiftPx: relockResult.shiftPx || 0,
              status: "searching",
            });
          }
        }

        const shotEvent = trackerRef.current.update(result?.ball, scaledCalibration);
        const trackerSnapshot = trackerRef.current.getSnapshot();
        setTrackingState(trackerSnapshot);

        if (shotEvent) {
          const resolvedEvent = {
            ...shotEvent,
            source: "auto",
            suppressed: shotEvent.confidence < minShotConfidenceRef.current,
          };
          setLastShotEvent(resolvedEvent);
          if (resolvedEvent.suppressed) {
            qaMetricsRef.current.suppressedShots += 1;
          } else {
            qaMetricsRef.current.loggedShots += 1;
            onShotDetectedRef.current?.(resolvedEvent);
          }
        }
      })
      .catch((detectorError) => {
        setModelStatus("error");
        setModelError(detectorError.message || "Ball detection failed.");
      })
      .finally(() => {
        detectionInFlightRef.current = false;
      });
  }, []);

  const drawOverlay = useCallback(
    (timestamp) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const width = video.videoWidth || canvas.clientWidth || 640;
      const height = video.videoHeight || canvas.clientHeight || 360;

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        setVideoSize({ width, height });
      }

      runDetection(timestamp);

      const context = canvas.getContext("2d");
      if (context) {
        context.clearRect(0, 0, width, height);

        trajectoryTrailRef.current = trimTrail(trajectoryTrailRef.current);

        // Draw recent ball motion first so the live ball marker stays on top.
        drawBallTrail(context, trajectoryTrailRef.current);

        // Draw ball bounding box
        drawBallOverlay(context, latestDetectionRef.current?.ball);

        // Draw rim calibration overlay
        const cal = rimCalibrationRef.current;
        if (cal) {
          const scaled = scaleCalibration(cal, width, height);
          if (scaled) {
            drawRimOverlay(context, scaled, { alpha: 0.9 });
          }
        } else {
          // Show hoop guide zone if not yet calibrated
          context.lineWidth = Math.max(2, width * 0.004);
          context.strokeStyle = "rgba(255, 159, 28, 0.95)";
          context.fillStyle = "rgba(255, 159, 28, 0.16)";

          const guideWidth = width * 0.38;
          const guideHeight = height * 0.28;
          const guideX = (width - guideWidth) / 2;
          const guideY = height * 0.12;
          drawRoundedRect(context, guideX, guideY, guideWidth, guideHeight, 18);
          context.fill();
          context.stroke();
        }

        // Status text
        const ball = latestDetectionRef.current?.ball;
        context.fillStyle = "rgba(255, 255, 255, 0.9)";
        context.font = `${Math.max(14, width * 0.026)}px system-ui, sans-serif`;
        context.fillText(
          cal ? "Rim locked · Phase 2 active" : "No rim calibration — tap Calibrate Rim",
          18,
          32,
        );
        context.fillText(
          ball ? `Ball locked @ (${Math.round(ball.center.x)}, ${Math.round(ball.center.y)})` : "Searching for basketball…",
          18,
          58,
        );
      }

      // FPS counter
      const sample = fpsSampleRef.current;
      sample.frames += 1;
      if (!sample.lastTime) sample.lastTime = timestamp;
      const elapsed = timestamp - sample.lastTime;
      if (elapsed >= 1000) {
        const currentFps = Math.round((sample.frames * 1000) / elapsed);
        setFps(currentFps);
        qaMetricsRef.current.fpsSamples += 1;
        qaMetricsRef.current.fpsTotal += currentFps;
        setQaMetrics(buildQaSnapshot(qaMetricsRef.current));
        sample.frames = 0;
        sample.lastTime = timestamp;
      }

      animationFrameRef.current = requestAnimationFrame(drawOverlay);
    },
    [runDetection],
  );

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not support camera access.");
      setStatus("error");
      return;
    }

    setStatus("requesting");
    setError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      streamRef.current = stream;
      qaMetricsRef.current = {
        startedAt: Date.now(),
        fpsSamples: 0,
        fpsTotal: 0,
        inferenceSamples: 0,
        inferenceTotal: 0,
        detectionCycles: 0,
        ballLocks: 0,
        loggedShots: 0,
        suppressedShots: 0,
        relocks: 0,
        lastRelockConfidence: 0,
        autoRimLocks: 0,
      };
      setQaMetrics(buildQaSnapshot(qaMetricsRef.current));

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setStatus("streaming");
      initDetector();
      animationFrameRef.current = requestAnimationFrame(drawOverlay);
    } catch (cameraError) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setError(getCameraErrorMessage(cameraError));
      setStatus("error");
    }
  }, [drawOverlay, initDetector]);

  useEffect(() => stopCamera, [stopCamera]);

  return {
    videoRef,
    canvasRef,
    status,
    error,
    fps,
    videoSize,
    modelStatus,
    modelError,
    detection,
    trackingState,
    lastShotEvent,
    rimDetectionState,
    relockState,
    sceneState,
    qaMetrics,
    startCamera,
    stopCamera,
    isStreaming: status === "streaming",
  };
}
