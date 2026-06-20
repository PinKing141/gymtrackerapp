# Automatic Basketball Shot Detection Roadmap

**Goal:** Transform the existing basketball shot tracker from manual button-based input to automatic video-based detection.

**Outcome:** A browser-based system that detects shots from the phone camera, classifies make/miss, and automatically logs results into the existing app.

---

## 1. Project Overview

### Current State
- ✅ Basketball screen with shot logging UI ([BasketballScreen.jsx](src/screens/BasketballScreen.jsx))
- ✅ Shot data model (zoneId, type, result, timestamp)
- ✅ Session management and history storage
- ✅ Stats dashboard with zone-based breakdown
- ✅ Manual/Auto workout mode toggle inside active basketball sessions
- ✅ Camera feed integration via `navigator.mediaDevices.getUserMedia()`
- ✅ Canvas overlay loop with FPS/frame-size diagnostics
- ✅ Phase 1 baseline ball detection using TensorFlow.js COCO-SSD (`sports ball`) with temporal smoothing
- ✅ Basketball-specific Phase 1 post-filters for confidence, size, shape, orange-color bias, and motion continuity
- ✅ Manual rim calibration UI and persistence
- ✅ Browser-side trajectory heuristic that auto-logs make/miss events into the existing `recordShot()` path
- ✅ Mobile calibration interaction updated to use a single press-drag gesture with long-press highlight suppression
- ✅ Hybrid rim re-lock around the saved hoop calibration
- ✅ In-app QA metrics and export path for real phone testing

### Missing / Not Yet Production-Ready
- ⚠️ Ball detection needs real-device tuning, lighting tests, and false-positive filtering
- ⚠️ Rim position still starts from manual calibration, not full automatic rim detection from the camera feed
- ⚠️ Trajectory classification is heuristic-based and still needs on-court tuning
- ⚠️ Missed detections and edge cases still need device validation
- ❌ Custom basketball-specific model upgrade (YOLO/ONNX or equivalent)
- ❌ Full automatic rim detection without an initial manual lock
- ❌ Fully validated production-ready accuracy across different courts and angles

### Architecture
```
Phone Camera
    ↓
navigator.mediaDevices.getUserMedia() [JS]       ✅ implemented in useAutoShotMode.js
    ↓
Video Stream → Canvas Overlay                    ✅ implemented in AutoShotMode.jsx
    ↓
Frame Processing (TensorFlow.js / ONNX)           ✅ TensorFlow.js baseline implemented
    ↓
Ball Detection (COCO-SSD now → YOLO later)        ✅ baseline implemented in ballDetector.js
    ↓
Rim Calibration (user marks once)                 ✅ manual calibration implemented in rimCalibration.js + RimCalibrationScreen.jsx
    ↓
Trajectory Tracking (state machine + smoothing)   ✅ baseline implemented in shotTracker.js
    ↓
Shot Event Detection (make/miss classifier)       ✅ heuristic baseline implemented in shotTracker.js
    ↓
recordShot() → Existing BasketballScreen logic    ✅ live auto events wired through AutoShotMode/useAutoShotMode
    ↓
Automatic session update + stats                  ✅ baseline implemented; tuning still pending
```

---

## 2. Phase Breakdown

### **PHASE 0: Setup & Tooling** (Completed MVP skeleton)
**Objective:** Get camera access and basic rendering working.

**Implementation status (2026-06-12):** ✅ Complete for MVP. `AutoShotMode.jsx` and `useAutoShotMode.js` are in place, the camera stream renders into a `<video>`, and a canvas overlay loop reports FPS/frame dimensions.

#### 0.1 Install dependencies
Current baseline dependencies installed:
```bash
npm install --save @tensorflow/tfjs @tensorflow-models/coco-ssd
```

Future trajectory/performance dependencies are still optional and should be added only when that phase starts:
```bash
npm install --save onnxruntime-web opencv.js
```

