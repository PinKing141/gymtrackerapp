import { useRef, useState } from "react";
import { Spark } from "../components/WorkoutComponents.jsx";
import { ConfirmModal } from "../components/ConfirmModal.jsx";
import { Icon, WaterGlassIcon } from "../components/icons.jsx";
import { ActionButton, BackButton, Screen, ScreenHeader, SurfaceCard, TextAreaField } from "../components/ui.jsx";
import { DangerRow, ProfileRow, SettingsField as Field, SettingsGroup as Group, SubScreenHeader as Header, Toggle } from "../components/ProfileSettings.jsx";
import { getPreferencesIncludedLabel, summarizeBackupData } from "../profileBackupPreview.js";
import { getBodyGoalsSummary, getDataSummary, getDisplayName, getEnabledModuleSummary, getGoalLabel, getInitials, getNextProfileAction, getNotificationSummary, getProfileCompletion, getProteinRange, getSyncSummary, getUnitLabel, getWeightLabel } from "../profileSummary.js";
import { PHASES, WQ } from "../data.js";
import { DB_BACKUP, DD, IS, dbSave, fd, isValidData, today, withDefaults } from "../storage.js";
import { haptic, playCue, unlockAudio } from "../services/sound.js";

const ACTIVITY_OPTIONS = [
  { value: "sedentary", label: "Sedentary", factor: 1.2 },
  { value: "light", label: "Lightly active", factor: 1.375 },
  { value: "moderate", label: "Moderately active", factor: 1.55 },
  { value: "high", label: "Very active", factor: 1.725 },
];

const GOAL_OPTIONS = [
  { value: "cut", label: "Fat loss", delta: -450 },
  { value: "maintain", label: "Maintain", delta: 0 },
  { value: "bulk", label: "Muscle gain", delta: 300 },
];

const CM_PER_INCH = 2.54;
const KG_PER_LB = 0.45359237;

function toInches(heightCm) {
  const cm = Number(heightCm);
  if (!cm) return 0;
  return cm / CM_PER_INCH;
}

function toFeetInches(heightCm) {
  const totalInches = Math.max(0, Math.round(toInches(heightCm)));
  return {
    feet: Math.floor(totalInches / 12),
    inches: totalInches % 12,
  };
}

function feetInchesToCm(feet, inches) {
  const ft = Number(feet) || 0;
  const inch = Number(inches) || 0;
  const totalInches = Math.max(0, (ft * 12) + inch);
  return Number((totalInches * CM_PER_INCH).toFixed(1));
}

function poundsToKg(pounds) {
  const lbs = Number(pounds);
  if (!lbs) return "";
  return Number((lbs * KG_PER_LB).toFixed(2));
}

function kgToPounds(weightKg) {
  const kg = Number(weightKg);
  if (!kg) return "";
  return Number((kg / KG_PER_LB).toFixed(1));
}

