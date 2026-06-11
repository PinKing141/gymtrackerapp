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

### Missing
- ❌ Camera feed integration
- ❌ Ball detection
- ❌ Rim detection & calibration
- ❌ Trajectory tracking
- ❌ Shot event classification (make/miss)
- ❌ Automatic result logging

### Architecture
```
Phone Camera
    ↓
navigator.mediaDevices.getUserMedia() [JS]
    ↓
Video Stream → Canvas
    ↓
Frame Processing (TensorFlow.js / ONNX)
    ↓
Ball Detection (YOLOv8-nano or similar)
    ↓
Rim Calibration (user marks once)
    ↓
Trajectory Tracking (OpenCV.js)
    ↓
Shot Event Detection (state machine)
    ↓
Make/Miss Classifier
    ↓
recordShot() → Existing BasketballScreen logic
    ↓
Automatic session update + stats
```

---

## 2. Phase Breakdown

### **PHASE 0: Setup & Tooling** (2–3 days)
**Objective:** Get camera access and basic rendering working.

#### 0.1 Install dependencies
```bash
npm install --save \
  @tensorflow/tfjs \
  @tensorflow/tfjs-core \
  @tensorflow/tfjs-converter \
  @tensorflow/tfjs-backend-webgl \
  opencv.js  # or use npm package if available
```