#### 0.2 Create `AutoShotMode` screen component
- **File:** `src/screens/AutoShotMode.jsx`
- **Responsibilities:**
  - Request camera permission
  - Render video feed from `<video>` element
  - Create canvas overlay for drawing detection results
  - Manage state machine for mode transitions

#### 0.3 Add to navigation
- Create a new tab in basketball screen: "Auto Mode" vs. "Manual Mode"
- Wire `AutoShotMode` into the view routing

#### 0.4 Test checklist
- [x] Camera permission flow implemented
- [x] Video feed rendering implemented
- [x] Canvas drawing implemented
- [x] FPS counter implemented
- [ ] Real-device validation: frame rate ≥ 24 fps on target phone

**Estimated effort:** 2–3 days  
**Success metric:** Live camera feed visible, 60fps canvas drawing

---

### **PHASE 1: Ball Detection** (In progress — baseline implemented)
**Objective:** Reliably detect the basketball in every frame.

**Implementation status (2026-06-20):** ⚠️ Strong baseline complete, production tuning pending. `src/lib/ballDetector.js` now lazy-loads TensorFlow.js + COCO-SSD, filters predictions to `sports ball`, applies basketball-specific post-filters (score, size, shape, color bias, motion continuity), smooths position over recent detections, and exposes inference timing/debug info. `useAutoShotMode.js` runs throttled live inference and Auto Mode now exposes detector and shot-log confidence controls.

#### 1.1 Choose detection model
**Option A: YOLOv8-nano** (recommended for web)
- Smaller model (~6–8 MB)
- ~20–30 ms inference on mobile GPU
- Download from: https://github.com/ultralytics/ultralytics
- Export to ONNX or TensorFlow.js format

**Option B: TensorFlow.js Coco-SSD**
- Built-in, no custom training needed
- Slower (~50–100 ms)
- Less accurate for basketball-specific scenarios

**Current implementation:** Option B is now the active baseline (`@tensorflow-models/coco-ssd` + `@tensorflow/tfjs`). Keep YOLOv8-nano as the next upgrade path after validating camera placement, rim calibration, and trajectory logic.

#### 1.2 Implement detection loop
- **File:** `src/lib/ballDetector.js`
- **Status:** ✅ Implemented baseline
- **Current key functions:**
  - `createBallDetector().init()` - lazy-load TensorFlow.js/COCO-SSD and prefer WebGL with CPU fallback
  - `createBallDetector().detect(videoElement)` - run inference on the live video frame
  - `smoothDetection()` - simple moving average over recent ball detections
- **Current inference cadence:** throttled from `useAutoShotMode.js` with `DETECTION_INTERVAL_MS = 140` to avoid running model inference every animation frame.

#### 1.3 Add detection overlay
- [x] Draw bounding box + confidence score on canvas
- [x] Show detected ball position in real-time
- [x] Add debug info: FPS, inference time, ball coordinates

#### 1.4 Implement temporal smoothing
- [x] Simple moving average implemented as the first pass
- [ ] Upgrade to Kalman filter if jitter remains high during real-device testing
- [x] Add basketball color/size gating to reduce false positives

#### 1.5 Test checklist
- [x] Ball detector code path implemented
- [x] Bounding-box overlay implemented
- [x] Inference-time/FPS/coordinate UI implemented
- [ ] Ball detected in a real phone video stream
- [ ] Detection works in various lighting (indoor/outdoor)
- [ ] Inference speed ≥ 15 fps on target device
- [ ] Position jitter reduced to acceptable levels with smoothing
- [ ] False-positive rate measured over 30+ seconds

**Estimated effort:** 5–7 days  
**Success metric:** Ball position accurate within ±10px, no false positives for 30+ seconds

---

### **PHASE 2: Rim Calibration** (2–3 days)
**Objective:** Let user mark the rim once, use it for all shots.

