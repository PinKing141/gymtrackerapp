// Lightweight sound + haptics engine. Uses the Web Audio API to synthesize short
// cues (no audio files — CSP-safe and works offline), gated by the user's
// devicePrefs so any handler can just call playCue(name) without prop-drilling.
import { devicePrefsLoad } from "../storage.js";

// Which preference category each cue belongs to.
const CUE_CATEGORY = {
  restEnd: "timers",
  countdown: "timers",
  intervalChange: "timers",
  setLogged: "logging",
  workoutComplete: "celebrations",
  pr: "celebrations",
  ballMake: "basketball",
  ballMiss: "basketball",
};

let audioContext = null;

function getContext() {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  if (!audioContext) {
    try {
      audioContext = new Ctor();
    } catch {
      return null;
    }
  }
  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}

// Call once from a user gesture (e.g. first tap) to unlock audio on mobile.
export function unlockAudio() {
  getContext();
}

function tone(ctx, { freq, start, duration, type = "sine", gain = 1, volume }) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
  const peak = Math.max(0.0001, volume * gain);
  amp.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  amp.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + start + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration + 0.02);
}

// Each cue is a sequence of tones.
function renderCue(ctx, name, volume) {
  const t = (partial) => tone(ctx, { volume, ...partial });
  switch (name) {
    case "setLogged":
      t({ freq: 660, start: 0, duration: 0.08, type: "triangle", gain: 0.5 });
      break;
    case "restEnd":
      t({ freq: 880, start: 0, duration: 0.12, gain: 0.7 });
      t({ freq: 1180, start: 0.14, duration: 0.16, gain: 0.7 });
      break;
    case "countdown":
      t({ freq: 720, start: 0, duration: 0.08, gain: 0.5 });
      break;
    case "intervalChange":
      t({ freq: 520, start: 0, duration: 0.1, gain: 0.6 });
      t({ freq: 780, start: 0.11, duration: 0.12, gain: 0.6 });
      break;
    case "workoutComplete":
      t({ freq: 523, start: 0, duration: 0.14, type: "triangle", gain: 0.7 });
      t({ freq: 659, start: 0.14, duration: 0.14, type: "triangle", gain: 0.7 });
      t({ freq: 784, start: 0.28, duration: 0.22, type: "triangle", gain: 0.8 });
      break;
    case "pr":
      t({ freq: 659, start: 0, duration: 0.12, type: "triangle", gain: 0.7 });
      t({ freq: 880, start: 0.12, duration: 0.12, type: "triangle", gain: 0.7 });
      t({ freq: 1319, start: 0.26, duration: 0.28, type: "triangle", gain: 0.85 });
      break;
    case "ballMake":
      t({ freq: 720, start: 0, duration: 0.06, type: "square", gain: 0.35 });
      t({ freq: 1040, start: 0.06, duration: 0.12, type: "triangle", gain: 0.6 });
      break;
    case "ballMiss":
      t({ freq: 300, start: 0, duration: 0.14, type: "sawtooth", gain: 0.35 });
      break;
    default:
      break;
  }
}

export function playCue(name) {
  const prefs = devicePrefsLoad();
  if (prefs.soundEnabled === false) return;
  const category = CUE_CATEGORY[name];
  if (category && prefs.soundCategories && prefs.soundCategories[category] === false) return;
  const ctx = getContext();
  if (!ctx) return;
  const volume = typeof prefs.soundVolume === "number" ? prefs.soundVolume : 0.6;
  try {
    renderCue(ctx, name, Math.max(0, Math.min(1, volume)) * 0.5);
  } catch {
    // ignore audio failures
  }
}

const HAPTIC_PATTERNS = {
  light: 12,
  medium: 24,
  success: [18, 40, 45],
  error: [40, 30, 40],
};

export function haptic(pattern = "light") {
  const prefs = devicePrefsLoad();
  if (prefs.hapticsEnabled === false) return;
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(HAPTIC_PATTERNS[pattern] || pattern);
  } catch {
    // ignore
  }
}
