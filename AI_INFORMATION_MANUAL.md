# AI Shot Tracking Information Manual

This document explains how the basketball Auto Mode works internally, what the AI is actually doing, what it is not doing yet, and how to interpret the system while testing.

## Purpose

The Auto Mode system is designed to:

1. read the phone camera feed,
2. detect the basketball in the frame,
3. track the ball near the hoop,
4. classify the shot as a make or miss,
5. log the result into the active basketball workout.

It is a browser-based AI-assisted tracking system, not a cloud AI service.

## What Counts As "AI" In This App

The current system uses a mix of model inference and rules.

### Model-based parts

1. TensorFlow.js runs in the browser.
2. COCO-SSD is used to detect objects labeled as `sports ball`.
3. The detector runs directly on the video stream.

### Heuristic parts

1. Ball detections are filtered using basketball-specific rules.
2. Rim calibration is manual first, with optional hybrid re-lock.
3. Make/miss decisions are based on motion and rim-relative geometry.

So the system is not fully end-to-end machine learning yet. It is a hybrid AI + rules pipeline.

## Current Architecture

The live browser path is:

1. `src/screens/AutoShotMode.jsx`
2. `src/hooks/useAutoShotMode.js`
3. `src/lib/ballDetector.js`
4. `src/lib/rimCalibration.js`
5. `src/lib/rimRelock.js`
6. `src/lib/shotTracker.js`

The older Python reference prototype lives in:

1. `ai/reference-python-detector/`

## Detection Pipeline

### 1. Camera capture

The app requests the rear phone camera using `getUserMedia()`.

### 2. Ball detection

The AI model finds `sports ball` objects.

The app then applies additional basketball-specific filters:

1. confidence threshold,
2. size relative to frame,
3. roundness / aspect ratio,
4. orange-color bias,
5. motion continuity from recent frames.

These filters reduce false positives from unrelated round objects.

### 3. Rim reference

The hoop is not fully auto-detected from scratch yet.

Current rim flow:

1. user manually calibrates the rim,
2. the app stores rim center and radius,
3. optional hybrid re-lock nudges that saved rim position after small camera drift.

### 4. Shot tracking

The tracker stores recent ball samples and watches for:

1. upward motion into the shot zone,
2. downward crossing near the rim,
3. path geometry that suggests make or miss.

### 5. Shot logging

When a shot event is strong enough, the app sends the result into the same `recordShot()` path used by manual input.

## Files And Responsibilities

### `src/lib/ballDetector.js`

Responsible for:

1. loading TensorFlow.js and COCO-SSD,
2. running inference,
3. post-filtering candidates,
4. smoothing ball detections,
5. exposing detector debug information.

### `src/lib/rimCalibration.js`

Responsible for:

1. saving rim calibration,
2. loading rim calibration,
3. scaling calibration to current video size,
4. drawing the rim overlay.

### `src/lib/rimRelock.js`

Responsible for:

1. searching near the saved hoop location,
2. using orange rim pixels to correct small drift,
3. returning a refined rim position with confidence.

This is a hybrid assist, not full hoop detection.

### `src/lib/shotTracker.js`

Responsible for:

1. storing recent ball positions,
2. tracking a shot attempt state,
3. estimating whether the shot was a make or miss,
4. returning confidence for the event.

### `src/hooks/useAutoShotMode.js`

Responsible for:

1. coordinating the camera,
2. running the detector at intervals,
3. drawing overlays,
4. running hybrid rim re-lock,
5. collecting QA metrics,
6. suppressing low-confidence shot logs.

### `src/screens/AutoShotMode.jsx`

Responsible for:

1. the user-facing Auto Mode UI,
2. detector tuning controls,
3. rim calibration entry points,
4. QA report export,
5. displaying tracker and logging status.

## Current User Controls

The app currently exposes these controls in Auto Mode:

1. camera start/stop,
2. confidence threshold for detector locks,
3. shot log threshold for auto-logged make/miss events,
4. rim calibration,
5. hybrid rim re-lock toggle,
6. QA report export.

## QA Metrics

The built-in QA panel tracks:

1. average FPS,
2. average inference time,
3. ball lock rate,
4. logged shots,
5. suppressed shots,
6. rim re-lock count,
7. test duration.

The exported JSON report is intended for real phone testing and threshold tuning.

## What The System Does Well Right Now

1. runs fully in-browser,
2. supports manual rim calibration,
3. supports live ball overlays,
4. logs make/miss events into the existing workout flow,
5. gives phone QA data without extra tooling,
6. allows confidence tuning for detection and logging.

## Current Limitations

1. No full automatic rim detection from a cold start.
2. Make/miss logic is still heuristic-based.
3. Performance and accuracy still depend heavily on lighting and framing.
4. Zone auto-detection is not implemented.
5. Shot type classification is not implemented.
6. Long-session performance still needs broader real-device validation.

## Difference Between Manual Calibration, Re-Lock, And Full Rim Detection

### Manual calibration

The user marks the rim.

### Hybrid re-lock

The app uses the saved rim and slightly corrects it after small camera drift.

### Full rim detection

The app would find the hoop automatically without any saved manual reference.

That third stage is not implemented yet.

## Recommended Testing Workflow

1. Calibrate the rim.
2. Start with stationary phone placement.
3. Test 10 to 15 shots from one spot.
4. Export a QA report.
5. Adjust detector and shot-log thresholds.
6. Repeat under different lighting conditions.

## Roadmap Status Summary

Current practical status:

1. Phase 0 is complete.
2. Phase 1 has a strong baseline implementation.
3. Phase 2 is complete as manual calibration.
4. Phase 3 has a baseline heuristic implementation.
5. Phase 4 integration is complete.
6. Phase 5 and Phase 6 are not complete.

## Related Documents

1. `AUTO_SHOT_INSTRUCTION_MANUAL.md` for end-user operation.
2. `SHOT_DETECTION_ROADMAP.md` for implementation status and future work.