**Implementation status (2026-06-20):** ✅ Baseline complete. The app now provides a full-screen calibration flow in `RimCalibrationScreen.jsx`, stores the selected rim center/radius in local storage, reuses it in Auto Mode, and supports a mobile-friendly single press-drag gesture. This is manual calibration only; automatic rim detection is still out of scope for this phase.

#### 2.1 Rim calibration UI
- **File:** `src/screens/RimCalibrationScreen.jsx`
- **Flow:**
  1. Show live camera feed
  2. User taps to mark rim center
  3. User drags to mark rim diameter (or marks two edges)
  4. Save calibration: `{ rimCenter: {x, y}, rimRadius: r, timestamp }`

#### 2.2 Store calibration
```js
// In AutoShotMode state
const [rimCalibration, setRimCalibration] = useState(null);

// Save to localStorage
useEffect(() => {
  if (rimCalibration) {
    localStorage.setItem('basketballRimCalibration', JSON.stringify(rimCalibration));
  }
}, [rimCalibration]);
```

#### 2.3 Load & reuse
- Load on app start if exists
- Add "Recalibrate Rim" button for court changes
- Show calibration confidence warning if stale (>30 days)

#### 2.4 Test checklist
- [x] User can mark rim center and drag to set radius
- [x] Calibration persists across sessions
- [x] Rim position is drawn back onto the video overlay
- [x] Can recalibrate without breaking existing sessions
- [x] Long-press highlight/callout suppressed for phone interaction
- [ ] Real-device validation across different phones/orientations

**Estimated effort:** 2–3 days  
**Success metric:** Rim marked once, reused for 50+ shots without drift

---

### **PHASE 3: Trajectory Tracking** (4–6 days)
**Objective:** Track ball movement frame-by-frame and detect shot phases.

**Implementation status (2026-06-20):** ⚠️ Baseline complete, tuning pending. The production tracker currently lives in `src/lib/shotTracker.js` and uses a lightweight heuristic state machine (`idle` → `armed` → event) rather than the fuller class sketch below.

#### 3.1 Ball trajectory state machine
- **Current file:** `src/lib/shotTracker.js`
- **Current live states:** `idle` and `armed`
- **Note:** The design sketch below is still useful as a future refinement path, but it does not exactly match the code currently shipped in the app.

States:
```
IDLE
  → detect ball below rim + moving upward
  → ASCENDING

ASCENDING
  → track ball height, detect peak
  → DESCENDING

DESCENDING
  → track ball toward rim
  → check if passes through rim zone
  → EVALUATING

EVALUATING
  → determine make/miss
  → log result
  → reset to IDLE
```

#### 3.2 Implement tracker
```js
export class TrajectoryTracker {
  constructor(rimCalibration) {
    this.rim = rimCalibration;
    this.state = 'IDLE';
    this.ballHistory = []; // last 60 frames of {x, y, t}
    this.shotStartFrame = null;
    this.peakHeight = null;
  }

  update(ballPosition) {
    if (!ballPosition) return null; // no detection this frame

    this.ballHistory.push({
      x: ballPosition.x,
      y: ballPosition.y,
      t: Date.now(),
    });

    // Keep only last 60 frames
    if (this.ballHistory.length > 60) {
      this.ballHistory.shift();
    }

    return this._evaluateState();
  }

  _evaluateState() {
    const isAboveRim = this.ballHistory[this.ballHistory.length - 1].y < this.rim.rimCenter.y;
    const isMovingUp = this._getVerticalVelocity() < 0; // negative = upward
    const isMovingDown = this._getVerticalVelocity() > 0;

    if (this.state === 'IDLE') {
      if (isAboveRim && isMovingDown) {
        this.state = 'DESCENDING';
        this.shotStartFrame = this.ballHistory.length;
        return null;
      }
    }

    if (this.state === 'DESCENDING') {
      const inRimZone = this._isInRimZone();
      if (inRimZone && isMovingDown) {
        return this._evaluateMakeOrMiss();
      }
    }

    return null; // shot not yet complete
  }

  _getVerticalVelocity() {
    if (this.ballHistory.length < 2) return 0;
    const now = this.ballHistory[this.ballHistory.length - 1];
    const prev = this.ballHistory[this.ballHistory.length - 2];
    return now.y - prev.y; // positive = downward
  }

  _isInRimZone() {
    const current = this.ballHistory[this.ballHistory.length - 1];
    const dist = Math.hypot(
      current.x - this.rim.rimCenter.x,
      current.y - this.rim.rimCenter.y
    );
    // Zone is 1.5x rim radius
    return dist < this.rim.rimRadius * 1.5;
  }

  _evaluateMakeOrMiss() {
    const trajectoryAfterRim = this.ballHistory.slice(-5);
    const bottomMost = Math.max(...trajectoryAfterRim.map(p => p.y));

    // Made = ball passed through rim zone and exited below
    const isMake = bottomMost > this.rim.rimCenter.y + this.rim.rimRadius;

    this.state = 'IDLE';
    this.ballHistory = [];

    return {
      made: isMake,
      confidence: 0.85, // placeholder; improve with ML later
    };
  }
}
```

