import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../components/icons.jsx";
import { colors, radii, typeScale } from "../theme.js";

const STORAGE_KEY = "hoopTrackerProData";

const SHOT_TYPES = ["Form", "Catch & Shoot", "Pull-Up", "Step-In", "Floater", "Layup", "Reverse", "Contact", "Free Throw"];

const ZONES = {
  PAINT: { id: "PAINT", name: "Paint / Restricted", type: "finishing" },
  MID_LEFT: { id: "MID_LEFT", name: "Left Elbow/Wing", type: "mid" },
  MID_RIGHT: { id: "MID_RIGHT", name: "Right Elbow/Wing", type: "mid" },
  MID_TOP: { id: "MID_TOP", name: "Top Mid-Range", type: "mid" },
  THREE_LEFT_CORNER: { id: "THREE_LEFT_CORNER", name: "Left Corner 3", type: "three" },
  THREE_RIGHT_CORNER: { id: "THREE_RIGHT_CORNER", name: "Right Corner 3", type: "three" },
  THREE_LEFT_WING: { id: "THREE_LEFT_WING", name: "Left Wing 3", type: "three" },
  THREE_RIGHT_WING: { id: "THREE_RIGHT_WING", name: "Right Wing 3", type: "three" },
  THREE_TOP: { id: "THREE_TOP", name: "Top of Key 3", type: "three" },
  FREE_THROW: { id: "FREE_THROW", name: "Free Throw Line", type: "ft" },
};

const BUILT_IN_TEMPLATES = [
  { id: "free", name: "Free Shoot", desc: "Track anywhere, anytime. No targets.", isStructured: false },
  {
    id: "starter",
    name: "Starter Shooter",
    desc: "For beginners or off-days (30-45 mins).",
    isStructured: true,
    drills: [
      { name: "Form Shots", zoneId: "PAINT", type: "Form", targetMakes: 50 },
      { name: "Left Elbow Mid", zoneId: "MID_LEFT", type: "Catch & Shoot", targetMakes: 10 },
      { name: "Right Elbow Mid", zoneId: "MID_RIGHT", type: "Catch & Shoot", targetMakes: 10 },
      { name: "Around the Arc", zoneId: "THREE_TOP", type: "Catch & Shoot", targetMakes: 25 },
      { name: "Free Throws", zoneId: "FREE_THROW", type: "Free Throw", targetMakes: 20 },
    ],
  },
  {
    id: "efficient_scorer",
    name: "Efficient Scorer",
    desc: "Your Main Workout. Finish, Mid, 3PT, FT.",
    isStructured: true,
    drills: [
      { name: "Right Hand Finishes", zoneId: "PAINT", type: "Layup", targetMakes: 10 },
      { name: "Left Hand Finishes", zoneId: "PAINT", type: "Layup", targetMakes: 10 },
      { name: "Contact Finishes", zoneId: "PAINT", type: "Contact", targetMakes: 10 },
      { name: "Left Mid-Range", zoneId: "MID_LEFT", type: "Pull-Up", targetMakes: 20 },
      { name: "Right Mid-Range", zoneId: "MID_RIGHT", type: "Pull-Up", targetMakes: 20 },
      { name: "Three Pointers", zoneId: "THREE_TOP", type: "Catch & Shoot", targetMakes: 50 },
      { name: "Free Throws", zoneId: "FREE_THROW", type: "Free Throw", targetMakes: 25 },
    ],
  },
  {
    id: "sniper",
    name: "Sniper Day",
    desc: "High volume perimeter shooting.",
    isStructured: true,
    drills: [
      { name: "Form Shooting", zoneId: "PAINT", type: "Form", targetMakes: 50 },
      { name: "Corners", zoneId: "THREE_LEFT_CORNER", type: "Catch & Shoot", targetMakes: 50 },
      { name: "Wings", zoneId: "THREE_LEFT_WING", type: "Catch & Shoot", targetMakes: 50 },
      { name: "Top of Key", zoneId: "THREE_TOP", type: "Catch & Shoot", targetMakes: 25 },
      { name: "Free Throws", zoneId: "FREE_THROW", type: "Free Throw", targetMakes: 30 },
    ],
  },
  {
    id: "pressure",
    name: "Pressure Shooter",
    desc: "Miss 2 in a row = reset current drill to 0.",
    isStructured: true,
    specialRule: "pressure",
    drills: [
      { name: "Corner Pressure", zoneId: "THREE_RIGHT_CORNER", type: "Catch & Shoot", targetMakes: 10 },
      { name: "Wing Pressure", zoneId: "THREE_RIGHT_WING", type: "Catch & Shoot", targetMakes: 10 },
      { name: "Top Pressure", zoneId: "THREE_TOP", type: "Catch & Shoot", targetMakes: 10 },
    ],
  },
  {
    id: "pro_morning",
    name: "Pro Morning Workout",
    desc: "The ultimate daily grind.",
    isStructured: true,
    drills: [
      { name: "Phase 1: Form", zoneId: "PAINT", type: "Form", targetMakes: 50 },
      { name: "Phase 2: Finishes", zoneId: "PAINT", type: "Layup", targetMakes: 40 },
      { name: "Phase 3: Mid-Range", zoneId: "MID_TOP", type: "Pull-Up", targetMakes: 40 },
      { name: "Phase 4: Threes", zoneId: "THREE_TOP", type: "Catch & Shoot", targetMakes: 50 },
      { name: "Phase 5: Free Throws", zoneId: "FREE_THROW", type: "Free Throw", targetMakes: 20 },
    ],
  },
];

