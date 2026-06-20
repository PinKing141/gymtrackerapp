# Auto Shot Tracking Instruction Manual

This guide explains how to use the basketball Auto Mode that is built into the app.

## What It Does

Auto Mode uses your phone camera to:

1. detect the basketball,
2. track its motion near the hoop,
3. classify the rep as a make or miss,
4. log the result into the active basketball workout.

Important limits:

1. The hoop is not auto-detected yet. You must calibrate it manually.
2. Accuracy still depends on lighting, camera angle, and how clearly the ball is visible.
3. Manual MAKE and MISS buttons remain the fallback if Auto Mode misses a rep.

## Before You Start

For best results:

1. Place the phone where the hoop stays visible the whole time.
2. Keep the camera steady. Do not hand-hold it if possible.
3. Make sure the ball looks clearly orange in the camera feed.
4. Use good lighting. Indoor gyms should be bright; outdoor use should avoid heavy shadow across the hoop.
5. Keep the rim and the ball in the same camera frame during the shot.

## How To Start Auto Mode

1. Open the app.
2. Start a basketball workout.
3. Switch from Manual Mode to Auto Mode.
4. Tap Start Camera.
5. Allow camera access if your phone asks.

## How To Calibrate The Rim

This step is required before reliable shot tracking.

1. Tap Calibrate Rim.
2. Point the camera at the hoop.
3. Press on the center of the rim.
4. Drag outward to the rim edge.
5. Release to preview the circle.
6. Save the calibration.

Tips:

1. The circle should sit on the rim, not on the backboard.
2. Recalibrate any time the phone position changes.
3. If the app says the calibration is stale, redo it before a serious session.

## What The Auto Mode Panels Mean

### Camera

Shows whether the live camera feed is active.

### Model

Shows whether the TensorFlow ball detector is loaded.

### FPS

Shows the approximate render speed of the live overlay.

### Frame

Shows the current video resolution being processed.

### Ball

Shows the confidence score of the current locked basketball detection.

### Infer

Shows how long the model took to process the last detection frame.

### Tracker

Shows whether the shot tracker is idle, ready, or actively tracking a possible shot.

### Samples

Shows how many recent ball samples are feeding the shot tracker.

### Last Shot

Shows the last make or miss logged by Auto Mode.

## Detection Tuning

Auto Mode includes a Confidence Threshold slider.

How to use it:

1. Raise it if the app is locking onto the wrong object too often.
2. Lower it if the app is failing to lock onto the ball at all.

Recommended starting points:

1. `52%` for normal indoor use.
2. `58% to 65%` if false positives are common.
3. `45% to 50%` only if the ball is hard to detect and the court is visually simple.

Behind the scenes, Phase 1 now filters detections using:

1. model confidence,
2. ball size relative to the frame,
3. ball shape,
4. orange-color bias,
5. motion continuity from recent detections.

Auto Mode also includes a Shot Log Threshold slider.

Use it when:

1. detections look visually correct but low-confidence logs are creating false positives,
2. you want the tracker to show borderline events without saving them into the workout.

## Auto Rim Re-Lock

Auto rim re-lock is a hybrid feature.

What it does:

1. starts from your saved manual rim calibration,
2. looks for orange rim pixels near that saved hoop location,
3. recenters the rim slightly if the phone drifts a small amount.

What it does not do:

1. It does not replace manual calibration.
2. It is not a full hoop detector.
3. It will not recover from large camera moves or a completely wrong starting calibration.

If the phone position changes a lot, recalibrate the rim manually.

## Phone QA Report

Auto Mode now includes a QA panel and an Export QA Report button.

Use it after testing on your phone to capture:

1. average FPS,
2. average inference time,
3. lock rate,
4. number of logged shots,
5. number of suppressed shots,
6. number of rim re-locks.

This report is useful when tuning the detector on different courts and lighting setups.

## Best Setup For Accuracy

1. Put the phone on a tripod or stable object.
2. Keep the hoop in the upper-middle part of the frame.
3. Stand where the shot path stays visible.
4. Avoid other orange balls or round objects in frame.
5. Recalibrate the hoop after moving the phone.

## If Auto Mode Misses Shots

Try these fixes in order:

1. Recalibrate the rim.
2. Increase brightness or change your camera angle.
3. Raise the confidence threshold if the app is seeing the wrong thing.
4. Lower the confidence threshold slightly if it never locks the ball.
5. Keep the camera farther back so the whole shot path remains visible.
6. Use the manual MAKE or MISS buttons for any missed rep.

## If The Wrong Thing Is Detected As The Ball

1. Raise the confidence threshold.
2. Remove orange objects from the background if possible.
3. Keep only one basketball in frame.
4. Make sure the ball is not heavily blurred or cut off by the edge of the frame.

## If Tracking Feels Inconsistent On Phone

1. Close other heavy apps.
2. Use a newer browser on the phone.
3. Keep the camera feed stable.
4. Test in better lighting.
5. If the phone gets hot, stop and restart the camera after a short break.

## Current Limitations

1. The rim is manual-calibration only.
2. Zone auto-detection is not implemented.
3. Shot type auto-classification is not implemented.
4. The make/miss logic is heuristic-based and still needs more real-court tuning.

## Recommended Workflow For First Use

1. Start a free basketball session.
2. Switch to Auto Mode.
3. Calibrate the rim.
4. Shoot 10 to 15 easy reps from one spot.
5. Watch whether the app logs each rep correctly.
6. Adjust the confidence threshold if needed.
7. Once stable, start using it in longer sessions.