function calculateCalories(profile) {
  const age = Number(profile.age);
  const heightCm = Number(profile.heightCm);
  const weightKg = Number(profile.weightKg);
  if (!age || !heightCm || !weightKg) {
    return null;
  }

  const bmr = profile.sex === "female"
    ? (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161
    : (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
  const activityFactor = ACTIVITY_OPTIONS.find((option) => option.value === profile.activityLevel)?.factor || 1.55;
  const maintenance = Math.round(bmr * activityFactor);
  const goalDelta = GOAL_OPTIONS.find((option) => option.value === profile.goal)?.delta || 0;
  const target = Math.max(1200, maintenance + goalDelta);

  return { bmr: Math.round(bmr), maintenance, target };
}


const READINESS_SCALES = [
  {
    key: "recoveryState",
    label: "How recovered do you feel?",
    options: ["Excellent", "Good", "Average", "Heavy", "Drained"],
  },
  {
    key: "explosiveness",
    label: "How explosive did you feel?",
    options: ["Bouncy", "Sharp", "Normal", "Sluggish", "Flat"],
  },
  {
    key: "jointCondition",
    label: "How did your joints feel?",
    options: ["Perfect", "Slight stiffness", "Noticeable discomfort", "Affecting movement", "Painful"],
  },
  {
    key: "motivationState",
    label: "How motivated did you feel?",
    options: ["Locked in", "Focused", "Steady", "Low", "Flat"],
  },
  {
    key: "setQuality",
    label: "How did your top sets feel?",
    options: ["Explosive", "Smooth", "Challenging", "Slow", "Grind"],
  },
];

const SCORE_COLORS = ["#45B649", "#74D27F", "#F5A623", "#FF8A3D", "#E84545"];
export function MoreScreen({
  app,
  bodyStatsForm,
  closeSection,
  goBackSection,
  fileInputRef,
  getPhaseProgress,
  onExportData,
  onImportData,
  onOpenSection,
  firebaseUser,
  firestoreSync,
  onFirebaseSignOut,
  onResetAllData,
  onRestoreBackup,
  recoveryForm,
  reviewForm,
  sectionView,
  devicePrefs,
  notificationPermission,
  notificationSupported,
  serviceWorkerSupported,
  onRequestReminderPermission,
  onSendTestReminder,
  setApp,
  setBodyStatsForm,
  setDevicePrefs,
  setRecoveryForm,
  setReviewForm,
  streakSummary,
}) {
  const avatarInputRef = useRef(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importError, setImportError] = useState("");
  const [restorePreview, setRestorePreview] = useState(null);
  const profile = app.profile || {};
  const calorieStats = calculateCalories(profile);
  const unitSystem = profile.unitSystem || "imperial";
  const { feet: profileFeet, inches: profileInches } = toFeetInches(profile.heightCm);

  if (sectionView === "recovery" && recoveryForm) {
    return (
      <Screen>
        <ScreenHeader action={<BackButton onClick={closeSection} />} title="Recovery Log" subtitle={fd(today())} topPadding="calc(env(safe-area-inset-top, 0px) + 20px)" />

        <SurfaceCard>
          <p style={{ fontSize: 12, color: "#999", margin: "0 0 8px" }}>Sleep (hours)</p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input type="range" min="3" max="12" step="0.5" value={recoveryForm.sleep} onChange={(event) => setRecoveryForm((current) => ({ ...current, sleep: Number(event.target.value) }))} style={{ flex: 1, accentColor: "#2D7DD2" }} />
            <span style={{ fontSize: 18, fontWeight: 700, color: recoveryForm.sleep >= 8 ? "#45B649" : recoveryForm.sleep >= 7 ? "#F5A623" : "#E84545", minWidth: 36, textAlign: "right" }}>{recoveryForm.sleep}h</span>
          </div>
          <p style={{ fontSize: 9, color: "#444", marginTop: 4, marginBottom: 0 }}>Target: 8+ hours</p>
        </SurfaceCard>

        <SurfaceCard>
          <p style={{ fontSize: 12, color: "#999", margin: "0 0 8px" }}>Water (litres)</p>
          <p style={{ fontSize: 12, margin: "0 0 10px", color: "#8BA6C9", fontWeight: 700 }}>{recoveryForm.water.toFixed(1)} / 4.0L</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
            {Array.from({ length: 8 }, (_, index) => {
              const value = (index + 1) * 0.5;
              const active = value <= recoveryForm.water;
              return (
                <button
                  key={value}
                  onClick={() => setRecoveryForm((current) => ({ ...current, water: value }))}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
                >
                  <WaterGlassIcon size={32} level={active ? 1 : 0} color="#2D7DD2" />
                  <span style={{ fontSize: 10, color: active ? "#2D7DD2" : "#666" }}>{value.toFixed(1)}L</span>
                </button>
              );
            })}
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <button onClick={() => setRecoveryForm((current) => ({ ...current, mobilityDone: !current.mobilityDone }))} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#E8E6E1", padding: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: recoveryForm.mobilityDone ? "#45B649" : "#fff" }}>{recoveryForm.mobilityDone ? "✓ " : ""}Post-Session Mobility</span>
            <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${recoveryForm.mobilityDone ? "#45B649" : "#555"}`, background: recoveryForm.mobilityDone ? "#45B649" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>{recoveryForm.mobilityDone && <span style={{ color: "#000", fontSize: 12, fontWeight: 700 }}>✓</span>}</div>
          </button>
        </SurfaceCard>

        {READINESS_SCALES.map((scale) => (
          <SurfaceCard key={scale.key}>
            <p style={{ fontSize: 12, color: "#999", margin: "0 0 10px" }}>{scale.label}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 6 }}>
              {scale.options.map((option, index) => {
                const score = index + 1;
                const active = Number(recoveryForm[scale.key] || 3) === score;
                return (
                  <button
                    key={option}
                    onClick={() => setRecoveryForm((current) => ({ ...current, [scale.key]: score }))}
                    style={{ background: active ? `${SCORE_COLORS[index]}22` : "rgba(255,255,255,0.02)", border: `1px solid ${active ? SCORE_COLORS[index] : "rgba(255,255,255,0.08)"}`, borderRadius: 8, color: "#fff", fontSize: 10, padding: "8px 4px", cursor: "pointer" }}
                  >
                    <div style={{ fontWeight: 700, color: SCORE_COLORS[index] }}>{score}</div>
                    <div>{option}</div>
                  </button>
                );
              })}
            </div>
          </SurfaceCard>
        ))}

        <ActionButton onClick={() => { setApp((current) => { const nextRecovery = [...current.recovery]; const existingIndex = nextRecovery.findIndex((entry) => entry.date === recoveryForm.date); if (existingIndex >= 0) { nextRecovery[existingIndex] = recoveryForm; } else { nextRecovery.push(recoveryForm); } return { ...current, recovery: nextRecovery }; }); closeSection(); }} color="#2D7DD2" style={{ marginTop: 10 }}>
          Save
        </ActionButton>

        {app.recovery.length >= 2 && <SurfaceCard style={{ marginTop: 20 }}><p style={{ fontSize: 12, fontWeight: 600, color: "#fff", margin: "0 0 6px" }}>Sleep Trend</p><Spark data={app.recovery.slice(-14).map((entry) => entry.sleep)} color="#2D7DD2" height={36} /></SurfaceCard>}
      </Screen>
    );
  }

  if (sectionView === "bodystats" && bodyStatsForm) {
    return (
      <Screen>
        <ScreenHeader action={<BackButton onClick={closeSection} />} title="Body Stats" topPadding="calc(env(safe-area-inset-top, 0px) + 20px)" />
        <SurfaceCard style={{ marginTop: 20 }}>
          <p style={{ fontSize: 12, color: "#999", margin: "0 0 8px" }}>Bodyweight (lbs)</p>
          <input type="number" inputMode="decimal" value={bodyStatsForm.weight} onChange={(event) => setBodyStatsForm((current) => ({ ...current, weight: Number(event.target.value) }))} style={{ ...IS, fontSize: 22, textAlign: "center", padding: "14px" }} />
          <p style={{ fontSize: 9, color: "#444", marginTop: 6, marginBottom: 0 }}>Target: 201–220 lbs</p>
        </SurfaceCard>
        <ActionButton onClick={() => { setApp((current) => { const nextBodyStats = [...current.bodyStats]; const existingIndex = nextBodyStats.findIndex((entry) => entry.date === bodyStatsForm.date); if (existingIndex >= 0) { nextBodyStats[existingIndex] = bodyStatsForm; } else { nextBodyStats.push(bodyStatsForm); } return { ...current, bodyStats: nextBodyStats }; }); closeSection(); }} color="#F5A623" style={{ marginTop: 10 }}>
          Save
        </ActionButton>

        {app.bodyStats.length > 0 && (
          <SurfaceCard style={{ marginTop: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#fff", margin: "0 0 6px" }}>History</p>
            {app.bodyStats.length >= 2 && <Spark data={app.bodyStats.slice(-12).map((entry) => entry.weight)} color="#F5A623" height={36} />}
            <div style={{ marginTop: 8 }}>
              {[...app.bodyStats].reverse().slice(0, 8).map((entry) => <div key={entry.date} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}><span style={{ fontSize: 11, color: "#666" }}>{fd(entry.date)}</span><span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{entry.weight} lbs</span></div>)}
            </div>
          </SurfaceCard>
        )}
      </Screen>
    );
  }

  if (sectionView === "review" && reviewForm) {
    return (
      <Screen>
        <ScreenHeader action={<BackButton onClick={closeSection} />} title="Weekly Review" topPadding="calc(env(safe-area-inset-top, 0px) + 20px)" />

        {WQ.map((question, index) => (
          <SurfaceCard key={question} style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 12, color: "#F5A623", fontWeight: 600, margin: "0 0 8px" }}>{question}</p>
            <TextAreaField value={reviewForm[index]} onChange={(event) => { const nextAnswers = [...reviewForm]; nextAnswers[index] = event.target.value; setReviewForm(nextAnswers); }} placeholder="Your answer..." />
          </SurfaceCard>
        ))}

        <ActionButton onClick={() => { setApp((current) => ({ ...current, weeklyReviews: [...current.weeklyReviews, { date: today(), answers: reviewForm }] })); closeSection(); }} color="#F5A623" style={{ marginTop: 6 }}>
          Submit
        </ActionButton>

        {app.weeklyReviews.length > 0 && [...app.weeklyReviews].reverse().slice(0, 3).map((review, index) => (
          <SurfaceCard key={review.date} style={{ marginTop: index === 0 ? 16 : 0 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#fff", margin: 0 }}>{fd(review.date)}</p>
            {review.answers.map((answer, answerIndex) => answer ? <p key={`${review.date}-${answerIndex}`} style={{ fontSize: 11, color: "#888", margin: "4px 0 0" }}><span style={{ color: "#F5A623" }}>Q{answerIndex + 1}:</span> {answer}</p> : null)}
          </SurfaceCard>
        ))}
      </Screen>
    );
  }

  if (sectionView === "phase") {
    const { phase, week, deload } = getPhaseProgress();
    const started = Boolean(app.phaseStart);
    const active = PHASES[phase] || PHASES[0];
    const ringR = 30;
    const ringC = 2 * Math.PI * ringR;
    const pct = started ? Math.min(1, week / 12) : 0;
    return (
      <Screen>
        <Header title="Training cycle" subtitle={started ? `Week ${week} of 12` : "12-week progression"} onBack={goBackSection || closeSection} />

        <SurfaceCard style={{ background: `linear-gradient(150deg, ${active.color}26, rgba(255,255,255,0.02))`, borderColor: `${active.color}55` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
              <svg width={72} height={72} viewBox="0 0 72 72" style={{ transform: "rotate(-90deg)" }}>
                <circle cx={36} cy={36} r={ringR} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={7} />
                <circle cx={36} cy={36} r={ringR} fill="none" stroke={active.color} strokeWidth={7} strokeLinecap="round" strokeDasharray={ringC} strokeDashoffset={ringC * (1 - pct)} />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{started ? week : "–"}</span>
                <span style={{ fontSize: 9, color: "#8A8F9C", textTransform: "uppercase", letterSpacing: "0.08em" }}>of 12</span>
              </div>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#fff" }}>Phase {phase + 1} · {active.name}</p>
                {deload && <span style={{ fontSize: 10, color: "#F5A623", fontWeight: 700, background: "rgba(245,166,35,0.15)", padding: "2px 8px", borderRadius: 6 }}>DELOAD</span>}
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9AA4B3", fontStyle: "italic" }}>{active.theme}</p>
              <p style={{ margin: "6px 0 0", fontSize: 11, color: "#6C6F7B" }}>{started ? `Started ${fd(app.phaseStart)}` : "Not started yet"}</p>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <p style={{ fontSize: 11, color: "#555", margin: "0 0 10px", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>12-week map</p>
          <div style={{ display: "flex", gap: 4, alignItems: "flex-end" }}>
            {Array.from({ length: 12 }, (_, index) => {
              const wk = index + 1;
              const phaseIndex = wk <= 4 ? 0 : wk <= 8 ? 1 : 2;
              const done = started && wk <= week;
              const isNow = started && wk === week;
              const isBoundary = wk === 4 || wk === 8 || wk === 12;
              return (
                <div key={wk} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", height: isBoundary ? 20 : 28, borderRadius: 5, background: done ? PHASES[phaseIndex].color : "rgba(255,255,255,0.05)", opacity: done ? 1 : 0.4, border: isNow ? "2px solid #fff" : "none", boxSizing: "border-box" }} />
                  {isBoundary && <span style={{ fontSize: 8, color: "#6C6F7B" }}>{wk}</span>}
                </div>
              );
            })}
          </div>
        </SurfaceCard>

        {PHASES.map((phaseEntry, index) => {
          const state = index < phase ? "done" : index === phase && started ? "active" : "upcoming";
          return (
            <SurfaceCard key={phaseEntry.name} style={{ background: state === "active" ? `${phaseEntry.color}0F` : "rgba(255,255,255,0.02)", borderColor: state === "active" ? `${phaseEntry.color}66` : "rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: 999, background: phaseEntry.color, flexShrink: 0, opacity: state === "upcoming" ? 0.4 : 1 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: state === "upcoming" ? "#9AA4B3" : "#fff" }}>Phase {index + 1} · {phaseEntry.name}</p>
                  <p style={{ fontSize: 11, color: "#6C6F7B", margin: "2px 0 0" }}>Weeks {phaseEntry.weeks} · {phaseEntry.theme}</p>
                </div>
                {state === "done" && <Icon name="check" size={16} color="#45B649" />}
                {state === "active" && <span style={{ fontSize: 10, color: phaseEntry.color, fontWeight: 700, background: `${phaseEntry.color}22`, padding: "3px 8px", borderRadius: 6 }}>ACTIVE</span>}
              </div>
              {state === "active" && deload && <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(245,166,35,0.08)", borderRadius: 8, border: "1px solid rgba(245,166,35,0.15)" }}><p style={{ fontSize: 11, color: "#F5A623", margin: 0, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><Icon name="spark" size={13} color="#F5A623" />Deload week</p><p style={{ fontSize: 10, color: "#8A8F9C", margin: "3px 0 0" }}>Weights −40% · Conditioning −50% · Keep prehab · Sleep 9 hrs</p></div>}
            </SurfaceCard>
          );
        })}

        {!started && <ActionButton onClick={() => setApp((current) => ({ ...current, phaseStart: today() }))} color="#2D7DD2" style={{ marginTop: 10 }}>Start cycle</ActionButton>}
        {started && <ActionButton onClick={() => { if (window.confirm("Reset cycle start date to today?")) { setApp((current) => ({ ...current, phaseStart: today() })); } }} tone="secondary" compact style={{ marginTop: 10 }}>Reset cycle</ActionButton>}
      </Screen>
    );
  }

  const enabledModules = { gym: true, ...(profile.enabledModules || {}) };
  const supportModules = [
    { key: "recovery", label: "Recovery", desc: "Sleep, hydration, mobility" },
    { key: "bodyweight", label: "Bodyweight", desc: "Weigh-ins and trends" },
    { key: "weeklyReview", label: "Weekly review", desc: "Sunday accountability" },
    { key: "phaseTracking", label: "Phase tracking", desc: "12-week progression" },
  ];
  const mainModules = [
    { key: "gym", label: "Gym / Lifting", desc: "Strength workouts & PBs", locked: true },
    { key: "cardio", label: "Cardio", desc: "Bike, treadmill, running" },
    { key: "basketball", label: "Basketball", desc: "Shot tracking & stats" },
    { key: "nutrition", label: "Nutrition", desc: "Calorie target and food logging" },
  ];
  const toggleModule = (key) => setApp((current) => ({ ...current, profile: { ...current.profile, enabledModules: { ...(current.profile.enabledModules || {}), [key]: !current.profile.enabledModules?.[key], gym: true } } }));
  const setProfile = (patch) => setApp((current) => ({ ...current, profile: { ...(current.profile || {}), ...patch } }));
  const setUnitSystem = (unitSystem) => setProfile({ unitSystem });

  const soundCategories = devicePrefs.soundCategories || {};
  const soundRows = [
    { key: "timers", label: "Timers", cue: "restEnd" },
    { key: "logging", label: "Logging", cue: "setLogged" },
    { key: "celebrations", label: "Celebrations", cue: "pr" },
    { key: "basketball", label: "Basketball", cue: "ballMake" },
  ];
  const toggleSoundCategory = (key) => setDevicePrefs((current) => ({ ...current, soundCategories: { ...(current.soundCategories || {}), [key]: !(current.soundCategories?.[key] !== false) } }));

  const displayName = getDisplayName(profile);
  const initials = getInitials(displayName);

  // Read a chosen photo, centre-crop to a square and shrink it to ~256px so the
  // resulting data URL is small enough to sync inside the Firestore doc.
  const handleAvatarFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const out = 256;
        const canvas = document.createElement("canvas");
        canvas.width = out;
        canvas.height = out;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);
        setApp((current) => ({ ...current, profile: { ...(current.profile || {}), avatar: canvas.toDataURL("image/jpeg", 0.82) } }));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  // Photo if set, initials otherwise.
  const renderAvatar = (size, radius, fontSize) => (
    profile.avatar
      ? <img src={profile.avatar} alt="" style={{ width: size, height: size, borderRadius: radius, objectFit: "cover", flexShrink: 0, display: "block" }} />
      : <div style={{ width: size, height: size, borderRadius: radius, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(140deg, #4EA1FF, #8B5CF6)", color: "#fff", fontSize, fontWeight: 800 }}>{initials}</div>
  );

  const goalLabel = getGoalLabel(profile.goal);
  const unitLabel = getUnitLabel(profile);
  const weightLabel = getWeightLabel(profile);
  const targetWeightDisplay = profile.targetWeightKg ? (unitSystem === "imperial" ? kgToPounds(profile.targetWeightKg) : profile.targetWeightKg) : "";
  const { counts: dataCounts, label: dataSummary } = getDataSummary(app);
  const preferencesIncluded = getPreferencesIncludedLabel;
  const syncText = getSyncSummary({ firebaseUser, firestoreSync });
  const notificationSummary = getNotificationSummary({ supported: notificationSupported, permission: notificationPermission, thresholdDays: devicePrefs.reminderThresholdDays });
  const trackedSummary = getEnabledModuleSummary(profile, mainModules);
  const bodyGoalsSummary = getBodyGoalsSummary({ profile, calorieStats });
  const completionPercent = getProfileCompletion({ profile, enabledModules, notificationPermission });
  const nextAction = getNextProfileAction({ profile, enabledModules, notificationPermission });
  const proteinRange = getProteinRange(profile);

  const applyImportedData = (data) => { const nextApp = withDefaults(data); dbSave(nextApp); setApp(nextApp); setImportPreview(null); goBackSection?.(); window.alert("Data imported successfully."); };
  const handleImportFile = (event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const parsed = JSON.parse(reader.result); if (!isValidData(parsed)) { setImportError("Invalid backup file."); return; } setImportPreview({ data: withDefaults(parsed), summary: summarizeBackupData(parsed), current: summarizeBackupData(app) }); onOpenSection("importPreview"); } catch { setImportError("Could not read this backup file."); } }; reader.readAsText(file); event.target.value = ""; };
  const openRestorePreview = () => { try { const parsed = JSON.parse(localStorage.getItem(DB_BACKUP) || ""); if (!isValidData(parsed)) { window.alert("No valid backup found."); return; } setRestorePreview({ data: withDefaults(parsed), summary: summarizeBackupData(parsed), current: summarizeBackupData(app) }); onOpenSection("restorePreview"); } catch { window.alert("No valid backup found."); } };

  if (["editProfile","bodyGoals","trackingModules","preferences","units","soundHaptics","appearance","notifications","account","dataBackup","dangerZone","about","importPreview","restorePreview"].includes(sectionView)) {
    return <Screen><Header onBack={goBackSection || closeSection} title={{editProfile:"Edit profile",bodyGoals:"Body & Goals",trackingModules:"What you track",preferences:"Preferences",units:"Units",soundHaptics:"Sound & Haptics",appearance:"Appearance",notifications:"Notifications",account:"Account",dataBackup:"Data & Backup",dangerZone:"Danger Zone",about:"About",importPreview:"Import preview",restorePreview:"Restore preview"}[sectionView]} subtitle={sectionView === "bodyGoals" ? "The better this is, the better your training targets work." : undefined} />
      {sectionView === "editProfile" && <><Group title="Identity"><div style={{ display: "flex", alignItems: "center", gap: 12 }}><button type="button" onClick={()=>avatarInputRef.current?.click()} style={{ position: "relative", border: "none", background: "none", padding: 0, cursor: "pointer", flexShrink: 0, lineHeight: 0 }}>{renderAvatar(56, 18, 20)}<span style={{ position: "absolute", right: -3, bottom: -3, width: 22, height: 22, borderRadius: 999, background: "#4EA1FF", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #15151F" }}><Icon name="plus" size={12} color="#fff" strokeWidth={2.6} /></span></button><div style={{ minWidth: 0 }}><p style={{ margin: 0, color: "#fff", fontWeight: 800 }}>{displayName}</p><p style={{ margin: "3px 0 0", color: "#8A8F9C", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{firebaseUser?.email || "Signed out"}</p>{profile.avatar ? <button type="button" onClick={()=>setProfile({ avatar: null })} style={{ marginTop: 6, background: "none", border: "none", padding: 0, color: "#FF8A8A", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Remove photo</button> : <button type="button" onClick={()=>avatarInputRef.current?.click()} style={{ marginTop: 6, background: "none", border: "none", padding: 0, color: "#4EA1FF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Add photo</button>}</div></div><input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarFile} style={{ display: "none" }} /><Field label="Display name"><input style={IS} value={profile.name || ""} onChange={(e)=>setProfile({ name: e.target.value })} placeholder="Your name" /></Field><Field label="Personal notes"><TextAreaField value={profile.notes || ""} onChange={(e)=>setProfile({ notes: e.target.value })} placeholder="Injuries, schedule, preferences..." /></Field></Group></>}
      {sectionView === "bodyGoals" && <><Group title="Body"><div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}><Field label="Age"><input style={IS} type="number" value={profile.age || ""} onChange={(e)=>setProfile({ age:e.target.value })} /></Field><Field label="Sex"><select style={IS} value={profile.sex || "male"} onChange={(e)=>setProfile({ sex:e.target.value })}><option value="male">Male</option><option value="female">Female</option></select></Field>{unitSystem === "imperial" ? <><Field label="Height feet"><input style={IS} type="number" value={profileFeet || ""} onChange={(e)=>setProfile({ heightCm: feetInchesToCm(e.target.value, profileInches) })} /></Field><Field label="Height inches"><input style={IS} type="number" value={profileInches || ""} onChange={(e)=>setProfile({ heightCm: feetInchesToCm(profileFeet, e.target.value) })} /></Field><Field label="Current weight (lb)"><input style={IS} type="number" value={kgToPounds(profile.weightKg)} onChange={(e)=>setProfile({ weightKg:poundsToKg(e.target.value) })} /></Field><Field label="Target weight (lb)"><input style={IS} type="number" value={targetWeightDisplay} onChange={(e)=>setProfile({ targetWeightKg:poundsToKg(e.target.value) })} /></Field></> : <><Field label="Height (cm)"><input style={IS} type="number" value={profile.heightCm || ""} onChange={(e)=>setProfile({ heightCm:e.target.value })} /></Field><Field label="Current weight (kg)"><input style={IS} type="number" value={profile.weightKg || ""} onChange={(e)=>setProfile({ weightKg:e.target.value })} /></Field><Field label="Target weight (kg)"><input style={IS} type="number" value={profile.targetWeightKg || ""} onChange={(e)=>setProfile({ targetWeightKg:e.target.value })} /></Field></>}</div></Group><Group title="Goal"><select style={IS} value={profile.goal || "maintain"} onChange={(e)=>setProfile({ goal:e.target.value })}>{GOAL_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select><select style={IS} value={profile.weeklyGoalRate || "moderate"} onChange={(e)=>setProfile({ weeklyGoalRate:e.target.value })}>{(profile.goal === "bulk" ? ["Slow lean bulk","Moderate gain","Aggressive gain"] : ["0.25 kg/week","0.5 kg/week","0.75 kg/week","1.0 kg/week"]).map(o=><option key={o} value={o}>{o}</option>)}</select><select style={IS} value={profile.activityLevel || "moderate"} onChange={(e)=>setProfile({ activityLevel:e.target.value })}>{ACTIVITY_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></Group><Group title="Nutrition target">{calorieStats ? <><p style={{margin:0,color:"#fff"}}>BMR estimate: <strong>{calorieStats.bmr}</strong> kcal/day</p><p style={{margin:0,color:"#fff"}}>Maintenance calories: <strong>{calorieStats.maintenance}</strong> kcal/day</p><p style={{margin:0,color:"#fff"}}>Goal calories: <strong>{calorieStats.target}</strong> kcal/day</p><p style={{margin:0,color:"#8BA6C9"}}>Protein target: <strong>{proteinRange}</strong></p></> : <p style={{margin:0,color:"#888"}}>Add age, height, and current weight to estimate calories and protein.</p>}</Group></>}
      {sectionView === "trackingModules" && <><Group title="Main modules">{mainModules.map(m=><div key={m.key} style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}><div><p style={{margin:0,color:"#fff",fontWeight:700}}>{m.label}{m.locked ? " · Core" : ""}</p><p style={{margin:"2px 0 0",color:"#8A8F9C",fontSize:11}}>{m.desc}</p></div><Toggle on={m.locked || enabledModules[m.key]} disabled={m.locked} onClick={()=>toggleModule(m.key)} /></div>)}</Group><Group title="Support modules">{supportModules.map(m=><div key={m.key} style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}><div><p style={{margin:0,color:"#fff",fontWeight:700}}>{m.label}</p><p style={{margin:"2px 0 0",color:"#8A8F9C",fontSize:11}}>{m.desc}</p></div><Toggle on={enabledModules[m.key]} onClick={()=>toggleModule(m.key)} /></div>)}</Group></>}
      {sectionView === "preferences" && <><ProfileRow icon="scale" label="Units" summary={unitLabel} onClick={()=>onOpenSection("units")} /><ProfileRow icon="pulse" label="Sound & Haptics" summary={`${devicePrefs.soundEnabled !== false ? "Sound on" : "Sound off"} · ${devicePrefs.hapticsEnabled !== false ? "Haptics on" : "Haptics off"}`} onClick={()=>onOpenSection("soundHaptics")} /><ProfileRow icon="spark" label="Appearance" summary="Dark" onClick={()=>onOpenSection("appearance")} /></>}
      {sectionView === "units" && <Group title="Units"><ActionButton tone={unitSystem==="imperial"?"tinted":"secondary"} onClick={()=>setUnitSystem("imperial")}>Imperial · lb · ft/in · miles</ActionButton><ActionButton tone={unitSystem==="metric"?"tinted":"secondary"} onClick={()=>setUnitSystem("metric")}>Metric · kg · cm · km</ActionButton><p style={{margin:0,color:"#8A8F9C",fontSize:12}}>Energy stays in kcal.</p></Group>}
      {sectionView === "soundHaptics" && <><Group title="Sound"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><p style={{margin:0,color:"#fff",fontWeight:700}}>Master sound</p><Toggle on={devicePrefs.soundEnabled !== false} onClick={()=>setDevicePrefs(c=>({...c,soundEnabled:!(c.soundEnabled !== false)}))} /></div><input type="range" min="0" max="1" step="0.05" value={devicePrefs.soundVolume ?? 0.6} onChange={(e)=>setDevicePrefs(c=>({...c,soundVolume:Number(e.target.value)}))} style={{width:"100%",accentColor:"#4EA1FF"}} /></Group><Group title="Sound categories">{soundRows.map(r=><div key={r.key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}><p style={{margin:0,color:"#fff",fontWeight:700}}>{r.label}</p><div style={{display:"flex",gap:10,alignItems:"center"}}><ActionButton compact fullWidth={false} tone="secondary" onClick={()=>{unlockAudio();playCue(r.cue)}}>Play</ActionButton><Toggle on={soundCategories[r.key] !== false} onClick={()=>toggleSoundCategory(r.key)} /></div></div>)}</Group><Group title="Haptics"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><p style={{margin:0,color:"#fff",fontWeight:700}}>Haptics vibration</p><Toggle on={devicePrefs.hapticsEnabled !== false} onClick={()=>setDevicePrefs(c=>({...c,hapticsEnabled:!(c.hapticsEnabled !== false)}))} /></div><ActionButton tone="secondary" onClick={()=>haptic("success")}>Test haptic</ActionButton></Group></>}
      {sectionView === "appearance" && <Group title="Theme"><p style={{margin:0,color:"#fff",fontWeight:700}}>Dark</p><p style={{margin:0,color:"#8A8F9C",fontSize:12}}>Theme customization is coming soon. The app currently supports its dark training theme.</p></Group>}
      {sectionView === "notifications" && <><Group title="Reminder status"><p style={{margin:0,color:"#fff"}}>Permission: <strong>{notificationSupported ? notificationPermission : "Unsupported"}</strong></p>{notificationSupported && <ActionButton onClick={onRequestReminderPermission} tone="tinted" color="#2D7DD2">{notificationPermission === "granted" ? "Enabled" : "Enable reminders"}</ActionButton>}</Group>{notificationSupported && <Group title="Streak protection"><p style={{margin:0,color:"#fff"}}>Remind me when I haven’t trained for {devicePrefs.reminderThresholdDays || 3} days</p><input type="range" min="2" max="5" value={devicePrefs.reminderThresholdDays || 3} onChange={(e)=>setDevicePrefs(c=>({...c,reminderThresholdDays:Number(e.target.value),lastReminderKey:null}))} style={{width:"100%",accentColor:"#2D7DD2"}} /></Group>}<Group title="Testing"><ActionButton onClick={onSendTestReminder} tone="secondary" disabled={!notificationSupported}>Send test reminder</ActionButton></Group><Group title="Device support"><p style={{margin:0,color:"#8A8F9C",fontSize:12}}>Browser support: {notificationSupported ? "Available" : "Unsupported"}</p><p style={{margin:0,color:"#8A8F9C",fontSize:12}}>Service worker: {serviceWorkerSupported ? "Available" : "Unavailable"}</p></Group></>}
      {sectionView === "account" && <><Group title="Account"><p style={{margin:0,color:"#fff"}}>Email: <strong>{firebaseUser?.email || "Signed out"}</strong></p><p style={{margin:0,color:"#fff"}}>Display name: <strong>{displayName}</strong></p><p style={{margin:0,color:"#8A8F9C"}}>Status: {firebaseUser ? "Signed in" : "Signed out"}</p></Group><Group title="Sync"><p style={{margin:0,color:"#fff"}}>Cloud sync status: <strong>{syncText}</strong></p><p style={{margin:0,color:"#8A8F9C"}}>Last synced: {firestoreSync?.lastSyncedAt ? new Date(firestoreSync.lastSyncedAt).toLocaleString() : "—"}</p>{firestoreSync?.error && <p style={{margin:0,color:"#FF8A8A"}}>{firestoreSync.error}</p>}</Group>{firebaseUser && <ActionButton tone="secondary" onClick={()=>setSignOutOpen(true)}>Sign out</ActionButton>}</>}
      {sectionView === "dataBackup" && <><Group title="Training data"><p style={{margin:0,color:"#fff"}}>{dataCounts.workouts} workouts</p><p style={{margin:0,color:"#fff"}}>{dataCounts.cardio} cardio sessions</p><p style={{margin:0,color:"#fff"}}>{dataCounts.basketball} basketball sessions</p><p style={{margin:0,color:"#fff"}}>{dataCounts.pbs} PBs</p></Group><Group title="Wellness data"><p style={{margin:0,color:"#fff"}}>{dataCounts.recovery} recovery logs</p><p style={{margin:0,color:"#fff"}}>{dataCounts.weighIns} weigh-ins</p><p style={{margin:0,color:"#fff"}}>{dataCounts.reviews} weekly reviews</p></Group><Group title="Backup actions"><ActionButton onClick={onExportData} tone="tinted" color="#2D7DD2">Export backup</ActionButton><ActionButton onClick={()=>fileInputRef.current?.click()} tone="tinted" color="#F5A623">Import backup</ActionButton><ActionButton onClick={openRestorePreview} tone="tinted" color="#45B649">Restore local backup</ActionButton><input ref={fileInputRef} type="file" accept="application/json" onChange={handleImportFile} style={{display:"none"}} />{importError && <p style={{margin:0,color:"#FF8A8A",fontSize:12}}>{importError}</p>}</Group><Group title="Cloud sync"><p style={{margin:0,color:"#fff"}}>{syncText}</p><p style={{margin:0,color:"#8A8F9C",fontSize:12}}>Last synced: {firestoreSync?.lastSyncedAt ? new Date(firestoreSync.lastSyncedAt).toLocaleString() : "—"}</p></Group><DangerRow icon="trash" label="Danger Zone" summary="Reset all data" onClick={()=>onOpenSection("dangerZone")} /></>}
      {sectionView === "dangerZone" && <SurfaceCard style={{borderColor:"rgba(255,93,93,0.3)",background:"rgba(255,93,93,0.05)"}}><p style={{margin:"0 0 6px",color:"#FF8A8A",fontWeight:800}}>Reset all data</p><p style={{margin:"0 0 14px",color:"#8A8F9C",fontSize:12}}>Permanently deletes workouts, cardio, basketball data, stats, PBs, preferences and local/cloud data.</p><ActionButton onClick={()=>setResetOpen(true)} tone="danger">Reset all data</ActionButton></SurfaceCard>}
      {sectionView === "about" && <Group title="App"><p style={{margin:0,color:"#fff",fontWeight:700}}>Orion Gym Tracker</p><p style={{margin:0,color:"#8A8F9C"}}>Version 1.0.0</p></Group>}
      {sectionView === "importPreview" && importPreview && <Group title="Import backup"><p style={{margin:0,color:"#fff",fontWeight:700}}>Found in backup</p><p style={{margin:0,color:"#8A8F9C"}}>{importPreview.summary.workouts} workouts · {importPreview.summary.recovery} recovery logs · {importPreview.summary.weighIns} weigh-ins · {importPreview.summary.pbs} PBs · {preferencesIncluded(importPreview.summary)}</p><p style={{margin:"8px 0 0",color:"#fff",fontWeight:700}}>Current app data</p><p style={{margin:0,color:"#8A8F9C"}}>{importPreview.current.workouts} workouts · {importPreview.current.recovery} recovery logs · {importPreview.current.weighIns} weigh-ins · {importPreview.current.pbs} PBs</p><p style={{margin:"8px 0",color:"#FFCA8A",fontSize:12}}>Importing a backup replaces your current data with the data inside the file.</p><ActionButton onClick={()=>{onExportData?.(); applyImportedData(importPreview.data);}} tone="tinted" color="#2D7DD2">Create safety backup and import</ActionButton><ActionButton onClick={()=>applyImportedData(importPreview.data)} tone="danger">Import without safety backup</ActionButton><ActionButton onClick={()=>{setImportPreview(null);goBackSection?.();}} tone="secondary">Cancel</ActionButton></Group>}
      {sectionView === "restorePreview" && restorePreview && <Group title="Restore local backup"><p style={{margin:0,color:"#fff",fontWeight:700}}>Backup found</p><p style={{margin:0,color:"#8A8F9C"}}>{restorePreview.summary.workouts} workouts · {restorePreview.summary.pbs} PBs · {preferencesIncluded(restorePreview.summary)}</p><p style={{margin:"8px 0",color:"#FFCA8A",fontSize:12}}>Restoring uses the last local backup saved on this device and replaces your current data.</p><ActionButton onClick={()=>{onExportData?.(); dbSave(restorePreview.data); setApp(restorePreview.data); setRestorePreview(null); goBackSection?.();}} tone="tinted" color="#2D7DD2">Create safety export and restore</ActionButton><ActionButton onClick={()=>{dbSave(restorePreview.data); setApp(restorePreview.data); setRestorePreview(null); goBackSection?.();}} tone="danger">Restore backup</ActionButton><ActionButton onClick={()=>{setRestorePreview(null);goBackSection?.();}} tone="secondary">Cancel</ActionButton></Group>}
      <ConfirmModal open={resetOpen} title="Reset all data?" message={`This permanently deletes all your workouts, cardio, basketball sessions, recovery logs, body stats, weekly reviews, preferences and PBs on this device${firebaseUser ? " and in your cloud account" : ""}. This can't be undone.`} requireText="RESET" confirmLabel="Delete everything" onCancel={()=>setResetOpen(false)} onConfirm={()=>{setResetOpen(false);onResetAllData();}} />
      <ConfirmModal open={signOutOpen} title="Sign out?" message="Your data stays on this device, but cloud sync will stop until you sign back in." confirmLabel="Sign out" onCancel={()=>setSignOutOpen(false)} onConfirm={()=>{setSignOutOpen(false);onFirebaseSignOut?.();}} />
    </Screen>;
  }

  return (
    <Screen>
      <div style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 24px)", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <button type="button" onClick={()=>avatarInputRef.current?.click()} style={{ position: "relative", border: "none", background: "none", padding: 0, cursor: "pointer", flexShrink: 0, lineHeight: 0 }}>{renderAvatar(60, 20, 22)}<span style={{ position: "absolute", right: -3, bottom: -3, width: 22, height: 22, borderRadius: 999, background: "#4EA1FF", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #0A0A0F" }}><Icon name="plus" size={12} color="#fff" strokeWidth={2.6} /></span></button>
          <div style={{ minWidth: 0 }}><h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</h1>{firebaseUser?.email && <p style={{ margin: "3px 0 0", fontSize: 12, color: "#8A8F9C", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{firebaseUser.email}</p>}</div>
        </div>
        <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarFile} style={{ display: "none" }} />
        <div style={{ display: "flex", gap: 8 }}>{[{ label: "Goal", value: goalLabel }, { label: "Weight", value: weightLabel }, { label: "Streak", value: `${streakSummary?.currentStreak || 0} wk` }].map((stat) => <div key={stat.label} style={{ flex: 1, minWidth: 0, textAlign: "center", padding: "11px 6px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}><p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stat.value}</p><p style={{ margin: "2px 0 0", fontSize: 10, color: "#6C6F7B", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>{stat.label}</p></div>)}</div>
      </div>
      <SurfaceCard style={{ borderColor: "rgba(78,161,255,0.25)", background: "rgba(78,161,255,0.07)" }}><div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}><div><p style={{ margin:0, color:"#fff", fontWeight:800 }}>{completionPercent >= 100 ? "Profile complete" : `Profile ${completionPercent}% complete`}</p><p style={{ margin:"4px 0 0", color:"#8BA6C9", fontSize:12 }}>Next: {nextAction}</p></div><div style={{ width:52, height:52, borderRadius:999, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(255,255,255,0.06)", color:"#fff", fontWeight:800 }}>{completionPercent}%</div></div></SurfaceCard>
      <div style={{ display: "grid", gap: 10 }}>
        <ProfileRow icon="user" label="Edit profile" summary={(profile.name || profile.firstName || "").trim() || "Not set"} onClick={()=>onOpenSection("editProfile")} />
        <ProfileRow icon="scale" label="Body & Goals" summary={bodyGoalsSummary} onClick={()=>onOpenSection("bodyGoals")} />
        <ProfileRow icon="clipboard" label="What you track" summary={trackedSummary} onClick={()=>onOpenSection("trackingModules")} />
        <ProfileRow icon="calendar" label="Training cycle" summary={app.phaseStart ? `Week ${getPhaseProgress().week} of 12` : "Not started"} onClick={()=>onOpenSection("phase")} />
        <ProfileRow icon="spark" label="Preferences" summary={`${unitLabel} · ${devicePrefs.soundEnabled !== false ? "Sound on" : "Sound off"} · ${devicePrefs.hapticsEnabled !== false ? "Haptics on" : "Haptics off"}`} onClick={()=>onOpenSection("preferences")} />
        <ProfileRow icon="bell" label="Notifications" summary={notificationSummary} onClick={()=>onOpenSection("notifications")} />
        <ProfileRow icon="user" label="Account" summary={syncText} onClick={()=>onOpenSection("account")} />
        <ProfileRow icon="barChart" label="Data & Backup" summary={dataSummary} onClick={()=>onOpenSection("dataBackup")} />
        <ProfileRow icon="info" label="About" summary="v1.0.0" onClick={()=>onOpenSection("about")} />
      </div>
    </Screen>
  );
}
