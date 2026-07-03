// Cardio routines tagged by machine type. Shape is shared with the timer engine
// in CardioScreen (steps / steady / sequence / options + details strings), so
// treadmill and running intervals reuse the same countdown engine as the bike.

export const CARDIO_MACHINES = [
  { key: "bike", label: "Bike" },
  { key: "treadmill", label: "Treadmill" },
  { key: "running", label: "Run" },
  { key: "log", label: "Log" },
];

const m = (min) => min * 60;

export const CARDIO_ROUTINES = [
  // ── Bike (migrated from the original BIKE_ROUTINES) ──────────────────────
  {
    id: "bike-w1-intervals",
    machine: "bike",
    code: "W1",
    title: "Intervals (Primary Conditioning)",
    useWhen: "Use after an Upper session",
    totalTime: "22–25 min",
    steps: [
      { label: "Warm-up", seconds: m(5), details: "Resistance 3–4 / 20 · RPM 65–75" },
      {
        label: "Main Set",
        rounds: 10,
        sequence: [
          { label: "HARD", seconds: 30, details: "Resistance 9–12 / 20 · RPM 90–100 · Effort 9/10" },
          { label: "EASY", seconds: 90, details: "Resistance 3–4 / 20 · RPM 60–70" },
        ],
      },
      { label: "Cooldown", options: [m(3), m(4), m(5)], defaultSeconds: m(4), details: "Easy spin" },
    ],
  },
  {
    id: "bike-w2-steady",
    machine: "bike",
    code: "W2",
    title: "Steady State (Light Aerobic)",
    useWhen: "Use after Upper OR when legs feel okay",
    totalTime: "25–30 min",
    notes: ["✔ Slight sweat", "✔ You can talk comfortably", "❌ No leg burn"],
    steady: { options: [m(25), m(30)], defaultSeconds: m(25), details: "Resistance 4–5 / 20 · RPM 65–75 · Effort 5–6/10" },
  },
  {
    id: "bike-w2-long-steady",
    machine: "bike",
    code: "W2",
    title: "Long Steady (Fat Loss Focus)",
    useWhen: "Standalone or on lighter days",
    totalTime: "45–60 min",
    notes: ["✔ Consistent pace the whole time", "✔ Feels controlled, not draining", "❌ Do not turn this into a hard ride"],
    steady: { options: [m(45), m(60)], defaultSeconds: m(45), details: "Resistance 4–5 / 20 · RPM 65–75 · Effort 5/10" },
  },

  // ── Treadmill ────────────────────────────────────────────────────────────
  {
    id: "tread-intervals",
    machine: "treadmill",
    code: "T1",
    title: "Run/Walk Intervals",
    useWhen: "Conditioning without heavy leg fatigue",
    totalTime: "24–28 min",
    steps: [
      { label: "Warm-up", seconds: m(5), details: "Walk 5.0–5.5 km/h · Incline 1%" },
      {
        label: "Main Set",
        rounds: 8,
        sequence: [
          { label: "RUN", seconds: 60, details: "9–11 km/h · Incline 1% · Effort 8/10" },
          { label: "WALK", seconds: 90, details: "5.0 km/h · Incline 1%" },
        ],
      },
      { label: "Cooldown", options: [m(3), m(5)], defaultSeconds: m(4), details: "Easy walk 4.5 km/h" },
    ],
  },
  {
    id: "tread-incline-walk",
    machine: "treadmill",
    code: "T2",
    title: "Incline Walk (Fat Loss)",
    useWhen: "Low-impact steady session",
    totalTime: "30–45 min",
    notes: ["✔ Brisk but conversational", "✔ Keep off the handrails", "❌ Not a jog"],
    steady: { options: [m(30), m(40), m(45)], defaultSeconds: m(35), details: "5.0–6.0 km/h · Incline 8–12% · Effort 6/10" },
  },

  // ── Running / outdoor ──────────────────────────────────────────────────────
  {
    id: "run-easy",
    machine: "running",
    code: "R1",
    title: "Easy Aerobic Run",
    useWhen: "Base building / recovery",
    totalTime: "25–35 min",
    notes: ["✔ Nose-breathing pace", "✔ Could hold a conversation", "❌ No sprinting"],
    steady: { options: [m(20), m(30), m(35)], defaultSeconds: m(30), details: "Conversational pace · Effort 5/10" },
  },
  {
    id: "run-intervals",
    machine: "running",
    code: "R2",
    title: "Outdoor Intervals",
    useWhen: "Speed & conditioning",
    totalTime: "22–26 min",
    steps: [
      { label: "Warm-up", seconds: m(6), details: "Easy jog + strides" },
      {
        label: "Main Set",
        rounds: 6,
        sequence: [
          { label: "HARD", seconds: 45, details: "Fast run · Effort 9/10" },
          { label: "EASY", seconds: 75, details: "Jog / walk recovery" },
        ],
      },
      { label: "Cooldown", options: [m(4), m(5)], defaultSeconds: m(5), details: "Easy jog to walk" },
    ],
  },
];

export const CARDIO_LOG_TYPES = ["Bike", "Treadmill", "Run", "Walk", "Row", "Elliptical", "Swim", "Other"];