#### 3.3 Visualization
- [x] Draw ball trajectory on canvas (last 10 frames as a fading trail)
- [x] Highlight rim zone with calibrated overlay
- [x] Show live diagnostics for tracker readiness / last shot result

#### 3.4 Fine-tune thresholds
- Rim zone size (currently 1.5x radius)
- Minimum upward velocity to start shot
- Velocity threshold for "descending"
- Test with various shooting styles

#### 3.5 Test checklist
- [x] State machine emits real make/miss events into the app
- [ ] Correctly identifies start of shot under real play conditions
- [ ] Detects rim crossing consistently on real video
- [ ] Classifies make/miss with ≥80% accuracy
- [ ] No false positives (accidental makes/misses)

**Estimated effort:** 4–6 days  
**Success metric:** 50 test shots, ≥80% accuracy on make/miss classification

---

### **PHASE 4: Integration with Existing App** (Partially complete)
**Objective:** Wire automatic detection results into the existing basketball screen.

**Implementation status (2026-06-20):** ✅ Baseline complete. Basketball sessions support Manual/Auto mode switching, `AutoShotMode` receives the active logging target, `useAutoShotMode` emits real automatic shot events from `shotTracker.js`, and `recordShot()` now logs those events with `source`/`confidence` metadata.

#### 4.1 Add callback to AutoShotMode
```js
// In AutoShotMode.jsx
export function AutoShotMode({ onRecordShot, currentZone, currentType }) {
  const [trajectoryTracker, setTrajectoryTracker] = useState(null);

  // In detection loop:
  const shotResult = trajectoryTracker.update(ballPosition);
  if (shotResult) {
    onRecordShot({
      result: shotResult.made ? 'make' : 'miss',
      zoneId: currentZone,
      type: currentType,
    });
    // Optional: vibrate & play sound
    navigator.vibrate([100]);
  }
}
```

#### 4.2 Modify BasketballScreen
- [x] Keep existing manual mode intact
- [x] Add mode toggle: "Manual" / "Auto"
- [x] Pass `onRecordShot` callback to AutoShotMode
- [x] Use same `recordShot()` path for manual shots and auto payloads
- [x] Wire real trajectory outcomes into `onRecordShot`

#### 4.3 Add UI elements
- [x] **Mode toggle button** (top of active workout screen)
- [x] **Rim calibration button** (settings / Auto Mode panel)
- [x] **FPS counter** (Auto Mode diagnostics)
- [x] **Ball detection confidence + inference time** (Auto Mode diagnostics)
- [x] **Shot confidence score** in Auto Mode feedback card
- [x] **Confidence threshold slider** (allow user to filter low-confidence shots)
- [x] **QA report export** for real-device testing
- [x] **Auto rim re-lock status/toggle** in Auto Mode panel

