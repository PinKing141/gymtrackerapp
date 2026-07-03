import { useState } from "react";
import { Spark } from "../components/WorkoutComponents.jsx";
import { ConfirmModal } from "../components/ConfirmModal.jsx";
import { Icon, WaterGlassIcon } from "../components/icons.jsx";
import { ActionButton, BackButton, Screen, ScreenHeader, SurfaceButton, SurfaceCard, TextAreaField } from "../components/ui.jsx";
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
    return (
      <Screen>
        <ScreenHeader action={<BackButton onClick={closeSection} />} title="12-Week Cycle" subtitle={app.phaseStart ? `Started ${fd(app.phaseStart)}` : "Starts on first session"} topPadding="calc(env(safe-area-inset-top, 0px) + 20px)" />

        <SurfaceCard>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>Week {week}/12</span>
            {deload && <span style={{ fontSize: 10, color: "#F5A623", fontWeight: 700, background: "rgba(245,166,35,0.15)", padding: "2px 8px", borderRadius: 6 }}>DELOAD</span>}
          </div>
          <div style={{ display: "flex", gap: 3 }}>
            {Array.from({ length: 12 }, (_, index) => {
              const currentWeek = index + 1;
              const phaseIndex = currentWeek <= 4 ? 0 : currentWeek <= 8 ? 1 : 2;
              return <div key={currentWeek} style={{ flex: 1, height: currentWeek === 4 || currentWeek === 8 || currentWeek === 12 ? 20 : 24, borderRadius: 4, background: currentWeek <= week ? PHASES[phaseIndex].color : "rgba(255,255,255,0.04)", opacity: currentWeek <= week ? 1 : 0.3, border: currentWeek === week ? "2px solid #fff" : "none", boxSizing: "border-box" }} />;
            })}
          </div>
        </SurfaceCard>

        {PHASES.map((phaseEntry, index) => (
          <SurfaceCard key={phaseEntry.name} style={{ background: index === phase ? `${phaseEntry.color}10` : "rgba(255,255,255,0.03)", borderColor: index === phase ? `${phaseEntry.color}40` : "rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: index === phase ? phaseEntry.color : "#fff" }}>Phase {index + 1} — {phaseEntry.name}</p>
                <p style={{ fontSize: 11, color: "#666", margin: "2px 0 0" }}>Weeks {phaseEntry.weeks}</p>
                <p style={{ fontSize: 11, color: "#888", margin: "4px 0 0", fontStyle: "italic" }}>{phaseEntry.theme}</p>
              </div>
              {index < phase && <span style={{ fontSize: 16, color: "#45B649" }}>✓</span>}
              {index === phase && <span style={{ fontSize: 10, color: phaseEntry.color, fontWeight: 700, background: `${phaseEntry.color}22`, padding: "3px 8px", borderRadius: 6 }}>ACTIVE</span>}
            </div>
            {index === phase && deload && <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(245,166,35,0.08)", borderRadius: 8, border: "1px solid rgba(245,166,35,0.15)" }}><p style={{ fontSize: 11, color: "#F5A623", margin: 0, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><Icon name="spark" size={13} color="#F5A623" />Deload Active</p><p style={{ fontSize: 10, color: "#888", margin: "3px 0 0" }}>Weights -40% · Conditioning -50% · Keep prehab · Sleep 9hrs</p></div>}
          </SurfaceCard>
        ))}

        {!app.phaseStart && <ActionButton onClick={() => setApp((current) => ({ ...current, phaseStart: today() }))} color="#2D7DD2" style={{ marginTop: 10 }}>Start Cycle</ActionButton>}
        {app.phaseStart && <ActionButton onClick={() => { if (window.confirm("Reset cycle start date?")) { setApp((current) => ({ ...current, phaseStart: today() })); } }} tone="secondary" compact style={{ marginTop: 10 }}>Reset Cycle</ActionButton>}
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

  const displayName = (profile.firstName || profile.name || "").trim() || "Your profile";
  const initials = displayName.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "Y";
  const goalLabel = { cut: "Fat loss", maintain: "Maintain", bulk: "Muscle gain" }[profile.goal] || "—";
  const unitLabel = unitSystem === "imperial" ? "Imperial" : "Metric";
  const weightLabel = profile.weightKg ? (unitSystem === "imperial" ? `${kgToPounds(profile.weightKg)} lb` : `${profile.weightKg} kg`) : "—";
  const targetWeightDisplay = profile.targetWeightKg ? (unitSystem === "imperial" ? kgToPounds(profile.targetWeightKg) : profile.targetWeightKg) : "";
  const dataCounts = {
    workouts: app.sessions?.length || 0,
    recovery: app.recovery?.length || 0,
    weighIns: app.bodyStats?.length || 0,
    reviews: app.weeklyReviews?.length || 0,
    pbs: Object.keys(app.personalBests || {}).length,
    cardio: app.cardioSessions?.length || 0,
    basketball: app.basketballSessions?.length || 0,
  };
  const summarizeData = (data) => ({
    workouts: data?.sessions?.length || 0,
    recovery: data?.recovery?.length || 0,
    weighIns: data?.bodyStats?.length || 0,
    reviews: data?.weeklyReviews?.length || 0,
    pbs: Object.keys(data?.personalBests || {}).length,
    cardio: data?.cardioSessions?.length || 0,
    basketball: data?.basketballSessions?.length || 0,
    preferences: Boolean(data?.profile),
  });
  const preferencesIncluded = (summary) => summary.preferences ? "Preferences included" : "Preferences not included";
  const syncText = !firebaseUser ? "Signed out" : firestoreSync?.status === "error" ? "Sync error" : firestoreSync?.status === "synced" ? "Synced to cloud" : firestoreSync?.status === "saving" ? "Saving…" : "Signed in";
  const notificationSummary = !notificationSupported ? "Unsupported" : notificationPermission === "granted" ? `${devicePrefs.reminderThresholdDays || 3}-day reminder` : "Off";
  const selectedCoach = profile.coachVoice || profile.coachPersona || "none";
  const coachLabel = { balanced: "Balanced", strict: "Strict", hype: "Hype", calm: "Calm", technical: "Technical", none: "Not chosen" }[selectedCoach] || "Not chosen";
  const trackedSummary = mainModules.filter((m) => m.locked || enabledModules[m.key]).map((m) => m.label.replace(" / Lifting", "")).join(" · ") || "Gym";
  const bodyGoalsSummary = calorieStats && profile.weightKg && profile.goal ? `${weightLabel} · ${goalLabel} · ${calorieStats.target.toLocaleString()} kcal` : "Finish setup";
  const dataSummary = dataCounts.workouts || dataCounts.pbs ? `${dataCounts.workouts} sessions · ${dataCounts.pbs} PBs` : "No backup yet";
  const completionItems = [profile.name || profile.firstName, profile.age, profile.sex, profile.heightCm, profile.weightKg, profile.goal, profile.targetWeightKg, profile.activityLevel, Object.values(enabledModules).some(Boolean), notificationPermission === "granted", selectedCoach !== "none", profile.unitSystem];
  const completionPercent = Math.round((completionItems.filter(Boolean).length / completionItems.length) * 100);
  const nextAction = !profile.name && !profile.firstName ? "Add name" : !profile.weightKg ? "Add current weight" : !profile.heightCm ? "Add height" : !profile.age ? "Add age" : !profile.goal ? "Pick goal" : !profile.targetWeightKg ? "Set your target weight" : !profile.activityLevel ? "Pick activity level" : !Object.values(enabledModules).some(Boolean) ? "Choose what you track" : selectedCoach === "none" ? "Choose coach voice" : notificationPermission !== "granted" ? "Enable reminders" : "Ready to train";
  const proteinRange = profile.weightKg ? `${Math.round(Number(profile.weightKg) * 1.6)}–${Math.round(Number(profile.weightKg) * 2.2)}g/day` : "Add current weight";

  const ProfileRow = ({ icon, label, summary, onClick, danger = false }) => <SurfaceButton onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 14, minHeight: 58, padding: "14px 16px", borderColor: danger ? "rgba(255,93,93,0.3)" : undefined }}><div style={{ width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: danger ? "rgba(255,93,93,0.1)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}><Icon name={icon} size={18} color={danger ? "#FF5D5D" : "#9AA4B3"} /></div><div style={{ flex: 1, minWidth: 0 }}><p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: danger ? "#FF8A8A" : "#fff" }}>{label}</p></div><span style={{ maxWidth: "48%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#8A8F9C", fontSize: 12, textAlign: "right" }}>{summary}</span><span style={{ color: "#555", fontSize: 18 }}>›</span></SurfaceButton>;
  const Group = ({ title, children }) => <SurfaceCard><p style={{ fontSize: 11, color: "#555", margin: "0 0 10px", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>{title}</p><div style={{ display: "grid", gap: 10 }}>{children}</div></SurfaceCard>;
  const Field = ({ label, children }) => <label style={{ display: "grid", gap: 6, fontSize: 11, color: "#8A8F9C", fontWeight: 700 }}>{label}{children}</label>;
  const Toggle = ({ on, onClick, disabled }) => <button type="button" disabled={disabled} onClick={onClick} style={{ width: 44, height: 26, borderRadius: 999, flexShrink: 0, border: "none", cursor: disabled ? "default" : "pointer", padding: 0, background: on ? "#4EA1FF" : "rgba(255,255,255,0.14)", position: "relative", opacity: disabled ? 0.6 : 1 }}><div style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: "#fff" }} /></button>;
  const Header = ({ title, subtitle }) => <ScreenHeader action={<BackButton onClick={closeSection} />} title={title} subtitle={subtitle} topPadding="calc(env(safe-area-inset-top, 0px) + 20px)" />;
  const applyImportedData = (data) => { const nextApp = withDefaults(data); dbSave(nextApp); setApp(nextApp); setImportPreview(null); closeSection(); window.alert("Data imported successfully."); };
  const handleImportFile = (event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const parsed = JSON.parse(reader.result); if (!isValidData(parsed)) { setImportError("Invalid backup file."); return; } setImportPreview({ data: withDefaults(parsed), summary: summarizeData(parsed), current: summarizeData(app) }); onOpenSection("importPreview"); } catch { setImportError("Could not read this backup file."); } }; reader.readAsText(file); event.target.value = ""; };
  const openRestorePreview = () => { try { const parsed = JSON.parse(localStorage.getItem(DB_BACKUP) || ""); if (!isValidData(parsed)) { window.alert("No valid backup found."); return; } setRestorePreview({ data: withDefaults(parsed), summary: summarizeData(parsed), current: summarizeData(app) }); onOpenSection("restorePreview"); } catch { window.alert("No valid backup found."); } };

  if (["editProfile","bodyGoals","trackingModules","preferences","units","soundHaptics","appearance","notifications","coachVoice","account","dataBackup","dangerZone","about","importPreview","restorePreview"].includes(sectionView)) {
    return <Screen><Header title={{editProfile:"Edit profile",bodyGoals:"Body & Goals",trackingModules:"What you track",preferences:"Preferences",units:"Units",soundHaptics:"Sound & Haptics",appearance:"Appearance",notifications:"Notifications",coachVoice:"Coach voice",account:"Account",dataBackup:"Data & Backup",dangerZone:"Danger Zone",about:"About",importPreview:"Import preview",restorePreview:"Restore preview"}[sectionView]} subtitle={sectionView === "bodyGoals" ? "The better this is, the better the app coaches you." : undefined} />
      {sectionView === "editProfile" && <><Group title="Identity"><div style={{ display: "flex", alignItems: "center", gap: 12 }}><div style={{ width: 52, height: 52, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(140deg, #4EA1FF, #8B5CF6)", color: "#fff", fontSize: 19, fontWeight: 800 }}>{initials}</div><div style={{ minWidth: 0 }}><p style={{ margin: 0, color: "#fff", fontWeight: 800 }}>{displayName}</p><p style={{ margin: "3px 0 0", color: "#8A8F9C", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{firebaseUser?.email || "Signed out"}</p></div></div><Field label="Display name"><input style={IS} value={profile.name || ""} onChange={(e)=>setProfile({ name: e.target.value })} placeholder="Your name" /></Field><Field label="Personal notes"><TextAreaField value={profile.notes || ""} onChange={(e)=>setProfile({ notes: e.target.value })} placeholder="Injuries, schedule, preferences..." /></Field></Group></>}
      {sectionView === "bodyGoals" && <><Group title="Body"><div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}><Field label="Age"><input style={IS} type="number" value={profile.age || ""} onChange={(e)=>setProfile({ age:e.target.value })} /></Field><Field label="Sex"><select style={IS} value={profile.sex || "male"} onChange={(e)=>setProfile({ sex:e.target.value })}><option value="male">Male</option><option value="female">Female</option></select></Field>{unitSystem === "imperial" ? <><Field label="Height feet"><input style={IS} type="number" value={profileFeet || ""} onChange={(e)=>setProfile({ heightCm: feetInchesToCm(e.target.value, profileInches) })} /></Field><Field label="Height inches"><input style={IS} type="number" value={profileInches || ""} onChange={(e)=>setProfile({ heightCm: feetInchesToCm(profileFeet, e.target.value) })} /></Field><Field label="Current weight (lb)"><input style={IS} type="number" value={kgToPounds(profile.weightKg)} onChange={(e)=>setProfile({ weightKg:poundsToKg(e.target.value) })} /></Field><Field label="Target weight (lb)"><input style={IS} type="number" value={targetWeightDisplay} onChange={(e)=>setProfile({ targetWeightKg:poundsToKg(e.target.value) })} /></Field></> : <><Field label="Height (cm)"><input style={IS} type="number" value={profile.heightCm || ""} onChange={(e)=>setProfile({ heightCm:e.target.value })} /></Field><Field label="Current weight (kg)"><input style={IS} type="number" value={profile.weightKg || ""} onChange={(e)=>setProfile({ weightKg:e.target.value })} /></Field><Field label="Target weight (kg)"><input style={IS} type="number" value={profile.targetWeightKg || ""} onChange={(e)=>setProfile({ targetWeightKg:e.target.value })} /></Field></>}</div></Group><Group title="Goal"><select style={IS} value={profile.goal || "maintain"} onChange={(e)=>setProfile({ goal:e.target.value })}>{GOAL_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select><select style={IS} value={profile.weeklyGoalRate || "moderate"} onChange={(e)=>setProfile({ weeklyGoalRate:e.target.value })}>{(profile.goal === "bulk" ? ["Slow lean bulk","Moderate gain","Aggressive gain"] : ["0.25 kg/week","0.5 kg/week","0.75 kg/week","1.0 kg/week"]).map(o=><option key={o} value={o}>{o}</option>)}</select><select style={IS} value={profile.activityLevel || "moderate"} onChange={(e)=>setProfile({ activityLevel:e.target.value })}>{ACTIVITY_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></Group><Group title="Nutrition target">{calorieStats ? <><p style={{margin:0,color:"#fff"}}>BMR estimate: <strong>{calorieStats.bmr}</strong> kcal/day</p><p style={{margin:0,color:"#fff"}}>Maintenance calories: <strong>{calorieStats.maintenance}</strong> kcal/day</p><p style={{margin:0,color:"#fff"}}>Goal calories: <strong>{calorieStats.target}</strong> kcal/day</p><p style={{margin:0,color:"#8BA6C9"}}>Protein target: <strong>{proteinRange}</strong></p></> : <p style={{margin:0,color:"#888"}}>Add age, height, and current weight to estimate calories and protein.</p>}</Group></>}
      {sectionView === "trackingModules" && <><Group title="Main modules">{mainModules.map(m=><div key={m.key} style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}><div><p style={{margin:0,color:"#fff",fontWeight:700}}>{m.label}{m.locked ? " · Core" : ""}</p><p style={{margin:"2px 0 0",color:"#8A8F9C",fontSize:11}}>{m.desc}</p></div><Toggle on={m.locked || enabledModules[m.key]} disabled={m.locked} onClick={()=>toggleModule(m.key)} /></div>)}</Group><Group title="Support modules">{supportModules.map(m=><div key={m.key} style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}><div><p style={{margin:0,color:"#fff",fontWeight:700}}>{m.label}</p><p style={{margin:"2px 0 0",color:"#8A8F9C",fontSize:11}}>{m.desc}</p></div><Toggle on={enabledModules[m.key]} onClick={()=>toggleModule(m.key)} /></div>)}</Group></>}
      {sectionView === "preferences" && <><ProfileRow icon="scale" label="Units" summary={unitLabel} onClick={()=>onOpenSection("units")} /><ProfileRow icon="pulse" label="Sound & Haptics" summary={`${devicePrefs.soundEnabled !== false ? "Sound on" : "Sound off"} · ${devicePrefs.hapticsEnabled !== false ? "Haptics on" : "Haptics off"}`} onClick={()=>onOpenSection("soundHaptics")} /><ProfileRow icon="spark" label="Appearance" summary="Dark" onClick={()=>onOpenSection("appearance")} /></>}
      {sectionView === "units" && <Group title="Units"><ActionButton tone={unitSystem==="imperial"?"tinted":"secondary"} onClick={()=>setUnitSystem("imperial")}>Imperial · lb · ft/in · miles</ActionButton><ActionButton tone={unitSystem==="metric"?"tinted":"secondary"} onClick={()=>setUnitSystem("metric")}>Metric · kg · cm · km</ActionButton><p style={{margin:0,color:"#8A8F9C",fontSize:12}}>Energy stays in kcal.</p></Group>}
      {sectionView === "soundHaptics" && <><Group title="Sound"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><p style={{margin:0,color:"#fff",fontWeight:700}}>Master sound</p><Toggle on={devicePrefs.soundEnabled !== false} onClick={()=>setDevicePrefs(c=>({...c,soundEnabled:!(c.soundEnabled !== false)}))} /></div><input type="range" min="0" max="1" step="0.05" value={devicePrefs.soundVolume ?? 0.6} onChange={(e)=>setDevicePrefs(c=>({...c,soundVolume:Number(e.target.value)}))} style={{width:"100%",accentColor:"#4EA1FF"}} /></Group><Group title="Sound categories">{soundRows.map(r=><div key={r.key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}><p style={{margin:0,color:"#fff",fontWeight:700}}>{r.label}</p><div style={{display:"flex",gap:10,alignItems:"center"}}><ActionButton compact fullWidth={false} tone="secondary" onClick={()=>{unlockAudio();playCue(r.cue)}}>Play</ActionButton><Toggle on={soundCategories[r.key] !== false} onClick={()=>toggleSoundCategory(r.key)} /></div></div>)}</Group><Group title="Haptics"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><p style={{margin:0,color:"#fff",fontWeight:700}}>Haptics vibration</p><Toggle on={devicePrefs.hapticsEnabled !== false} onClick={()=>setDevicePrefs(c=>({...c,hapticsEnabled:!(c.hapticsEnabled !== false)}))} /></div><ActionButton tone="secondary" onClick={()=>haptic("success")}>Test haptic</ActionButton></Group></>}
      {sectionView === "appearance" && <Group title="Theme"><p style={{margin:0,color:"#fff",fontWeight:700}}>Dark</p><p style={{margin:0,color:"#8A8F9C",fontSize:12}}>Theme customization is coming soon. The app currently supports its dark training theme.</p></Group>}
      {sectionView === "notifications" && <><Group title="Reminder status"><p style={{margin:0,color:"#fff"}}>Permission: <strong>{notificationSupported ? notificationPermission : "Unsupported"}</strong></p>{notificationSupported && <ActionButton onClick={onRequestReminderPermission} tone="tinted" color="#2D7DD2">{notificationPermission === "granted" ? "Enabled" : "Enable reminders"}</ActionButton>}</Group>{notificationSupported && <Group title="Streak protection"><p style={{margin:0,color:"#fff"}}>Remind me when I haven’t trained for {devicePrefs.reminderThresholdDays || 3} days</p><input type="range" min="2" max="5" value={devicePrefs.reminderThresholdDays || 3} onChange={(e)=>setDevicePrefs(c=>({...c,reminderThresholdDays:Number(e.target.value),lastReminderKey:null}))} style={{width:"100%",accentColor:"#2D7DD2"}} /></Group>}<Group title="Testing"><ActionButton onClick={onSendTestReminder} tone="secondary" disabled={!notificationSupported}>Send test reminder</ActionButton></Group><Group title="Device support"><p style={{margin:0,color:"#8A8F9C",fontSize:12}}>Browser support: {notificationSupported ? "Available" : "Unsupported"}</p><p style={{margin:0,color:"#8A8F9C",fontSize:12}}>Service worker: {serviceWorkerSupported ? "Available" : "Unavailable"}</p></Group></>}
      {sectionView === "coachVoice" && <Group title="Personas">{[{k:"balanced",d:"Clear, supportive, direct.",q:"Good session. You stayed consistent. Next time, push the top set slightly."},{k:"strict",d:"No excuses, accountability focused.",q:"You said you wanted progress. Log the work or stop pretending."},{k:"hype",d:"High-energy motivation.",q:"That’s a PR. Lock in — we’re stacking wins now."},{k:"calm",d:"Low-pressure, steady.",q:"You showed up. That counts. Let’s build from here."},{k:"technical",d:"Form, numbers, progression.",q:"Volume is trending up. Keep RIR stable before increasing load."}].map(p=><button key={p.k} onClick={()=>setProfile({coachVoice:p.k,coachPersona:p.k})} style={{...IS,textAlign:"left",borderColor:selectedCoach===p.k?"rgba(78,161,255,0.7)":"rgba(255,255,255,0.08)",cursor:"pointer"}}><strong style={{color:"#fff",textTransform:"capitalize"}}>{p.k}</strong><br/><span style={{color:"#8A8F9C"}}>{p.d}</span><br/><span style={{color:"#bbb",fontStyle:"italic"}}>“{p.q}”</span></button>)}</Group>}
      {sectionView === "account" && <><Group title="Account"><p style={{margin:0,color:"#fff"}}>Email: <strong>{firebaseUser?.email || "Signed out"}</strong></p><p style={{margin:0,color:"#fff"}}>Display name: <strong>{displayName}</strong></p><p style={{margin:0,color:"#8A8F9C"}}>Status: {firebaseUser ? "Signed in" : "Signed out"}</p></Group><Group title="Sync"><p style={{margin:0,color:"#fff"}}>Cloud sync status: <strong>{syncText}</strong></p><p style={{margin:0,color:"#8A8F9C"}}>Last synced: {firestoreSync?.lastSyncedAt ? new Date(firestoreSync.lastSyncedAt).toLocaleString() : "—"}</p>{firestoreSync?.error && <p style={{margin:0,color:"#FF8A8A"}}>{firestoreSync.error}</p>}</Group>{firebaseUser && <ActionButton tone="secondary" onClick={()=>setSignOutOpen(true)}>Sign out</ActionButton>}</>}
      {sectionView === "dataBackup" && <><Group title="Training data"><p style={{margin:0,color:"#fff"}}>{dataCounts.workouts} workouts</p><p style={{margin:0,color:"#fff"}}>{dataCounts.cardio} cardio sessions</p><p style={{margin:0,color:"#fff"}}>{dataCounts.basketball} basketball sessions</p><p style={{margin:0,color:"#fff"}}>{dataCounts.pbs} PBs</p></Group><Group title="Wellness data"><p style={{margin:0,color:"#fff"}}>{dataCounts.recovery} recovery logs</p><p style={{margin:0,color:"#fff"}}>{dataCounts.weighIns} weigh-ins</p><p style={{margin:0,color:"#fff"}}>{dataCounts.reviews} weekly reviews</p></Group><Group title="Backup actions"><ActionButton onClick={onExportData} tone="tinted" color="#2D7DD2">Export backup</ActionButton><ActionButton onClick={()=>fileInputRef.current?.click()} tone="tinted" color="#F5A623">Import backup</ActionButton><ActionButton onClick={openRestorePreview} tone="tinted" color="#45B649">Restore local backup</ActionButton><input ref={fileInputRef} type="file" accept="application/json" onChange={handleImportFile} style={{display:"none"}} />{importError && <p style={{margin:0,color:"#FF8A8A",fontSize:12}}>{importError}</p>}</Group><Group title="Cloud sync"><p style={{margin:0,color:"#fff"}}>{syncText}</p><p style={{margin:0,color:"#8A8F9C",fontSize:12}}>Last synced: {firestoreSync?.lastSyncedAt ? new Date(firestoreSync.lastSyncedAt).toLocaleString() : "—"}</p></Group><ProfileRow icon="trash" label="Danger Zone" summary="Reset all data" danger onClick={()=>onOpenSection("dangerZone")} /></>}
      {sectionView === "dangerZone" && <SurfaceCard style={{borderColor:"rgba(255,93,93,0.3)",background:"rgba(255,93,93,0.05)"}}><p style={{margin:"0 0 6px",color:"#FF8A8A",fontWeight:800}}>Reset all data</p><p style={{margin:"0 0 14px",color:"#8A8F9C",fontSize:12}}>Permanently deletes workouts, cardio, basketball data, stats, PBs, preferences and local/cloud data.</p><ActionButton onClick={()=>setResetOpen(true)} tone="danger">Reset all data</ActionButton></SurfaceCard>}
      {sectionView === "about" && <Group title="App"><p style={{margin:0,color:"#fff",fontWeight:700}}>Orion Gym Tracker</p><p style={{margin:0,color:"#8A8F9C"}}>Version 1.0.0</p></Group>}
      {sectionView === "importPreview" && importPreview && <Group title="Import backup"><p style={{margin:0,color:"#fff",fontWeight:700}}>Found in backup</p><p style={{margin:0,color:"#8A8F9C"}}>{importPreview.summary.workouts} workouts · {importPreview.summary.recovery} recovery logs · {importPreview.summary.weighIns} weigh-ins · {importPreview.summary.pbs} PBs · {preferencesIncluded(importPreview.summary)}</p><p style={{margin:"8px 0 0",color:"#fff",fontWeight:700}}>Current app data</p><p style={{margin:0,color:"#8A8F9C"}}>{importPreview.current.workouts} workouts · {importPreview.current.recovery} recovery logs · {importPreview.current.weighIns} weigh-ins · {importPreview.current.pbs} PBs</p><p style={{margin:"8px 0",color:"#FFCA8A",fontSize:12}}>Importing a backup replaces your current data with the data inside the file.</p><ActionButton onClick={()=>{onExportData?.(); applyImportedData(importPreview.data);}} tone="tinted" color="#2D7DD2">Create safety backup and import</ActionButton><ActionButton onClick={()=>applyImportedData(importPreview.data)} tone="danger">Import without safety backup</ActionButton><ActionButton onClick={()=>{setImportPreview(null);closeSection();}} tone="secondary">Cancel</ActionButton></Group>}
      {sectionView === "restorePreview" && restorePreview && <Group title="Restore local backup"><p style={{margin:0,color:"#fff",fontWeight:700}}>Backup found</p><p style={{margin:0,color:"#8A8F9C"}}>{restorePreview.summary.workouts} workouts · {restorePreview.summary.pbs} PBs · {preferencesIncluded(restorePreview.summary)}</p><p style={{margin:"8px 0",color:"#FFCA8A",fontSize:12}}>Restoring uses the last local backup saved on this device and replaces your current data.</p><ActionButton onClick={()=>{onExportData?.(); dbSave(restorePreview.data); setApp(restorePreview.data); setRestorePreview(null); closeSection();}} tone="tinted" color="#2D7DD2">Create safety export and restore</ActionButton><ActionButton onClick={()=>{dbSave(restorePreview.data); setApp(restorePreview.data); setRestorePreview(null); closeSection();}} tone="danger">Restore backup</ActionButton><ActionButton onClick={()=>{setRestorePreview(null);closeSection();}} tone="secondary">Cancel</ActionButton></Group>}
      <ConfirmModal open={resetOpen} title="Reset all data?" message={`This permanently deletes all your workouts, cardio, basketball sessions, recovery logs, body stats, weekly reviews, preferences and PBs on this device${firebaseUser ? " and in your cloud account" : ""}. This can't be undone.`} requireText="RESET" confirmLabel="Delete everything" onCancel={()=>setResetOpen(false)} onConfirm={()=>{setResetOpen(false);onResetAllData();}} />
      <ConfirmModal open={signOutOpen} title="Sign out?" message="Your data stays on this device, but cloud sync will stop until you sign back in." confirmLabel="Sign out" onCancel={()=>setSignOutOpen(false)} onConfirm={()=>{setSignOutOpen(false);onFirebaseSignOut?.();}} />
    </Screen>;
  }

  return (
    <Screen>
      <div style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 24px)", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{ width: 60, height: 60, borderRadius: 20, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(140deg, #4EA1FF, #8B5CF6)", color: "#fff", fontSize: 22, fontWeight: 800 }}>{initials}</div>
          <div style={{ minWidth: 0 }}><h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</h1>{firebaseUser?.email && <p style={{ margin: "3px 0 0", fontSize: 12, color: "#8A8F9C", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{firebaseUser.email}</p>}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>{[{ label: "Goal", value: goalLabel }, { label: "Weight", value: weightLabel }, { label: "Streak", value: `${streakSummary?.currentStreak || 0} wk` }].map((stat) => <div key={stat.label} style={{ flex: 1, minWidth: 0, textAlign: "center", padding: "11px 6px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}><p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stat.value}</p><p style={{ margin: "2px 0 0", fontSize: 10, color: "#6C6F7B", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>{stat.label}</p></div>)}</div>
      </div>
      <SurfaceCard style={{ borderColor: "rgba(78,161,255,0.25)", background: "rgba(78,161,255,0.07)" }}><div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}><div><p style={{ margin:0, color:"#fff", fontWeight:800 }}>{completionPercent >= 100 ? "Profile complete" : `Profile ${completionPercent}% complete`}</p><p style={{ margin:"4px 0 0", color:"#8BA6C9", fontSize:12 }}>Next: {nextAction}</p></div><div style={{ width:52, height:52, borderRadius:999, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(255,255,255,0.06)", color:"#fff", fontWeight:800 }}>{completionPercent}%</div></div></SurfaceCard>
      <div style={{ display: "grid", gap: 10 }}>
        <ProfileRow icon="user" label="Edit profile" summary={(profile.name || profile.firstName || "").trim() || "Not set"} onClick={()=>onOpenSection("editProfile")} />
        <ProfileRow icon="scale" label="Body & Goals" summary={bodyGoalsSummary} onClick={()=>onOpenSection("bodyGoals")} />
        <ProfileRow icon="clipboard" label="What you track" summary={trackedSummary} onClick={()=>onOpenSection("trackingModules")} />
        <ProfileRow icon="spark" label="Preferences" summary={`${unitLabel} · ${devicePrefs.soundEnabled !== false ? "Sound on" : "Sound off"} · ${devicePrefs.hapticsEnabled !== false ? "Haptics on" : "Haptics off"}`} onClick={()=>onOpenSection("preferences")} />
        <ProfileRow icon="bell" label="Notifications" summary={notificationSummary} onClick={()=>onOpenSection("notifications")} />
        <ProfileRow icon="pulse" label="Coach voice" summary={coachLabel} onClick={()=>onOpenSection("coachVoice")} />
        <ProfileRow icon="user" label="Account" summary={syncText} onClick={()=>onOpenSection("account")} />
        <ProfileRow icon="barChart" label="Data & Backup" summary={dataSummary} onClick={()=>onOpenSection("dataBackup")} />
        <ProfileRow icon="info" label="About" summary="v1.0.0" onClick={()=>onOpenSection("about")} />
      </div>
      <ConfirmModal
        open={resetOpen}
        title="Reset all data?"
        message={`This permanently deletes all your workouts, cardio, stats and PBs on this device${firebaseUser ? " and in your cloud account" : ""}. This can't be undone.`}
        requireText="RESET"
        confirmLabel="Delete everything"
        onCancel={() => setResetOpen(false)}
        onConfirm={() => { setResetOpen(false); onResetAllData(); }}
      />
    </Screen>
  );
}
