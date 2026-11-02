# AI Assets

This folder keeps basketball shot-tracking assets grouped with the app instead of leaving them at the repo root.

## Structure

1. `reference-python-detector/`
   Legacy YOLO/OpenCV prototype and training config, kept for reference.

The prototype's weights (`best.pt`, 6 MB) and test video (`video_test_5.mp4`,
33 MB) are no longer committed. Download them when you need them:

```bash
npm run fetch:assets -- ai
```

The weights come from
[avishah3/AI-Basketball-Shot-Detector-Tracker](https://github.com/avishah3/AI-Basketball-Shot-Detector-Tracker),
which has no licence, and were trained with Ultralytics YOLOv8 (AGPL-3.0).
Use them for local experiments only; don't ship them in the app.

## Live app code

The production path used by the React app lives outside this folder:

1. `src/lib/shotPipeline.js` for the per-frame flow (ball, rim, shot), shared with the evaluation harness
2. `src/lib/rimZoneBallFinder.js` for finding the ball near a locked rim (no model)
3. `src/lib/ballDetector.js` for COCO-SSD detection (used before the rim is locked)
4. `src/lib/shotTracker.js` for make/miss event tracking
5. `src/lib/rimCalibration.js` for hoop calibration
6. `src/hooks/useAutoShotMode.js` for camera and UI wiring

To measure changes against a labelled clip, see `tools/shot-eval/README.md`.

Use the browser path if you want to run the feature in the app. Use the Python reference only if you want to inspect or retrain the older prototype.