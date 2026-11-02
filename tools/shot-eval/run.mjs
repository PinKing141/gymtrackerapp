// Offline evaluation of auto shot tracking against a labelled video.
//
//   npm run eval:shots                                 # auto rim mode, indoor preset
//   npm run eval:shots -- --mode manual                # rim lock from the labels
//   npm run eval:shots -- --object-detector --step 140 # also run COCO-SSD near the rim
//   npm run eval:shots -- --json report.json           # also write every sample
//
// It replays the video through src/lib/shotPipeline.js (the code the app runs)
// in headless Chromium, then compares logged shots with the hand-checked labels
// in labels/. Needs ffmpeg and the reference video (`npm run fetch:assets -- ai`).
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { AUTO_SHOT_PRESETS } from "../../src/lib/autoShotPresets.js";
import { DEFAULT_PIPELINE_SETTINGS } from "../../src/lib/shotPipeline.js";
import { scoreRun } from "./score.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const cacheDir = path.join(here, ".cache");

const { values: args } = parseArgs({
  options: {
    labels: { type: "string", default: path.join(here, "labels/video_test_5.json") },
    mode: { type: "string", default: "auto" },
    preset: { type: "string", default: "indoor" },
    step: { type: "string" },
    "min-confidence": { type: "string" },
    // Keep running COCO-SSD once the rim is locked (the app doesn't by default).
    "object-detector": { type: "boolean", default: false },
    // Starting rim lock for manual/hybrid modes, as "x,y,radius" in video pixels.
    calibration: { type: "string" },
    start: { type: "string", default: "0" },
    end: { type: "string" },
    json: { type: "string" },
  },
});

const labels = JSON.parse(await readFile(args.labels, "utf8"));
const preset = AUTO_SHOT_PRESETS[args.preset]?.settings;
if (!preset) {
  throw new Error(`Unknown preset "${args.preset}". Use one of: ${Object.keys(AUTO_SHOT_PRESETS).filter((key) => key !== "auto").join(", ")}`);
}

const settings = {
  rimDetectionMode: args.mode,
  autoRelockEnabled: preset.autoRelockEnabled !== false,
  minShotConfidence: Number(args["min-confidence"] || preset.minShotConfidence),
  objectDetectorWithRim: args["object-detector"],
};
// Mirror the app: once the rim is locked it runs the finder every ~33 ms; with
// COCO-SSD on, it uses the preset's slower interval.
const stepMs = Number(args.step || (settings.objectDetectorWithRim ? preset.detectionIntervalMs : DEFAULT_PIPELINE_SETTINGS.rimLockedIntervalMs));
const calibration = args.calibration
  ? (([x, y, r]) => ({ rimCenter: { x, y }, rimRadius: r }))(args.calibration.split(",").map(Number))
  : null;
// Manual and hybrid modes need a rim lock to start from; use the labelled one
// for each camera position unless a fixed --calibration was given.
const rimSegments = settings.rimDetectionMode !== "auto" && !calibration ? labels.rimSegments || null : null;
const startAt = Number(args.start);
const endAt = args.end ? Number(args.end) : null;
const scoredLabels = {
  ...labels,
  shots: labels.shots.filter((shot) => shot.t >= startAt && (endAt === null || shot.t <= endAt)),
};

// Chromium builds used for testing can't decode H.264, so re-encode once to
// VP8 with frequent keyframes (fast, accurate seeking).
async function prepareVideo() {
  const source = path.join(repoRoot, labels.video);
  if (!existsSync(source)) {
    throw new Error(`Missing ${labels.video}. Run: npm run fetch:assets -- ai`);
  }
  await mkdir(cacheDir, { recursive: true });
  const target = path.join(cacheDir, `${path.basename(source, path.extname(source))}.webm`);
  if (!existsSync(target)) {
    console.log("Converting video for Chromium (one-off)...");
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", source, "-an", "-c:v", "libvpx", "-g", "10", "-crf", "6", "-b:v", "6M", target]);
  }
  return `/${path.relative(repoRoot, target).split(path.sep).join("/")}`;
}