#### 4.4 Add confirmations
- Optional: show make/miss popup before logging
- Allow user to undo last shot
- Show confidence level: "High", "Medium", "Low"

#### 4.5 Test checklist
- [x] Auto Mode sends real detected events into `recordShot()`
- [x] Manual selected zone/type still flows into the logging target
- [x] Can switch between manual and auto modes
- [x] Real auto mode records trajectory-derived shots through the normal logging path
- [x] Stats update in real-time from trajectory-derived shots
- [ ] Zone/type auto-detection or manual selection works under real shot flow
- [ ] Undo functionality works for auto-detected shots

**Estimated effort:** 3–4 days  
**Success metric:** 100+ shots logged automatically, stats match manual counting

---

### **PHASE 5: Performance & Mobile Optimization** (3–5 days)
**Objective:** Ensure the system runs smoothly on actual mobile devices.

#### 5.1 Reduce model inference time
- **Use YOLOv8-nano** instead of COCO-SSD
- **Quantize model** (reduce precision: float32 → int8)
- **Reduce input resolution** (use 320x240 instead of 640x480)

#### 5.2 Frame skipping
- Only run YOLO every 4–5 frames
- Use OpenCV.js for tracking between detections

```js
let frameCount = 0;
if (frameCount % 5 === 0) {
  // Run YOLO
  const detected = await ballDetector.detect(videoElement);
} else {
  // Use OpenCV to track from previous frame
  const tracked = tracker.track(prevFrame, currentFrame);
}
frameCount++;
```

#### 5.3 GPU acceleration
- Use WebGL backend for TensorFlow.js
- Enable hardware acceleration in browser settings
- Test on actual iPhone/Android device

#### 5.4 Memory management
- Limit canvas history to last 10 frames
- Dispose old tensors explicitly
- Monitor for memory leaks in DevTools

#### 5.5 Battery optimization
- Reduce screen brightness during detection
- Allow user to pause detection (vs. continuous)
- Stop detection if accuracy drops below threshold

#### 5.6 Test checklist
- [ ] Consistent 30+ fps on iPhone 12+
- [ ] Consistent 24+ fps on mid-range Android
- [ ] No memory leaks over 30-minute session
- [ ] Battery drain ≤ 10% per hour
- [ ] CPU temp stays below critical threshold

**Estimated effort:** 3–5 days  
**Success metric:** 30fps on target devices, no crashes after 1-hour session

---

### **PHASE 6: Advanced Features** (ongoing)
**Objective:** Enhance accuracy and user experience post-launch.

#### 6.1 Zone auto-detection
- Detect where on the court the shot originated
- Map pixel coordinates to zones (paint, mid, three-pointer)
- Requires court calibration (mark three corners)

#### 6.2 Shot type classification
- Detect shooting motion (layup, jumper, floater)
- Use pose estimation (MediaPipe) if needed
- For MVP: keep user-selected, improve later

#### 6.3 Shooting form feedback
- Detect release point
- Measure shot arc angle
- Provide coaching hints ("Release higher", "Follow through")

#### 6.4 Heat maps
- Track all shot locations on court
- Visualize make % by zone
- Already partially supported in existing app

#### 6.5 Streak detection
- Detect consecutive makes
- Alert user on milestones (5-make streak, etc.)
- Already supported in existing stats

---

## 3. Technical Requirements

### Dependencies
Current installed dependencies:
```json
{
  "dependencies": {
    "@tensorflow-models/coco-ssd": "^2.2.3",
    "@tensorflow/tfjs": "^4.22.0"
  }
}
```

Future candidate dependencies (add only when needed):
```json
{
  "dependencies": {
    "onnxruntime-web": "^1.15.0",
    "opencv.js": "^4.5.0"
  }
}
```

Or via CDN (no npm needed):
```html
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs"></script>
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-coco-ssd"></script>
```

### Browser APIs Required
- `navigator.mediaDevices.getUserMedia()` — camera access
- `HTMLCanvasElement.getContext('2d')` — drawing
- `HTMLVideoElement` — video rendering
- `LocalStorage` — persist calibration

