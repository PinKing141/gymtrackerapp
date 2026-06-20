# Auto Shot Tracking Instruction Manual

This guide explains how to use the basketball Auto Mode that is built into the app.

## What It Does

Auto Mode uses your phone camera to:

1. detect the basketball,
2. track its motion near the hoop,
3. classify the rep as a make or miss,
4. log the result into the active basketball workout.

Important limits:

1. The app can now try to detect the hoop automatically, but manual calibration is still the fallback when detection is weak.
2. Accuracy still depends on lighting, camera angle, and how clearly the ball is visible.
3. Manual MAKE and MISS buttons remain the fallback if Auto Mode misses a rep.
4. You can choose whether the app uses Auto, Hybrid, or Manual rim locking.

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
6. Wait for the app to auto-lock the rim, or open manual calibration if needed.

## How To Calibrate The Rim

This step is the fallback when automatic rim detection is not enough.

If you want your own saved hoop lock to stay in control, set `Rim Source` to `Manual lock only` or just save a manual calibration once. Saving a manual rim lock now switches the mode to Manual automatically.

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

## Auto Rim Detection

The app now includes automatic rim detection.

What it does:

1. scans the live frame for a stable orange hoop candidate,
2. creates a rim lock when the same hoop location stays stable across frames,
3. feeds that lock into the shot tracker automatically.

When to use manual calibration instead:

1. if the hoop is not locking reliably,
2. if the court lighting is poor,
3. if the camera is too far or the rim is too small in frame.

## Rim Source Modes

Auto Mode now supports three rim source modes:

1. `Hybrid: Auto first, manual fallback`
	The app tries to detect the rim automatically, but you can still calibrate manually if needed.
2. `Manual lock only`
	The app uses your saved manual calibration and will not let the full auto rim detector replace it.
3. `Auto detect only`
	The app depends on the rim AI instead of a manual lock.

## Auto Rim Re-Lock

Auto rim re-lock is a hybrid feature.

What it does:

1. starts from your saved manual rim calibration,
2. looks for orange rim pixels near that saved hoop location,
3. recenters the rim slightly if the phone drifts a small amount.

What it does not do:

1. It is not perfect after large camera moves.
2. It can still fail in weak lighting or visually noisy scenes.
3. It will not always recover from a completely wrong starting lock.

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
7. number of automatic rim locks.

This report is useful when tuning the detector on different courts and lighting setups.

## Best Setup For Accuracy

1. Put the phone on a tripod or stable object.
2. Keep the hoop in the upper-middle part of the frame.
3. Stand where the shot path stays visible.
4. Avoid other orange balls or round objects in frame.
5. Recalibrate the hoop after moving the phone.

## If Auto Mode Misses Shots

Try these fixes in order:

1. Check whether the rim AI is locked. If not, recalibrate the rim.
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

1. Full rim detection is now present, but it still needs real-court validation.
2. Zone auto-detection is not implemented.
3. Shot type auto-classification is not implemented.
4. The make/miss logic is stronger than before but still needs more real-court tuning.
5. Manual rim lock is still the safer option when automatic detection is unstable on a given court.

## Device Presets

Auto Mode now includes these presets:

1. `Auto`
2. `Indoor Gym`
3. `Outdoor Court`
4. `Low Light`
5. `Older Phone`

Use `Auto` first. If the app is struggling, switch manually to the preset that best matches your environment.

## Recommended Workflow For First Use

1. Start a free basketball session.
2. Switch to Auto Mode.
3. Let the app try to auto-detect the rim.
4. If needed, manually calibrate the rim.
5. Shoot 10 to 15 easy reps from one spot.
6. Watch whether the app logs each rep correctly.
7. Adjust the preset and thresholds if needed.
8. Once stable, start using it in longer sessions.
