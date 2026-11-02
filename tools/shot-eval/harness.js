// Browser side of the shot-tracking evaluation. run.mjs loads this page in
// headless Chromium and calls window.runEvaluation(), which replays a video
// frame by frame through the app's own detection pipeline.
import { createShotPipeline } from "/src/lib/shotPipeline.js";

// The detectors read Date.now() for throttling and timestamps. Pin it to the
// video's timeline so a replay behaves like a live camera at the same pace,
// however long each inference actually takes on this machine.
const realNow = Date.now.bind(Date);
let virtualNow = null;
Date.now = () => (virtualNow ?? realNow());

const CLOCK_ORIGIN = 1_700_000_000_000;

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function once(target, event) {
  return new Promise((resolve, reject) => {
    target.addEventListener(event, resolve, { once: true });
    target.addEventListener("error", () => reject(new Error(`video ${event} failed`)), { once: true });
  });
}

async function seek(video, time) {
  const seeked = once(video, "seeked");
  video.currentTime = time;
  await seeked;
}

window.runEvaluation = async function runEvaluation({
  videoUrl,
  stepMs = 140,
  settings = {},
  detectorConfig = null,
  calibration = null,
  // [{ from, to, rimCenter, rimRadius }]: re-lock the rim when the camera
  // moved, the way a user recalibrates after moving the phone.
  rimSegments = null,
  startAt = 0,
  endAt = null,
}) {
  const video = document.querySelector("video");
  const loaded = once(video, "loadeddata");
  video.src = videoUrl;
  await loaded;

  const pipeline = createShotPipeline({ settings });
  if (detectorConfig) pipeline.detector.setConfig(detectorConfig);

  const loadStartedAt = performance.now();
  const { backend } = await pipeline.detector.init();
  const modelLoadMs = Math.round(performance.now() - loadStartedAt);

  const withSize = (rim) => ({ rimCenter: rim.rimCenter, rimRadius: rim.rimRadius, videoWidth: video.videoWidth, videoHeight: video.videoHeight });
  if (calibration) {
    pipeline.setCalibration(withSize(calibration));
  }
  let activeSegment = null;

  const end = Math.min(endAt ?? video.duration, video.duration);
  const samples = [];
  for (let t = startAt; t < end; t += stepMs / 1000) {
    await seek(video, t);
    virtualNow = CLOCK_ORIGIN + Math.round(t * 1000);
    const segment = rimSegments?.find((item) => t >= item.from && t < item.to) || null;
    if (segment && segment !== activeSegment) {
      activeSegment = segment;
      pipeline.setCalibration(withSize(segment));
    }
    const frame = await pipeline.processFrame(video);
    const ball = frame.detection?.ball;
    samples.push({
      t: round(t, 3),
      inferenceMs: frame.detection?.inferenceMs ?? null,
      ball: ball ? { x: round(ball.center.x), y: round(ball.center.y), r: round(ball.radius), score: round(ball.score, 2) } : null,
      rim: frame.calibration
        ? { x: round(frame.calibration.rimCenter.x), y: round(frame.calibration.rimCenter.y), r: round(frame.calibration.rimRadius) }
        : null,
      rimStatus: frame.rimState.status,
      relockStatus: frame.relockState.status,
      phase: frame.trackerSnapshot.phase,
      shot: frame.shotEvent
        ? {
          result: frame.shotEvent.result,
          confidence: frame.shotEvent.confidence,
          suppressed: frame.shotEvent.suppressed,
          details: frame.shotEvent.details,
        }
        : null,
    });
  }
  virtualNow = null;

  return {
    backend,
    modelLoadMs,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    duration: video.duration,
    samples,
  };
};

window.harnessReady = true;