// The COCO-SSD weights normally download from Google at runtime. Cache them
// on disk so repeat runs are fast and work offline.
async function serveModelFromCache(route) {
  const url = new URL(route.request().url());
  const file = path.join(cacheDir, "models", url.hostname, url.pathname);
  if (!existsSync(file)) {
    const response = await fetch(url);
    if (!response.ok) {
      await route.fulfill({ status: response.status });
      return;
    }
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, Buffer.from(await response.arrayBuffer()));
  }
  const body = await readFile(file);
  await route.fulfill({ status: 200, body, contentType: file.endsWith(".json") ? "application/json" : "application/octet-stream" });
}

const videoUrl = await prepareVideo();
const server = await createServer({ root: repoRoot, logLevel: "error", server: { port: 0, host: "127.0.0.1" } });
await server.listen();
const baseUrl = server.resolvedUrls.local[0];

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
  args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

try {
  const page = await browser.newPage();
  page.on("pageerror", (error) => console.error("page error:", error.message));
  await page.route("https://storage.googleapis.com/**", serveModelFromCache);
  await page.goto(`${baseUrl}tools/shot-eval/harness.html`);
  await page.waitForFunction(() => window.harnessReady === true);

  console.log(`Replaying ${labels.video} — mode=${settings.rimDetectionMode} preset=${args.preset} step=${stepMs}ms${settings.objectDetectorWithRim ? " +COCO-SSD near rim" : ""}`);
  const startedAt = Date.now();
  const run = await page.evaluate((options) => window.runEvaluation(options), {
    videoUrl,
    stepMs,
    settings,
    detectorConfig: preset,
    calibration,
    rimSegments,
    startAt,
    endAt,
  });
  const wallSeconds = Math.round((Date.now() - startedAt) / 1000);

  const report = scoreRun(run, scoredLabels, { stepMs, settings, preset: args.preset });
  printReport(report, run, wallSeconds);

  if (args.json) {
    await writeFile(args.json, JSON.stringify({ report, run }, null, 2));
    console.log(`\nWrote ${args.json}`);
  }
} finally {
  await browser.close();
  await server.close();
}

function printReport(report, run, wallSeconds) {
  const { shots, ball, rim, speed } = report;
  const pct = (value) => `${Math.round(value * 100)}%`;
  console.log(`\nBackend ${run.backend}, model load ${run.modelLoadMs} ms, ${run.samples.length} frames in ${wallSeconds}s`);
  console.log("\nShots");
  console.log(`  labelled          ${shots.labelled}`);
  console.log(`  found             ${shots.found} (${pct(shots.recall)})`);
  console.log(`  result correct    ${shots.correctResult} of ${shots.found}`);
  console.log(`  held back (low confidence) ${shots.suppressedMatches}`);
  console.log(`  false shots       ${shots.falseShots}`);
  console.log("\nBall");
  console.log(`  frames with a ball ${pct(ball.lockRate)}`);
  console.log(`  near-hoop frames with a ball ${pct(ball.nearShotLockRate)} (±1 s around labelled shots)`);
  console.log("\nRim");
  console.log(`  frames with a rim lock ${pct(rim.lockedRate)}`);
  if (rim.correctRate !== null) {
    console.log(`  frames with the rim in the right place ${pct(rim.correctRate)} (within one rim radius)`);
  }
  console.log("\nSpeed (this machine, not a phone)");
  console.log(`  inference mean ${speed.meanMs} ms, p95 ${speed.p95Ms} ms`);
  console.log("\nPer shot");
  report.perShot.forEach((row) => {
    const outcome = row.event
      ? `${row.event.result}${row.event.suppressed ? " (held back)" : ""} @${row.event.t.toFixed(2)}s conf ${row.event.confidence}`
      : "missed";
    console.log(`  ${row.label.t.toFixed(2).padStart(6)}s ${row.label.result.padEnd(5)} -> ${outcome}`);
  });
  report.unmatched.forEach((event) => {
    console.log(`  false: ${event.result}${event.suppressed ? " (held back)" : ""} @${event.t.toFixed(2)}s conf ${event.confidence}`);
  });
}