**Alternative:** Use ONNX Runtime Web instead of TensorFlow.js for lighter footprint:
```bash
npm install --save onnxruntime-web
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
- [ ] Camera permission prompt appears
- [ ] Video feed renders on screen
- [ ] Canvas drawing works
- [ ] Frame rate ≥ 24 fps on target device

**Estimated effort:** 2–3 days  
**Success metric:** Live camera feed visible, 60fps canvas drawing

---

### **PHASE 1: Ball Detection** (5–7 days)
**Objective:** Reliably detect the basketball in every frame.

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

**Recommendation:** Start with Option B for speed, upgrade to YOLOv8 after proving the pipeline.

#### 1.2 Implement detection loop
- **File:** `src/lib/ballDetector.js`
- **Key functions:**
  - `initModel()` - load YOLO/COCO-SSD
  - `detectBall(canvas)` - run inference on frame
  - `trackBall(detections)` - smooth detections across frames

```js
export const ballDetector = {
  async init() {
    // Load model from CDN or local
    this.model = await cocoSsd.load();
  },

  async detect(videoElement) {
    const predictions = await this.model.estimateObjects(videoElement);
    // Filter for "sports ball" or "basketball"
    return predictions.filter(p => p.class === 'sports ball');
  }
};
```

#### 1.3 Add detection overlay
- Draw bounding box + confidence score on canvas
- Show detected ball position in real-time
- Add debug info: FPS, inference time, ball coordinates

#### 1.4 Implement temporal smoothing
- Use Kalman filter or simple moving average to smooth ball position
- Reduces jitter and false detections

#### 1.5 Test checklist
- [ ] Ball detected in video stream
- [ ] Bounding box appears around basketball
- [ ] Detection works in various lighting (indoor/outdoor)
- [ ] Inference speed ≥ 15 fps
- [ ] Position jitter reduced with smoothing

**Estimated effort:** 5–7 days  
**Success metric:** Ball position accurate within ±10px, no false positives for 30+ seconds

---

### **PHASE 2: Rim Calibration** (2–3 days)
**Objective:** Let user mark the rim once, use it for all shots.

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
- [ ] User can tap to mark rim
- [ ] Calibration persists across sessions
- [ ] Rim position drawn accurately on video
- [ ] Can recalibrate without breaking existing sessions

**Estimated effort:** 2–3 days  
**Success metric:** Rim marked once, reused for 50+ shots without drift

---

### **PHASE 3: Trajectory Tracking** (4–6 days)
**Objective:** Track ball movement frame-by-frame and detect shot phases.

#### 3.1 Ball trajectory state machine
- **File:** `src/lib/trajectoryTracker.js`

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
- Draw ball trajectory on canvas (last 10 frames as a fading trail)
- Highlight rim zone with circle
- Show state indicator: "IDLE", "DESCENDING", "MAKE!", "MISS!"

#### 3.4 Fine-tune thresholds
- Rim zone size (currently 1.5x radius)
- Minimum upward velocity to start shot
- Velocity threshold for "descending"
- Test with various shooting styles

#### 3.5 Test checklist
- [ ] State machine transitions correctly
- [ ] Correctly identifies start of shot
- [ ] Detects rim entry
- [ ] Classifies make/miss with ≥80% accuracy
- [ ] No false positives (accidental makes/misses)

**Estimated effort:** 4–6 days  
**Success metric:** 50 test shots, ≥80% accuracy on make/miss classification

---

### **PHASE 4: Integration with Existing App** (3–4 days)
**Objective:** Wire automatic detection results into the existing basketball screen.

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
- Keep existing manual mode intact
- Add mode toggle: "Manual" / "Auto"
- Pass `onRecordShot` callback to AutoShotMode
- Use same `recordShot()` logic for both modes

#### 4.3 Add UI elements
- **Mode toggle button** (top of screen)
- **Rim calibration button** (settings)
- **FPS counter** (debug mode only)
- **Confidence score** on each auto-detected shot
- **Confidence threshold slider** (allow user to filter low-confidence shots)

#### 4.4 Add confirmations
- Optional: show make/miss popup before logging
- Allow user to undo last shot
- Show confidence level: "High", "Medium", "Low"

#### 4.5 Test checklist
- [ ] Auto mode records shots correctly
- [ ] Stats update in real-time
- [ ] Zone/type auto-detection or manual selection works
- [ ] Can switch between manual and auto modes
- [ ] Undo functionality works

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

### Dependencies to Add
```json
{
  "dependencies": {
    "@tensorflow/tfjs": "^4.11.0",
    "@tensorflow/tfjs-converter": "^4.11.0",
    "@tensorflow/tfjs-backend-webgl": "^4.11.0",
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
│   ├── BasketballScreen.jsx          ← MODIFY
│   ├── AutoShotMode.jsx              ← NEW (Phase 0)
│   └── RimCalibrationScreen.jsx      ← NEW (Phase 2)
│
├── lib/
│   ├── ballDetector.js               ← NEW (Phase 1)
│   ├── trajectoryTracker.js          ← NEW (Phase 3)
│   ├── rimCalibration.js             ← NEW (Phase 2)
│   └── shotEventClassifier.js        ← NEW (Phase 3)
│
└── hooks/
    └── useAutoShotMode.js            ← NEW (Phase 0)
```

---

## 5. Integration Hooks

### Modify BasketballScreen.jsx
```js
// Add mode state
const [mode, setMode] = useState('manual'); // 'manual' or 'auto'

// Pass callback to AutoShotMode
{mode === 'auto' && (
  <AutoShotMode
    onRecordShot={recordShot}
    currentZone={/* user selected or auto-detected */}
    currentType={/* user selected or auto-detected */}
  />
)}

// Add mode toggle
<button onClick={() => setMode(mode === 'manual' ? 'auto' : 'manual')}>
  {mode === 'manual' ? '📷 Auto Mode' : '👆 Manual Mode'}
</button>
```

### Existing recordShot() function
No changes needed—both manual and auto modes call the same function:
```js
const recordShot = (result) => {
  setActiveSession((previous) => {
    // existing logic handles both sources
  });
};
```

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

| Phase | Duration | Cumulative |
|-------|----------|-----------|
| Phase 0: Setup | 2–3 days | 2–3 days |
| Phase 1: Ball Detection | 5–7 days | 7–10 days |
| Phase 2: Rim Calibration | 2–3 days | 9–13 days |
| Phase 3: Trajectory | 4–6 days | 13–19 days |
| Phase 4: Integration | 3–4 days | 16–23 days |
| Phase 5: Performance | 3–5 days | 19–28 days |
| **Total MVP** | | **3–4 weeks** |
| Phase 6: Advanced | Ongoing | — |

**Fast track:** Focus on Phases 0–4 first (2–3 weeks), then optimize later.

---

## 8. Success Metrics

### Launch Readiness (MVP)
- ✅ Ball detected in ≥95% of frames
- ✅ Make/miss accuracy ≥85%
- ✅ False positive rate <5%
- ✅ Runs at 30+ fps on target device
- ✅ Rim calibration persists
- ✅ Results log into existing basketball screen correctly
- ✅ No crashes over 1-hour session

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

1. **Today:** Create PHASE 0 screen skeleton
2. **Tomorrow:** Get camera feed rendering
3. **Day 3:** Integrate TensorFlow.js + COCO-SSD
4. **Day 4:** Implement ball detection + visualization
5. **Day 5:** Start trajectory tracker state machine

---

## References

- **YOLO:** https://github.com/ultralytics/ultralytics
- **TensorFlow.js:** https://www.tensorflow.org/js
- **OpenCV.js:** https://docs.opencv.org/4.5.0/d4/da0/group__javascript.html
- **ONNX Runtime Web:** https://onnxruntime.ai/docs/get-started/with-web/
- **Kalman Filter:** https://en.wikipedia.org/wiki/Kalman_filter
- **MediaPipe:** https://mediapipe.dev/ (for future pose estimation)

---

**Status:** Planning complete, ready to begin Phase 0.  
**Last updated:** 2026-06-10
