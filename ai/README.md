# AI Assets

This folder keeps basketball shot-tracking assets grouped with the app instead of leaving them at the repo root.

## Structure

1. `reference-python-detector/`
   Legacy YOLO/OpenCV prototype, training config, weights, and sample video kept for reference.

## Live app code

The production path used by the React app lives outside this folder:

1. `src/lib/ballDetector.js` for browser ball detection
2. `src/lib/shotTracker.js` for make/miss event tracking
3. `src/lib/rimCalibration.js` for hoop calibration
4. `src/hooks/useAutoShotMode.js` for camera and inference orchestration

Use the browser path if you want to run the feature in the app. Use the Python reference only if you want to inspect or retrain the older prototype.