### Device Requirements
- Modern smartphone (iPhone 11+, Android 9+)
- Camera: 12MP or higher, good autofocus
- OS: iOS 13+ or Android 9+
- Memory: ≥ 2GB RAM

### Network
- Model download: ~6–8 MB (one-time, cached)
- No ongoing cloud dependency (works offline)

---

## 4. File Structure (New Files)

```
src/
├── screens/
│   ├── BasketballScreen.jsx          ← MODIFIED (manual/auto toggle + payload-aware recordShot)
│   ├── AutoShotMode.jsx              ← ADDED (Phase 0/1 camera + detector UI)
│   └── RimCalibrationScreen.jsx      ← ADDED (manual rim calibration flow)
├── hooks/
│   └── useAutoShotMode.js            ← ADDED (camera, inference, tracker orchestration)
└── lib/
  ├── ballDetector.js               ← ADDED (COCO-SSD basketball detection baseline)
  ├── rimCalibration.js             ← ADDED (save/load/scale/draw rim calibration)
  └── shotTracker.js                ← ADDED (heuristic make/miss tracker)
│

Legacy reference assets were moved out of the repo root into `ai/reference-python-detector/`.
├── lib/
│   ├── ballDetector.js               ← ADDED (Phase 1 COCO-SSD baseline)
│   ├── trajectoryTracker.js          ← TODO (Phase 3)
│   ├── rimCalibration.js             ← TODO (Phase 2)
│   └── shotEventClassifier.js        ← TODO (Phase 3)
│
└── hooks/
    └── useAutoShotMode.js            ← ADDED (Phase 0/1 camera + detection loop)
```

---

## 5. Integration Hooks

### Current BasketballScreen integration
```js
const [shotInputMode, setShotInputMode] = useState("manual");

{shotInputMode === "auto" ? (
  <AutoShotMode
    onRecordShot={recordShot}
    currentZoneName={ZONES[isStructured ? currentDrill.zoneId : activeSession.currentZone]?.name}
    currentType={isStructured ? currentDrill.type : activeSession.currentType}
    disabled={isStructured && drillMakes >= currentDrill.targetMakes}
  />
) : (
  // existing manual workout UI
)}
```

### Current `recordShot()` compatibility
`recordShot()` now accepts both the legacy string input and future auto-detection payloads:
```js
recordShot("make");

recordShot({
  result: "make",
  source: "auto",
  confidence: 0.87,
});
```

Structured workouts still derive `zoneId` and `type` from the active drill. Free-shoot sessions can accept payload `zoneId`/`type` overrides later when zone auto-detection exists.

---

## 6. Testing Strategy

### Unit Tests
- Ball detector accuracy (on sample images)
- Trajectory state machine transitions
- Make/miss classification logic

### Integration Tests
- E2E shot logging (manual → auto mode)
- Stats calculation correctness
- Session persistence

### Real-world Tests
- **Test 1:** Free throws (100 shots, measure accuracy)
- **Test 2:** Mid-range pull-ups (80 shots, various angles)
- **Test 3:** Three-pointers (60 shots, corners + top)
- **Test 4:** Mixed drills (50 shots, vary distance/type)
- **Test 5:** Outdoor court (bright sunlight, shadows)

### Acceptance Criteria
- ≥ 85% accuracy on makes
- ≥ 85% accuracy on misses
- ≤ 5% false positives (accidental shots detected)
- Inference time ≤ 100 ms per frame
- No crashes in 2-hour continuous session

---

## 7. Timeline Estimate

