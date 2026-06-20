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
4. `src/lib/rimDetector.js`
5. `src/lib/rimCalibration.js`
6. `src/lib/rimRelock.js`
7. `src/lib/shotTracker.js`
8. `src/lib/autoShotPresets.js`

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

The app now has two rim-entry paths:

1. automatic rim detection from the live frame,
2. manual calibration fallback.

Current rim flow:

1. the app tries to detect a stable hoop candidate automatically,
2. if a hoop is locked, that becomes the live rim reference,
3. if needed, the user can still calibrate the rim manually,
4. optional hybrid re-lock nudges the saved or detected rim position after small camera drift,
5. the user can force manual-only behavior through the Rim Source setting.

### 4. Shot tracking

The tracker stores recent ball samples and watches for:

1. upward motion into the shot zone,
2. downward crossing near the rim,
3. short sequence features like exit depth, apex height, descent continuity, and below-rim follow-through,
4. path geometry that suggests make or miss.

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

### `src/lib/rimDetector.js`

Responsible for:

1. scanning the full frame for a hoop-like orange structure,
2. stabilizing detections across frames,
3. creating a usable rim calibration without manual input.

### `src/lib/rimRelock.js`

Responsible for:

1. searching near the saved hoop location,
2. using orange rim pixels to correct small drift,
3. returning a refined rim position with confidence.

This is a hybrid assist layered on top of full automatic rim finding.

### `src/lib/shotTracker.js`

Responsible for:

1. storing recent ball positions,
2. tracking a shot attempt state,
3. classifying whether the shot was a make or miss from a short motion sequence,
4. returning confidence for the event.

### `src/hooks/useAutoShotMode.js`

Responsible for:

1. coordinating the camera,
2. running the detector at intervals,
3. drawing overlays,
4. running automatic rim detection,
5. running hybrid rim re-lock,
6. collecting QA metrics,
7. suppressing low-confidence shot logs.

### `src/screens/AutoShotMode.jsx`

Responsible for:

1. the user-facing Auto Mode UI,
2. detector tuning controls,
3. rim calibration entry points,
4. preset selection and recommendation,
5. QA report export,
6. displaying tracker and logging status.

### `src/lib/autoShotPresets.js`

Responsible for:

1. defining indoor, outdoor, low-light, and older-phone presets,
2. recommending a preset from brightness and live performance,
3. centralizing device/environment tuning settings.

## Current User Controls

The app currently exposes these controls in Auto Mode:

1. camera start/stop,
2. confidence threshold for detector locks,
3. shot log threshold for auto-logged make/miss events,
4. rim calibration,
5. hybrid rim re-lock toggle,
6. QA report export.
7. full-rim AI status,
8. environment/device presets.

## QA Metrics

The built-in QA panel tracks:

1. average FPS,
2. average inference time,
3. ball lock rate,
4. logged shots,
5. suppressed shots,
6. rim re-lock count,
7. automatic rim locks,
8. test duration.

The exported JSON report is intended for real phone testing and threshold tuning.

## What The System Does Well Right Now

1. runs fully in-browser,
2. supports manual rim calibration,
3. supports live ball overlays,
4. can automatically find the rim without manual setup in many cases,
5. logs make/miss events into the existing workout flow,
6. gives phone QA data without extra tooling,
7. allows confidence tuning and preset-based tuning for detection and logging.

## Current Limitations

1. Full automatic rim detection is now implemented, but still needs more field validation.
2. Make/miss logic is stronger but still partly heuristic-based.
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

The app finds the hoop automatically without requiring a saved manual reference first.

That stage is now implemented, but it still needs more real-court validation.

## Rim Source Modes

The app now exposes three rim source behaviors:

1. `Hybrid`
	Auto rim finding can create a lock, but manual calibration remains available as fallback.
2. `Manual`
	Manual calibration becomes the authoritative rim source and the auto rim detector will not replace it.
3. `Auto`
	The system relies on automatic rim finding as the primary rim source.

## Recommended Testing Workflow

1. Start with the `Auto` preset.
2. Let the app attempt automatic rim detection.
3. If needed, calibrate the rim manually.
4. Start with stationary phone placement.
5. Test 10 to 15 shots from one spot.
6. Export a QA report.
7. Adjust detector and shot-log thresholds or switch presets.
8. Repeat under different lighting conditions.

## Roadmap Status Summary

Current practical status:

1. Phase 0 is complete.
2. Phase 1 has a strong baseline implementation.
3. Phase 2 now includes both manual calibration and automatic rim finding.
4. Phase 3 has a stronger sequence-based baseline implementation.
5. Phase 4 integration is complete.
6. Phase 5 and Phase 6 are not complete.

## Related Documents

1. `AUTO_SHOT_INSTRUCTION_MANUAL.md` for end-user operation.
2. `SHOT_DETECTION_ROADMAP.md` for implementation status and future work.