const viewTabs = [
  { id: "dashboard", label: "Home", icon: "barChart" },
  { id: "setup", label: "Workouts", icon: "target" },
  { id: "card", label: "Player Card", icon: "trophy" },
];

function getTemplateById(id, customTemplates) {
  return [...BUILT_IN_TEMPLATES, ...customTemplates].find((template) => template.id === id);
}

function getPercent(makes, total) {
  return total > 0 ? Math.round((makes / total) * 100) : 0;
}

function getRimZoneFromPoints(points) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const [a, b] = points;
  const left = Math.min(a.x, b.x);
  const right = Math.max(a.x, b.x);
  const centerX = (a.x + b.x) / 2;
  const centerY = (a.y + b.y) / 2;
  const width = Math.max(0.08, right - left);
  return { centerX, centerY, left: centerX - width / 2, right: centerX + width / 2, top: centerY - width * 0.18, bottom: centerY + width * 0.38, width };
}

function StatPill({ label, value, accent = colors.accent }) {
  return (
    <div style={{ flex: 1, padding: 12, borderRadius: radii.lg, background: "rgba(255,255,255,0.05)", border: `1px solid ${colors.border}` }}>
      <p style={{ ...typeScale.caption, color: colors.textMuted, margin: 0, textTransform: "uppercase", fontWeight: 800 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 900, color: accent, margin: "3px 0 0" }}>{value}</p>
    </div>
  );
}