| Phase | Status | Original Duration | Notes |
|-------|--------|-------------------|-------|
| Phase 0: Setup | ✅ Complete for MVP | 2–3 days | Camera/video/canvas/FPS shell implemented |
| Phase 1: Ball Detection | ⚠️ Baseline implemented; tuning pending | 5–7 days | COCO-SSD + smoothing + overlay implemented; needs real-device QA |
| Phase 2: Rim Calibration | ⏭️ Next | 2–3 days | Add tap/drag rim marking and persistence |
| Phase 3: Trajectory | Not started | 4–6 days | Requires rim calibration and stable ball positions |
| Phase 4: Integration | ⚠️ Partially complete | 3–4 days | Manual/Auto toggle and test callbacks complete; real shot events pending |
| Phase 5: Performance | Not started | 3–5 days | Optimize after Phase 2/3 produce measurable workloads |
| **Total MVP remaining** | | **~2–3 weeks** | Assuming Phase 1 tuning + Phases 2–4 completion |
| Phase 6: Advanced | Ongoing | — | Post-MVP enhancements |

**Fast track:** Focus on Phases 0–4 first (2–3 weeks), then optimize later.

---

## 8. Success Metrics

### Launch Readiness (MVP)
- [ ] Ball detected in ≥95% of frames on target device
- [ ] Make/miss accuracy ≥85%
- [ ] False positive rate <5%
- [ ] Runs at 30+ fps on target device, or maintains acceptable UX with throttled inference
- [ ] Rim calibration persists
- [x] Auto/test results can flow into existing basketball screen logic
- [ ] Real trajectory-derived results log into existing basketball screen correctly
- [ ] No crashes over 1-hour session

### Post-Launch Goals
- Reach 90%+ accuracy
- Add zone auto-detection
- Add shooting form feedback
- Reach 500+ logged auto-detected shots
- Get user feedback on accuracy

---

## 9. Known Challenges & Mitigations

### Challenge 1: Lighting Variation
**Problem:** Ball hard to detect in shadows or bright sunlight.  
**Mitigation:**
- Use histogram equalization in preprocessing
- Train detection model on varied lighting
- Allow user to adjust detection threshold

### Challenge 2: False Positives
**Problem:** Other spherical objects detected as basketball.  
**Mitigation:**
- Filter by ball color (orange) in post-processing
- Use model confidence score threshold
- Manual confirmation popup for low-confidence shots

### Challenge 3: Mobile GPU Limits
**Problem:** Inference too slow on older phones.  
**Mitigation:**
- Use quantized, smaller model (YOLOv8-nano)
- Frame skipping (run detection every Nth frame)
- Reduce input resolution

### Challenge 4: Rim Movement
**Problem:** Rim moves between shots (wind, contact).  
**Mitigation:**
- Allow user to recalibrate easily
- Warn if calibration seems off (ball consistently outside zone)
- Use rim as a soft constraint, not hard boundary

---

## 10. Next Immediate Steps

1. **Run real phone QA:** Use the in-app QA panel and Export QA Report button after indoor and outdoor sessions.
2. **Tune Phase 3:** Adjust shot-event thresholds using real make/miss samples to reduce false positives and missed logs.
3. **Stress-test hybrid re-lock:** Confirm the rim stays centered after small camera bumps and recalibrate after larger camera moves.
4. **Performance pass:** Reduce bundle/runtime cost and test sustained sessions on actual devices.
5. **Model upgrade decision:** Decide whether the next step is more heuristic tuning or a basketball-specific YOLO/ONNX model.

---

## References

- **YOLO:** https://github.com/ultralytics/ultralytics
- **TensorFlow.js:** https://www.tensorflow.org/js
- **OpenCV.js:** https://docs.opencv.org/4.5.0/d4/da0/group__javascript.html
- **ONNX Runtime Web:** https://onnxruntime.ai/docs/get-started/with-web/
- **Kalman Filter:** https://en.wikipedia.org/wiki/Kalman_filter
- **MediaPipe:** https://mediapipe.dev/ (for future pose estimation)

---

**Status:** Phases 0, 2, and 4 baseline-complete; Phase 1 stronger baseline implemented; Phase 3 baseline implemented; real-device QA, tuning, and performance work remain.
**Last updated:** 2026-06-20