function SelectField({ label, value, onChange, children }) {
  return (
    <label style={{ display: "grid", gap: 6, flex: 1 }}>
      <span style={{ ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase" }}>{label}</span>
      <select
        value={value}
        onChange={onChange}
        style={{ width: "100%", minWidth: 0, padding: 12, borderRadius: radii.md, border: `1px solid ${colors.border}`, background: colors.surfaceElevated, color: colors.textPrimary, fontWeight: 800 }}
      >
        {children}
      </select>
    </label>
  );
}

export function BasketballScreen({ onExit }) {
  const [currentView, setCurrentView] = useState("dashboard");
  const [history, setHistory] = useState([]);
  const [customTemplates, setCustomTemplates] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [playerName, setPlayerName] = useState("KingFizz");
  const [customName, setCustomName] = useState("My Custom Workout");
  const [customDrills, setCustomDrills] = useState([{ name: "Drill 1", zoneId: "THREE_TOP", type: "Catch & Shoot", targetMakes: 10 }]);
  const [cameraMode, setCameraMode] = useState(false);
  const [cameraStatus, setCameraStatus] = useState("Camera tracking is off.");
  const [rimPoints, setRimPoints] = useState([]);
  const [autoEvent, setAutoEvent] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);
  const rimPointsRef = useRef([]);
  const cameraModeRef = useRef(false);
  const trackerRef = useRef({ centers: [], phase: "idle", hasBeenAboveRim: false, lastLoggedAt: 0, cooldownStartedAt: 0 });

  useEffect(() => {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (!savedData) return;
      const parsed = JSON.parse(savedData);
      setHistory(Array.isArray(parsed.history) ? parsed.history : []);
      setCustomTemplates(Array.isArray(parsed.customTemplates) ? parsed.customTemplates : []);
      if (parsed.playerName) setPlayerName(parsed.playerName);
    } catch (error) {
      console.warn("Failed to load hoop tracker data", error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ history, customTemplates, playerName }));
  }, [history, customTemplates, playerName]);

  useEffect(() => {
    rimPointsRef.current = rimPoints;
  }, [rimPoints]);

  useEffect(() => {
    if (!cameraMode || !streamRef.current || !videoRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch((error) => {
      setCameraStatus(error?.message || "Tap the video preview to start camera playback.");
    });
  }, [cameraMode]);

  useEffect(() => () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const stats = useMemo(() => {
    const allShots = history.flatMap((session) => (Array.isArray(session.shots) ? session.shots : []));

    const calculateZoneStats = (zoneType, specificZoneId = null) => {
      const shots = allShots.filter((shot) => {
        if (specificZoneId) return shot.zoneId === specificZoneId;
        return ZONES[shot.zoneId]?.type === zoneType || (zoneType === "ft" && shot.type === "Free Throw");
      });
      const makes = shots.filter((shot) => shot.result === "make").length;
      const total = shots.length;
      const percentage = getPercent(makes, total);

      let rating = 40;
      if (total > 10) {
        if (zoneType === "three") rating = 40 + percentage * 1.2;
        if (zoneType === "mid") rating = 40 + percentage;
        if (zoneType === "finishing") rating = 40 + percentage * 0.7;
        if (zoneType === "ft") rating = 40 + percentage * 0.6;
      } else if (total > 0) {
        rating = 50;
      } else {
        return { makes: 0, total: 0, percentage: 0, rating: 0 };
      }
      return { makes, total, percentage, rating: Math.min(99, Math.round(rating)) };
    };

    const three = calculateZoneStats("three");
    const mid = calculateZoneStats("mid");
    const finishing = calculateZoneStats("finishing");
    const ft = calculateZoneStats("ft");

    let weakestSpot = null;
    let lowestPct = 100;
    Object.keys(ZONES).forEach((zoneId) => {
      const zoneStats = calculateZoneStats(null, zoneId);
      if (zoneStats.total >= 15 && zoneStats.percentage < lowestPct && zoneStats.percentage > 0) {
        lowestPct = zoneStats.percentage;
        weakestSpot = { ...ZONES[zoneId], percentage: lowestPct };
      }
    });

    const recommendedWorkout = weakestSpot
      ? {
          id: "ai_adaptive",
          name: "Coach: Weakness Focus",
          desc: `You're shooting ${weakestSpot.percentage}% from ${weakestSpot.name}. Let's fix that.`,
          isStructured: true,
          isAdaptive: true,
          drills: [
            { name: "Warmup Form", zoneId: "PAINT", type: "Form", targetMakes: 20 },
            { name: `${weakestSpot.name} Reps`, zoneId: weakestSpot.id, type: "Catch & Shoot", targetMakes: 30 },
            { name: `${weakestSpot.name} Pull-Ups`, zoneId: weakestSpot.id, type: "Pull-Up", targetMakes: 20 },
            { name: "Free Throws", zoneId: "FREE_THROW", type: "Free Throw", targetMakes: 15 },
          ],
        }
      : null;

    let archetype = "Developing Player";
    if (allShots.length > 30) {
      if (three.rating > 80 && finishing.rating < 70) archetype = "Sharpshooter";
      else if (finishing.rating > 80 && three.rating < 65) archetype = "Slasher";
      else if (three.rating > 75 && finishing.rating > 75) archetype = "Three-Level Scorer";
      else if (three.percentage > 35 && allShots.filter((shot) => shot.type === "Catch & Shoot").length > allShots.length * 0.4) archetype = "3&D Wing";
      else if (mid.rating > 80) archetype = "Mid-Range Maestro";
      else archetype = "Shot Creator";
    }

    const activeRatings = [three.rating, mid.rating, finishing.rating, ft.rating].filter(Boolean);
    const overall = activeRatings.length ? Math.round(activeRatings.reduce((sum, rating) => sum + rating, 0) / activeRatings.length) : 0;
    return { allShots, three, mid, finishing, ft, overall, archetype, weakestSpot, recommendedWorkout };
  }, [history]);

  const startSession = (template) => {
    setActiveSession({
      id: Date.now(),
      date: new Date().toISOString(),
      templateId: template.id,
      templateName: template.name,
      isStructured: template.isStructured,
      drills: template.drills || [],
      currentDrillIndex: 0,
      consecutiveMisses: 0,
      shots: [],
      currentZone: "THREE_TOP",
      currentType: "Catch & Shoot",
    });
    setCurrentView("workout");
  };

  const recordShot = (result, source = cameraMode ? "camera" : "manual") => {
    setActiveSession((previous) => {
      if (!previous) return previous;
      const isStructured = previous.isStructured;
      const drillIndex = previous.currentDrillIndex;
      const currentDrill = isStructured ? previous.drills[drillIndex] : null;
      if (isStructured && !currentDrill) return previous;
      if (isStructured) {
        const currentDrillMakes = previous.shots.filter((shot) => shot.drillIndex === drillIndex && shot.result === "make").length;
        if (currentDrillMakes >= currentDrill.targetMakes) return previous;
      }
      const zoneId = isStructured ? currentDrill.zoneId : previous.currentZone;
      const type = isStructured ? currentDrill.type : previous.currentType;
      const newShot = { id: Date.now(), zoneId, type, result, source, drillIndex: isStructured ? drillIndex : null, timestamp: new Date().toISOString() };
      let newShots = [...previous.shots, newShot];
      let consecutiveMisses = previous.consecutiveMisses;
      const template = getTemplateById(previous.templateId, customTemplates);

      if (template?.specialRule === "pressure" && isStructured) {
        if (result === "miss") {
          consecutiveMisses += 1;
          if (consecutiveMisses >= 2) {
            newShots = newShots.filter((shot) => shot.drillIndex !== drillIndex);
            consecutiveMisses = 0;
          }
        } else {
          consecutiveMisses = 0;
        }
      }

      return { ...previous, shots: newShots, consecutiveMisses };
    });
  };

  const undoLastShot = () => {
    setActiveSession((previous) => {
      if (!previous?.shots?.length) return previous;
      const lastShot = previous.shots[previous.shots.length - 1];
      return {
        ...previous,
        shots: previous.shots.slice(0, -1),
        consecutiveMisses: lastShot.result === "miss" ? Math.max(0, previous.consecutiveMisses - 1) : previous.consecutiveMisses,
      };
    });
    setAutoEvent(null);
  };

  const stopCamera = useCallback(() => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    cameraModeRef.current = false;
    setCameraMode(false);
    setCameraStatus("Camera tracking is off.");
    trackerRef.current = { centers: [], phase: "idle", hasBeenAboveRim: false, lastLoggedAt: 0, cooldownStartedAt: 0 };
  }, []);

  const rimZone = useMemo(() => getRimZoneFromPoints(rimPoints), [rimPoints]);

  const handleAutoResult = useCallback((result, confidence = 0.75) => {
    const now = Date.now();
    if (now - trackerRef.current.lastLoggedAt < 1800) return;
    trackerRef.current.lastLoggedAt = now;
    setAutoEvent({ result, confidence, timestamp: now });
    recordShot(result, "camera");
  }, [recordShot]);

  const processCameraFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const rim = getRimZoneFromPoints(rimPointsRef.current);
    if (!cameraModeRef.current) return;
    if (!video || !canvas || video.readyState < 2) {
      animationRef.current = requestAnimationFrame(processCameraFrame);
      return;
    }

    const width = 320;
    const height = Math.round(width * ((video.videoHeight || 720) / (video.videoWidth || 1280)));
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);
    let count = 0;
    let sumX = 0;
    let sumY = 0;

    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r > 120 && g > 45 && g < 190 && b < 135 && r > g * 1.15 && r > b * 1.55) {
          count += 1;
          sumX += x;
          sumY += y;
        }
      }
    }

    if (count > 8) {
      const center = { x: sumX / count / width, y: sumY / count / height, t: performance.now() };
      const tracker = trackerRef.current;
      tracker.centers = [...tracker.centers.slice(-7), center];
      const previous = tracker.centers[tracker.centers.length - 2];
      if (previous && rim) {
        const dy = center.y - previous.y;
        const nearRimHorizontally = center.x > rim.left - rim.width * 0.65 && center.x < rim.right + rim.width * 0.65;
        if (tracker.phase === "idle" && center.y > rim.centerY + rim.width * 0.25 && dy < -0.012) {
          tracker.phase = "rising";
          tracker.hasBeenAboveRim = false;
          setCameraStatus("Shot detected: tracking arc...");
        }
        if (tracker.phase === "rising" && center.y < rim.top) {
          tracker.hasBeenAboveRim = true;
        }
        if (tracker.phase === "rising" && tracker.hasBeenAboveRim && dy > 0.008) {
          tracker.phase = "descending";
        }
        if (tracker.phase === "descending" && nearRimHorizontally && previous.y < rim.centerY && center.y >= rim.centerY) {
          const makeWindow = Math.abs(center.x - rim.centerX) < rim.width * 0.28;
          handleAutoResult(makeWindow ? "make" : "miss", makeWindow ? 0.84 : 0.72);
          setCameraStatus(makeWindow ? "Auto logged MAKE." : "Auto logged MISS.");
          tracker.phase = "cooldown";
          tracker.cooldownStartedAt = performance.now();
        }
        if (tracker.phase === "descending" && center.y > rim.bottom + rim.width * 1.4) {
          handleAutoResult("miss", 0.68);
          setCameraStatus("Auto logged MISS.");
          tracker.phase = "cooldown";
          tracker.cooldownStartedAt = performance.now();
        }
        if (tracker.phase === "cooldown" && performance.now() - tracker.cooldownStartedAt > 1400) {
          tracker.phase = "idle";
          tracker.hasBeenAboveRim = false;
        }
      }
    }

    animationRef.current = requestAnimationFrame(processCameraFrame);
  }, [handleAutoResult]);

  const startCamera = useCallback(async () => {
    try {
      if (typeof window !== "undefined" && window.isSecureContext === false && !["localhost", "127.0.0.1"].includes(window.location.hostname)) {
        setCameraStatus("Camera requires HTTPS or localhost in most browsers.");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraStatus("Camera access is not supported in this browser.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      cameraModeRef.current = true;
      setCameraMode(true);
      setCameraStatus(rimPoints.length === 2 ? "Camera tracking is ready." : "Tap the left and right rim edges before shooting.");
      trackerRef.current = { centers: [], phase: "idle", hasBeenAboveRim: false, lastLoggedAt: 0, cooldownStartedAt: 0 };
      animationRef.current = requestAnimationFrame(processCameraFrame);
    } catch (error) {
      setCameraStatus(error?.message || "Could not start camera.");
    }
  }, [processCameraFrame, rimPoints.length]);

  const resetRimCalibration = () => {
    setRimPoints([]);
    setCameraStatus("Tap the left rim edge, then the right rim edge.");
    trackerRef.current = { centers: [], phase: "idle", hasBeenAboveRim: false, lastLoggedAt: 0, cooldownStartedAt: 0 };
  };

  const handleRimTap = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
    setRimPoints((previous) => {
      const next = previous.length >= 2 ? [point] : [...previous, point];
      setCameraStatus(next.length === 1 ? "Now tap the right rim edge." : "Rim set. Start shooting when ready.");
      return next;
    });
  };

  const advanceDrill = () => {
    setActiveSession((previous) => (previous ? { ...previous, currentDrillIndex: previous.currentDrillIndex + 1, consecutiveMisses: 0 } : previous));
  };

  const endSession = () => {
    stopCamera();
    if (activeSession?.shots?.length > 0) {
      setHistory((previous) => [activeSession, ...previous]);
    }
    setActiveSession(null);
    setCurrentView("dashboard");
  };

  const saveCustomTemplate = () => {
    const safeName = customName.trim() || "My Custom Workout";
    const newTemplate = {
      id: `custom_${Date.now()}`,
      name: safeName,
      desc: "Custom programme.",
      isStructured: true,
      drills: customDrills.map((drill, index) => ({ ...drill, name: drill.name || `Drill ${index + 1}`, targetMakes: Math.max(1, Number(drill.targetMakes) || 10) })),
    };
    setCustomTemplates((previous) => [...previous, newTemplate]);
    setCurrentView("setup");
    setCustomName("My Custom Workout");
    setCustomDrills([{ name: "Drill 1", zoneId: "THREE_TOP", type: "Catch & Shoot", targetMakes: 10 }]);
  };

  const updateCustomDrill = (index, patch) => {
    setCustomDrills((previous) => previous.map((drill, drillIndex) => (drillIndex === index ? { ...drill, ...patch } : drill)));
  };

  const dashboard = (
    <div style={{ display: "grid", gap: 18, padding: "calc(env(safe-area-inset-top, 0px) + 24px) 18px 28px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <p style={{ ...typeScale.overline, color: "#FF9F1C", textTransform: "uppercase", margin: "0 0 4px" }}>Hoop Tracker Pro</p>
          <h1 style={{ fontSize: 28, lineHeight: 1.05, fontWeight: 900, color: colors.textPrimary, margin: 0 }}>Welcome back, {playerName}</h1>
        </div>
        {onExit && <button onClick={onExit} style={{ border: `1px solid ${colors.border}`, borderRadius: radii.pill, padding: "9px 12px", background: colors.surface, color: colors.textSecondary, fontWeight: 900, cursor: "pointer" }}>Gym</button>}
      </div>

      <div style={{ padding: 18, borderRadius: radii.xl, background: stats.recommendedWorkout ? "linear-gradient(135deg, rgba(88,80,236,0.95), rgba(141,71,225,0.88))" : "rgba(255,255,255,0.06)", border: `1px solid ${stats.recommendedWorkout ? "rgba(255,255,255,0.18)" : colors.border}` }}>
        <p style={{ ...typeScale.overline, color: stats.recommendedWorkout ? "#DDD6FE" : colors.textMuted, margin: "0 0 8px", textTransform: "uppercase" }}>Adaptive Coaching</p>
        <h2 style={{ fontSize: 20, margin: "0 0 6px", color: colors.textPrimary }}>{stats.recommendedWorkout?.name || "Build Your Shot Profile"}</h2>
        <p style={{ ...typeScale.bodySm, color: stats.recommendedWorkout ? "rgba(255,255,255,0.82)" : colors.textSecondary, margin: "0 0 14px" }}>{stats.recommendedWorkout?.desc || "Complete more workouts to unlock personalised weakness analysis and coach-built programmes."}</p>
        {stats.recommendedWorkout && (
          <button onClick={() => startSession(stats.recommendedWorkout)} style={{ border: 0, borderRadius: radii.md, padding: "10px 14px", fontWeight: 900, color: "#3B0764", background: "#fff", cursor: "pointer" }}>Start Programme</button>
        )}
      </div>

      <div style={{ padding: 18, borderRadius: radii.xl, background: colors.surface, border: `1px solid ${colors.border}` }}>
        <p style={{ ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase", margin: "0 0 5px" }}>Your Archetype</p>
        <h2 style={{ fontSize: 24, color: "#FF9F1C", margin: "0 0 18px", fontWeight: 900 }}>{stats.archetype}</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <StatPill label="3PT %" value={`${stats.three.percentage}%`} accent="#FF9F1C" />
          <StatPill label="Mid %" value={`${stats.mid.percentage}%`} />
          <StatPill label="Overall" value={stats.overall || "—"} accent="#3DDC97" />
        </div>
      </div>

      <button onClick={() => setCurrentView("setup")} style={{ width: "100%", padding: 16, border: 0, borderRadius: radii.lg, background: "#FF7A1A", color: "#fff", fontSize: 16, fontWeight: 900, boxShadow: "0 14px 35px rgba(255,122,26,0.28)", cursor: "pointer" }}>VIEW TEMPLATES</button>
    </div>
  );

  const setup = (
    <div style={{ display: "grid", gap: 16, padding: "calc(env(safe-area-inset-top, 0px) + 24px) 18px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <button onClick={() => setCurrentView("dashboard")} style={{ border: 0, borderRadius: radii.pill, width: 40, height: 40, background: colors.surface, color: colors.textPrimary, cursor: "pointer" }}><Icon name="chevronLeft" /></button>
        <h1 style={{ flex: 1, fontSize: 26, fontWeight: 900, margin: 0 }}>Workouts</h1>
        <button onClick={() => setCurrentView("builder")} style={{ border: `1px solid rgba(255,122,26,0.32)`, borderRadius: radii.pill, padding: "10px 12px", background: "rgba(255,122,26,0.1)", color: "#FF9F1C", fontWeight: 900, cursor: "pointer" }}>+ Build</button>
      </div>
      {[...BUILT_IN_TEMPLATES, ...customTemplates].map((template) => (
        <button key={template.id} onClick={() => startSession(template)} style={{ textAlign: "left", padding: 16, borderRadius: radii.xl, background: colors.surface, color: colors.textPrimary, border: `1px solid ${colors.border}`, cursor: "pointer" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 5px" }}>{template.name}</h2>
              <p style={{ ...typeScale.bodySm, color: colors.textSecondary, margin: 0 }}>{template.desc}</p>
            </div>
            <span style={{ width: 34, height: 34, borderRadius: radii.pill, background: "rgba(255,122,26,0.13)", color: "#FF9F1C", display: "grid", placeItems: "center", fontWeight: 900 }}>▶</span>
          </div>
          {template.isStructured && <p style={{ ...typeScale.caption, display: "inline-block", margin: "12px 0 0", padding: "5px 8px", borderRadius: radii.pill, color: colors.textMuted, background: "rgba(255,255,255,0.06)" }}>{template.drills?.length || 0} drills</p>}
        </button>
      ))}
    </div>
  );

  const playerCard = (
    <div style={{ display: "grid", gap: 18, padding: "calc(env(safe-area-inset-top, 0px) + 24px) 18px 28px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>Player Card</h1>
        <button onClick={() => setPlayerName(window.prompt("Enter Player Name:", playerName) || playerName)} style={{ background: "none", border: 0, color: "#FF9F1C", fontWeight: 900, cursor: "pointer" }}>Edit</button>
      </div>
      <div style={{ padding: 20, borderRadius: 28, background: "linear-gradient(145deg, #111827, #0F172A 55%, #111827)", border: `1px solid ${colors.borderStrong}`, color: "#fff", position: "relative", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, paddingBottom: 16, marginBottom: 16, borderBottom: `1px solid ${colors.border}` }}>
          <div>
            <p style={{ ...typeScale.overline, color: "#FF9F1C", textTransform: "uppercase", margin: "0 0 6px" }}>{stats.archetype}</p>
            <h2 style={{ fontSize: 30, lineHeight: 1, fontWeight: 900, margin: 0 }}>{playerName}</h2>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 48, lineHeight: 0.9, fontWeight: 900, margin: 0 }}>{stats.overall || "--"}</p>
            <p style={{ ...typeScale.caption, color: colors.textMuted, margin: 0, textTransform: "uppercase" }}>Overall</p>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[
            { label: "FINISHING", val: stats.finishing.rating },
            { label: "MID-RANGE", val: stats.mid.rating },
            { label: "THREE POINT", val: stats.three.rating },
            { label: "FREE THROW", val: stats.ft.rating },
          ].map((attr) => (
            <div key={attr.label}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 900, color: colors.textSecondary }}><span>{attr.label}</span><span style={{ color: attr.val >= 80 ? "#3DDC97" : "#fff" }}>{attr.val || "--"}</span></div>
              <div style={{ height: 6, borderRadius: radii.pill, background: "rgba(255,255,255,0.12)", marginTop: 5, overflow: "hidden" }}><div style={{ height: "100%", width: `${attr.val || 0}%`, background: "#FF7A1A" }} /></div>
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", right: -28, bottom: -34, opacity: 0.07 }}><Icon name="trophy" size={150} color="#fff" /></div>
      </div>
      {stats.weakestSpot && <div style={{ padding: 14, borderRadius: radii.lg, background: "rgba(141,71,225,0.12)", border: "1px solid rgba(141,71,225,0.22)", color: "#DDD6FE" }}><strong>Scouting Report:</strong> defenses will force shots from {stats.weakestSpot.name} ({stats.weakestSpot.percentage}%). Focus training here.</div>}
    </div>
  );

  const builder = (
    <div style={{ display: "grid", gap: 16, padding: "calc(env(safe-area-inset-top, 0px) + 24px) 18px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => setCurrentView("setup")} style={{ border: 0, borderRadius: radii.pill, width: 40, height: 40, background: colors.surface, color: colors.textPrimary, cursor: "pointer" }}><Icon name="chevronLeft" /></button>
        <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>Builder</h1>
      </div>
      <input value={customName} onChange={(event) => setCustomName(event.target.value)} style={{ width: "100%", background: "transparent", border: 0, borderBottom: `2px solid ${colors.borderStrong}`, color: colors.textPrimary, padding: "8px 0 12px", fontSize: 22, fontWeight: 900, outline: "none" }} />
      {customDrills.map((drill, index) => (
        <div key={`${drill.name}-${index}`} style={{ display: "grid", gap: 11, padding: 14, borderRadius: radii.lg, background: colors.surface, border: `1px solid ${colors.border}` }}>
          <p style={{ ...typeScale.bodySm, fontWeight: 900, margin: 0 }}>Drill {index + 1}</p>
          <input value={drill.name} onChange={(event) => updateCustomDrill(index, { name: event.target.value })} style={{ width: "100%", padding: 11, borderRadius: radii.md, border: `1px solid ${colors.border}`, background: colors.surfaceElevated, color: colors.textPrimary, fontWeight: 800 }} />
          <SelectField label="Spot" value={drill.zoneId} onChange={(event) => updateCustomDrill(index, { zoneId: event.target.value })}>{Object.entries(ZONES).map(([key, zone]) => <option key={key} value={key}>{zone.name}</option>)}</SelectField>
          <div style={{ display: "flex", gap: 8 }}>
            <SelectField label="Shot" value={drill.type} onChange={(event) => updateCustomDrill(index, { type: event.target.value })}>{SHOT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</SelectField>
            <label style={{ display: "grid", gap: 6, flex: 1 }}><span style={{ ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase" }}>Makes</span><input type="number" min="1" value={drill.targetMakes} onChange={(event) => updateCustomDrill(index, { targetMakes: event.target.value })} style={{ width: "100%", padding: 12, borderRadius: radii.md, border: `1px solid ${colors.border}`, background: colors.surfaceElevated, color: colors.textPrimary, fontWeight: 800 }} /></label>
          </div>
        </div>
      ))}
      <button onClick={() => setCustomDrills((previous) => [...previous, { name: `Drill ${previous.length + 1}`, zoneId: "PAINT", type: "Layup", targetMakes: 10 }])} style={{ padding: 14, borderRadius: radii.lg, border: `2px dashed ${colors.borderStrong}`, background: "transparent", color: colors.textSecondary, fontWeight: 900, cursor: "pointer" }}>+ Add Drill</button>
      <button onClick={saveCustomTemplate} style={{ padding: 16, borderRadius: radii.lg, border: 0, background: "#FF7A1A", color: "#fff", fontWeight: 900, cursor: "pointer" }}>SAVE PROGRAMME</button>
    </div>
  );

  const workout = activeSession ? (() => {
    const isStructured = activeSession.isStructured;
    const sessionShots = activeSession.shots || [];
    const drillIndex = activeSession.currentDrillIndex;
    const isWorkoutComplete = isStructured && drillIndex >= activeSession.drills.length;
    const currentDrill = isStructured && !isWorkoutComplete ? activeSession.drills[drillIndex] : null;
    const currentZoneShots = sessionShots.filter((shot) => shot.zoneId === activeSession.currentZone && shot.type === activeSession.currentType);
    const freeMakes = currentZoneShots.filter((shot) => shot.result === "make").length;
    const freeTotal = currentZoneShots.length;
    const drillShots = isStructured && currentDrill ? sessionShots.filter((shot) => shot.drillIndex === drillIndex) : [];
    const drillMakes = drillShots.filter((shot) => shot.result === "make").length;
    const totalMakes = sessionShots.filter((shot) => shot.result === "make").length;
    const totalShots = sessionShots.length;
    const pressureMode = getTemplateById(activeSession.templateId, customTemplates)?.specialRule === "pressure";

    if (isWorkoutComplete) {
      return (
        <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          <div>
            <Icon name="trophy" size={82} color="#FF9F1C" />
            <h1 style={{ fontSize: 38, lineHeight: 1, fontWeight: 950, margin: "20px 0 8px" }}>WORKOUT COMPLETE</h1>
            <p style={{ color: colors.textSecondary, margin: "0 0 24px" }}>Great job. Your stats have been updated.</p>
            <div style={{ display: "flex", gap: 10, marginBottom: 24 }}><StatPill label="Makes" value={`${totalMakes}/${totalShots}`} /><StatPill label="Percent" value={`${getPercent(totalMakes, totalShots)}%`} accent="#FF9F1C" /></div>
            <button onClick={endSession} style={{ width: "100%", padding: 16, borderRadius: radii.lg, border: 0, background: "#FF7A1A", color: "#fff", fontWeight: 900, cursor: "pointer" }}>SAVE & RETURN</button>
          </div>
        </div>
      );
    }

    return (
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "#07070B" }}>
        <div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", background: colors.surface, borderBottom: `1px solid ${colors.border}` }}>
          <p style={{ ...typeScale.overline, color: colors.textMuted, margin: 0, textTransform: "uppercase" }}>{isStructured ? `Drill ${drillIndex + 1} of ${activeSession.drills.length}` : "Free Shoot"}</p>
          <button onClick={endSession} style={{ border: 0, borderRadius: radii.pill, background: "rgba(255,93,93,0.12)", color: "#FF9A9A", padding: "9px 12px", fontWeight: 900, cursor: "pointer" }}>END EARLY</button>
        </div>

        <div style={{ padding: 12, background: "rgba(255,255,255,0.025)", borderBottom: `1px solid ${colors.border}` }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", marginBottom: cameraMode ? 10 : 0 }}>
            <button onClick={cameraMode ? stopCamera : startCamera} style={{ flex: 1, border: `1px solid ${cameraMode ? "rgba(255,93,93,0.32)" : "rgba(255,122,26,0.35)"}`, borderRadius: radii.pill, background: cameraMode ? "rgba(255,93,93,0.12)" : "rgba(255,122,26,0.12)", color: cameraMode ? "#FFB4B4" : "#FF9F1C", padding: "10px 12px", fontWeight: 950, cursor: "pointer" }}>
              {cameraMode ? "Stop Camera Tracking" : "Camera Tracking Beta"}
            </button>
            <button onClick={undoLastShot} disabled={!sessionShots.length} style={{ border: `1px solid ${colors.border}`, borderRadius: radii.pill, background: "rgba(255,255,255,0.05)", color: sessionShots.length ? colors.textPrimary : colors.textMuted, padding: "10px 12px", fontWeight: 900, cursor: sessionShots.length ? "pointer" : "not-allowed" }}>Undo</button>
          </div>
          {cameraMode && (
            <div>
              <div onClick={handleRimTap} style={{ position: "relative", overflow: "hidden", borderRadius: radii.lg, border: `1px solid ${rimPoints.length === 2 ? "rgba(61,220,151,0.38)" : "rgba(255,122,26,0.38)"}`, background: "#000", aspectRatio: "16 / 9", cursor: "crosshair" }}>
                <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                <canvas ref={canvasRef} style={{ display: "none" }} />
                <svg viewBox="0 0 1 1" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
                  {rimPoints.map((point, index) => <circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r="0.018" fill={index === 0 ? "#3DDC97" : "#FF9F1C"} />)}
                  {rimPoints.length === 2 && (
                    <>
                      <line x1={rimPoints[0].x} y1={rimPoints[0].y} x2={rimPoints[1].x} y2={rimPoints[1].y} stroke="#FF9F1C" strokeWidth="0.01" />
                      {rimZone && <rect x={rimZone.left} y={rimZone.top} width={rimZone.width} height={rimZone.bottom - rimZone.top} fill="rgba(255,159,28,0.15)" stroke="#FF9F1C" strokeWidth="0.006" />}
                    </>
                  )}
                </svg>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginTop: 8 }}>
                <p style={{ ...typeScale.caption, color: colors.textSecondary, margin: 0 }}>{cameraStatus}</p>
                <button onClick={resetRimCalibration} style={{ border: 0, borderRadius: radii.pill, background: "rgba(255,255,255,0.08)", color: colors.textPrimary, padding: "7px 10px", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" }}>Set Rim</button>
              </div>
              {autoEvent && <p style={{ ...typeScale.caption, margin: "6px 0 0", color: autoEvent.result === "make" ? colors.success : colors.danger }}>Last auto log: {autoEvent.result.toUpperCase()} · {Math.round(autoEvent.confidence * 100)}% confidence</p>}
            </div>
          )}
        </div>

        {isStructured ? (
          <div style={{ padding: 22, textAlign: "center", borderBottom: `1px solid ${colors.border}`, background: "rgba(255,255,255,0.03)" }}>
            {pressureMode && activeSession.consecutiveMisses > 0 && <p style={{ margin: "0 0 8px", color: colors.danger, fontWeight: 950, letterSpacing: "0.08em" }}>⚠ 1 MISS... DANGER!</p>}
            <h2 style={{ fontSize: 25, color: "#FF9F1C", fontWeight: 950, margin: "0 0 4px" }}>{currentDrill.name}</h2>
            <p style={{ ...typeScale.bodySm, color: colors.textSecondary, margin: "0 0 18px" }}>{ZONES[currentDrill.zoneId]?.name} • {currentDrill.type}</p>
            <div style={{ maxWidth: 340, margin: "0 auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: colors.textMuted, fontSize: 11, fontWeight: 900, marginBottom: 7 }}><span>PROGRESS</span><span style={{ color: drillMakes >= currentDrill.targetMakes ? colors.success : colors.textPrimary }}>{drillMakes} / {currentDrill.targetMakes} Makes</span></div>
              <div style={{ height: 12, borderRadius: radii.pill, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}><div style={{ width: `${Math.min(100, (drillMakes / currentDrill.targetMakes) * 100)}%`, height: "100%", background: "#FF7A1A", transition: "width 180ms ease" }} /></div>
            </div>
            {drillMakes >= currentDrill.targetMakes && <button onClick={advanceDrill} style={{ marginTop: 18, border: 0, borderRadius: radii.pill, padding: "14px 20px", background: colors.success, color: "#04140D", fontWeight: 950, cursor: "pointer" }}>DRILL COMPLETE ›</button>}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, padding: 14, borderBottom: `1px solid ${colors.border}`, background: "rgba(255,255,255,0.03)" }}>
            <SelectField label="Spot" value={activeSession.currentZone} onChange={(event) => setActiveSession({ ...activeSession, currentZone: event.target.value })}>{Object.entries(ZONES).map(([key, zone]) => <option key={key} value={key}>{zone.name}</option>)}</SelectField>
            <SelectField label="Shot" value={activeSession.currentType} onChange={(event) => setActiveSession({ ...activeSession, currentType: event.target.value })}>{SHOT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</SelectField>
          </div>
        )}

        <div style={{ flex: 1, display: "grid", placeItems: "center", textAlign: "center", padding: 24 }}>
          {!isStructured && <div><p style={{ fontSize: 72, lineHeight: 1, fontWeight: 950, margin: 0 }}>{getPercent(freeMakes, freeTotal)}<span style={{ fontSize: 32, color: colors.textMuted }}>%</span></p><p style={{ color: colors.textSecondary, fontWeight: 900, margin: "8px 0 0" }}>{freeMakes} / {freeTotal}</p></div>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "8px 8px calc(env(safe-area-inset-bottom, 0px) + 8px)", minHeight: "38dvh" }}>
          <button onClick={() => recordShot("make", "manual")} disabled={isStructured && drillMakes >= currentDrill.targetMakes} style={{ border: 0, borderBottom: "8px solid #047857", borderRadius: 22, background: colors.success, color: "#062015", fontSize: 35, fontWeight: 950, cursor: "pointer", opacity: isStructured && drillMakes >= currentDrill.targetMakes ? 0.25 : 1 }}>MAKE</button>
          <button onClick={() => recordShot("miss", "manual")} disabled={isStructured && drillMakes >= currentDrill.targetMakes} style={{ border: 0, borderBottom: "8px solid #9F1239", borderRadius: 22, background: "#F43F5E", color: "#fff", fontSize: 35, fontWeight: 950, cursor: "pointer", opacity: isStructured && drillMakes >= currentDrill.targetMakes ? 0.25 : 1 }}>MISS</button>
        </div>
      </div>
    );
  })() : dashboard;

  return (
    <div style={{ minHeight: "100dvh", background: currentView === "workout" ? "#07070B" : colors.background, color: colors.textPrimary }}>
      {currentView === "dashboard" && dashboard}
      {currentView === "setup" && setup}
      {currentView === "builder" && builder}
      {currentView === "card" && playerCard}
      {currentView === "workout" && workout}
      {currentView !== "workout" && (
        <nav style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, display: "flex", justifyContent: "space-around", padding: "7px 0 env(safe-area-inset-bottom, 7px)", background: "rgba(10,10,15,0.94)", borderTop: `1px solid ${colors.border}`, backdropFilter: "blur(20px)", zIndex: 10 }}>
          {viewTabs.map((tab) => (
            <button key={tab.id} onClick={() => setCurrentView(tab.id)} style={{ border: 0, background: currentView === tab.id ? "rgba(255,122,26,0.14)" : "transparent", color: currentView === tab.id ? "#FF9F1C" : colors.textMuted, borderRadius: radii.pill, padding: "7px 13px", display: "grid", justifyItems: "center", gap: 2, cursor: "pointer" }}>
              <Icon name={tab.icon} size={20} />
              <span style={{ ...typeScale.caption }}>{tab.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
