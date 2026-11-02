import { useRef, useState } from "react";
import { Spark } from "../components/WorkoutComponents.jsx";
import { ConfirmModal } from "../components/ConfirmModal.jsx";
import { Icon, WaterGlassIcon } from "../components/icons.jsx";
import { ActionButton, BackButton, Screen, ScreenHeader, SurfaceCard, TextAreaField } from "../components/ui.jsx";
import { ProfileRow, SubScreenHeader as Header } from "../components/ProfileSettings.jsx";
import { summarizeBackupData } from "../profileBackupPreview.js";
import { getBodyGoalsSummary, getDataSummary, getDisplayName, getEnabledModuleSummary, getGoalLabel, getInitials, getNextProfileAction, getNotificationSummary, getProfileCompletion, getSyncSummary, getUnitLabel, getWeightLabel } from "../profileSummary.js";
import { PHASES, WQ } from "../data.js";
import { backupLoad, dbSave, fd, IS, isValidData, today, withDefaults } from "../storage.js";
import { calculateCalories } from "../units.js";
import { readAvatarFile } from "../services/avatar.js";
import { AboutSection, AccountSection } from "./more/AccountSections.jsx";
import { DangerZoneSection, DataBackupSection, ImportPreviewSection, RestorePreviewSection } from "./more/DataSections.jsx";
import { MAIN_MODULES } from "./more/modules.js";
import { AppearanceSection, getSoundHapticsSummary, NotificationsSection, PreferencesSection, SoundHapticsSection, UnitsSection } from "./more/PreferenceSections.jsx";
import { AvatarEditButton } from "./more/ProfileAvatar.jsx";
import { BodyGoalsSection, EditProfileSection, TrackingModulesSection } from "./more/ProfileSections.jsx";

const SECTION_TITLES = {
  editProfile: "Edit profile",
  bodyGoals: "Body & Goals",
  trackingModules: "What you track",
  preferences: "Preferences",
  units: "Units",
  soundHaptics: "Sound & Haptics",
  appearance: "Appearance",
  notifications: "Notifications",
  account: "Account",
  dataBackup: "Data & Backup",
  dangerZone: "Danger Zone",
  about: "About",
  importPreview: "Import preview",
  restorePreview: "Restore preview",
};

// Replace the entry for the same date, or append a new one.
function upsertByDate(entries, entry) {
  const next = [...entries];
  const index = next.findIndex((item) => item.date === entry.date);
  if (index >= 0) {
    next[index] = entry;
  } else {
    next.push(entry);
  }
  return next;
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
  onExportStats,
  onOpenSection,
  firebaseUser,
  firestoreSync,
  onFirebaseSignOut,
  onRemoveAccountFromDevice,
  onDeleteAccount,
  onResetAllData,
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

  if (sectionView === "recovery" && recoveryForm) {
    return (
      <Screen>
        <ScreenHeader action={<BackButton onClick={closeSection} />} title="Recovery log" subtitle={fd(today())} topPadding="calc(env(safe-area-inset-top, 0px) + 20px)" />

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

        <ActionButton onClick={() => { setApp((current) => ({ ...current, recovery: upsertByDate(current.recovery, recoveryForm) })); closeSection(); }} color="#2D7DD2" style={{ marginTop: 10 }}>
          Save
        </ActionButton>

        {app.recovery.length >= 2 && <SurfaceCard style={{ marginTop: 20 }}><p style={{ fontSize: 12, fontWeight: 600, color: "#fff", margin: "0 0 6px" }}>Sleep trend</p><Spark data={app.recovery.slice(-14).map((entry) => entry.sleep)} color="#2D7DD2" height={36} /></SurfaceCard>}
      </Screen>
    );
  }

  if (sectionView === "bodystats" && bodyStatsForm) {
    return (
      <Screen>
        <ScreenHeader action={<BackButton onClick={closeSection} />} title="Body stats" topPadding="calc(env(safe-area-inset-top, 0px) + 20px)" />
        <SurfaceCard style={{ marginTop: 20 }}>
          <p style={{ fontSize: 12, color: "#999", margin: "0 0 8px" }}>Bodyweight (lbs)</p>
          <input type="number" inputMode="decimal" value={bodyStatsForm.weight} onChange={(event) => setBodyStatsForm((current) => ({ ...current, weight: Number(event.target.value) }))} style={{ ...IS, fontSize: 22, textAlign: "center", padding: "14px" }} />
          <p style={{ fontSize: 9, color: "#444", marginTop: 6, marginBottom: 0 }}>Target: 201–220 lbs</p>
        </SurfaceCard>
        <ActionButton onClick={() => { setApp((current) => ({ ...current, bodyStats: upsertByDate(current.bodyStats, bodyStatsForm) })); closeSection(); }} color="#F5A623" style={{ marginTop: 10 }}>
          Save
        </ActionButton>

        {app.bodyStats.length > 0 && (
          <SurfaceCard style={{ marginTop: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#fff", margin: "0 0 6px" }}>History</p>
            {app.bodyStats.length >= 2 && <Spark data={app.bodyStats.slice(-12).map((entry) => entry.weight)} color="#F5A623" height={36} />}
            <div style={{ marginTop: 8 }}>
              {[...app.bodyStats].reverse().slice(0, 8).map((entry) => (
                <div key={entry.date} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <span style={{ fontSize: 11, color: "#666" }}>{fd(entry.date)}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{entry.weight} lbs</span>
                </div>
              ))}
            </div>
          </SurfaceCard>
        )}
      </Screen>
    );
  }

  if (sectionView === "review" && reviewForm) {
    return (
      <Screen>
        <ScreenHeader action={<BackButton onClick={closeSection} />} title="Weekly review" topPadding="calc(env(safe-area-inset-top, 0px) + 20px)" />

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
              {state === "active" && deload && (
                <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(245,166,35,0.08)", borderRadius: 8, border: "1px solid rgba(245,166,35,0.15)" }}>
                  <p style={{ fontSize: 11, color: "#F5A623", margin: 0, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon name="spark" size={13} color="#F5A623" />Deload week
                  </p>
                  <p style={{ fontSize: 10, color: "#8A8F9C", margin: "3px 0 0" }}>Weights −40% · Conditioning −50% · Keep prehab · Sleep 9 hrs</p>
                </div>
              )}
            </SurfaceCard>
          );
        })}

        {!started && <ActionButton onClick={() => setApp((current) => ({ ...current, phaseStart: today() }))} color="#2D7DD2" style={{ marginTop: 10 }}>Start cycle</ActionButton>}
        {started && <ActionButton onClick={() => { if (window.confirm("Reset cycle start date to today?")) { setApp((current) => ({ ...current, phaseStart: today() })); } }} tone="secondary" compact style={{ marginTop: 10 }}>Reset cycle</ActionButton>}
      </Screen>
    );
  }

  const enabledModules = { gym: true, ...(profile.enabledModules || {}) };
  const unitSystem = profile.unitSystem || "imperial";
  const calorieStats = calculateCalories(profile);
  const displayName = getDisplayName(profile);
  const initials = getInitials(displayName);
  const unitLabel = getUnitLabel(profile);
  const syncText = getSyncSummary({ firebaseUser, firestoreSync });

  const setProfile = (patch) => setApp((current) => ({ ...current, profile: { ...(current.profile || {}), ...patch } }));
  const toggleModule = (key) => setApp((current) => ({
    ...current,
    profile: {
      ...current.profile,
      enabledModules: { ...(current.profile.enabledModules || {}), [key]: !current.profile.enabledModules?.[key], gym: true },
    },
  }));

  // Read a chosen photo, centre-crop to a square and shrink it to ~256px so the
  // resulting data URL is small enough to sync inside the Firestore doc.
  const handleAvatarFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    readAvatarFile(file)
      .then((avatar) => setProfile({ avatar }))
      .catch(() => {});
  };
  const pickAvatar = () => avatarInputRef.current?.click();
  const avatarInput = <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarFile} style={{ display: "none" }} />;

  const applyImportedData = (data) => {
    const nextApp = withDefaults(data);
    dbSave(nextApp);
    setApp(nextApp);
    setImportPreview(null);
    goBackSection?.();
    window.alert("Data imported successfully.");
  };

  const handleImportFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!isValidData(parsed)) {
          setImportError("Invalid backup file.");
          return;
        }
        setImportPreview({ data: withDefaults(parsed), summary: summarizeBackupData(parsed), current: summarizeBackupData(app) });
        onOpenSection("importPreview");
      } catch {
        setImportError("Could not read this backup file.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const openRestorePreview = () => {
    const parsed = backupLoad();
    if (!parsed) {
      window.alert("No valid backup found.");
      return;
    }
    setRestorePreview({ data: withDefaults(parsed), summary: summarizeBackupData(parsed), current: summarizeBackupData(app) });
    onOpenSection("restorePreview");
  };

  const restoreFromPreview = () => {
    dbSave(restorePreview.data);
    setApp(restorePreview.data);
    setRestorePreview(null);
    goBackSection?.();
  };

  if (SECTION_TITLES[sectionView]) {
    return (
      <Screen>
        <Header
          onBack={goBackSection || closeSection}
          title={SECTION_TITLES[sectionView]}
          subtitle={sectionView === "bodyGoals" ? "The better this is, the better your training targets work." : undefined}
        />

        {sectionView === "editProfile" && (
          <EditProfileSection
            profile={profile}
            displayName={displayName}
            initials={initials}
            email={firebaseUser?.email}
            onPickAvatar={pickAvatar}
            avatarInput={avatarInput}
            setProfile={setProfile}
          />
        )}
        {sectionView === "bodyGoals" && (
          <BodyGoalsSection profile={profile} unitSystem={unitSystem} calorieStats={calorieStats} setProfile={setProfile} />
        )}
        {sectionView === "trackingModules" && <TrackingModulesSection enabledModules={enabledModules} toggleModule={toggleModule} />}
        {sectionView === "preferences" && <PreferencesSection unitLabel={unitLabel} devicePrefs={devicePrefs} onOpenSection={onOpenSection} />}
        {sectionView === "units" && <UnitsSection unitSystem={unitSystem} setUnitSystem={(next) => setProfile({ unitSystem: next })} />}
        {sectionView === "soundHaptics" && <SoundHapticsSection devicePrefs={devicePrefs} setDevicePrefs={setDevicePrefs} />}
        {sectionView === "appearance" && <AppearanceSection />}
        {sectionView === "notifications" && (
          <NotificationsSection
            devicePrefs={devicePrefs}
            setDevicePrefs={setDevicePrefs}
            notificationPermission={notificationPermission}
            notificationSupported={notificationSupported}
            serviceWorkerSupported={serviceWorkerSupported}
            onRequestReminderPermission={onRequestReminderPermission}
            onSendTestReminder={onSendTestReminder}
          />
        )}
        {sectionView === "account" && (
          <AccountSection
            firebaseUser={firebaseUser}
            displayName={displayName}
            syncText={syncText}
            firestoreSync={firestoreSync}
            onSignOut={() => setSignOutOpen(true)}
            onRemoveAccountFromDevice={onRemoveAccountFromDevice}
            onDeleteAccount={onDeleteAccount}
          />
        )}
        {sectionView === "dataBackup" && (
          <DataBackupSection
            dataCounts={getDataSummary(app).counts}
            syncText={syncText}
            firestoreSync={firestoreSync}
            importError={importError}
            fileInputRef={fileInputRef}
            onImportFile={handleImportFile}
            onExportData={onExportData}
            onExportStats={onExportStats}
            onOpenRestorePreview={openRestorePreview}
            onOpenSection={onOpenSection}
          />
        )}
        {sectionView === "dangerZone" && <DangerZoneSection onReset={() => setResetOpen(true)} />}
        {sectionView === "about" && <AboutSection />}
        {sectionView === "importPreview" && importPreview && (
          <ImportPreviewSection
            preview={importPreview}
            onImportWithBackup={() => { onExportData?.(); applyImportedData(importPreview.data); }}
            onImport={() => applyImportedData(importPreview.data)}
            onCancel={() => { setImportPreview(null); goBackSection?.(); }}
          />
        )}
        {sectionView === "restorePreview" && restorePreview && (
          <RestorePreviewSection
            preview={restorePreview}
            onRestoreWithBackup={() => { onExportData?.(); restoreFromPreview(); }}
            onRestore={restoreFromPreview}
            onCancel={() => { setRestorePreview(null); goBackSection?.(); }}
          />
        )}

        <ConfirmModal
          open={resetOpen}
          title="Reset all data?"
          message={`This permanently deletes all your workouts, cardio, basketball sessions, recovery logs, body stats, weekly reviews, preferences and PBs on this device${firebaseUser ? " and in your cloud account" : ""}. This can't be undone.`}
          requireText="RESET"
          confirmLabel="Delete everything"
          onCancel={() => setResetOpen(false)}
          onConfirm={() => { setResetOpen(false); onResetAllData(); }}
        />
        <ConfirmModal
          open={signOutOpen}
          title="Sign out?"
          message="Your data stays on this device, but cloud sync will stop until you sign back in."
          confirmLabel="Sign out"
          onCancel={() => setSignOutOpen(false)}
          onConfirm={() => { setSignOutOpen(false); onFirebaseSignOut?.(); }}
        />
      </Screen>
    );
  }

  const completionPercent = getProfileCompletion({ profile, enabledModules, notificationPermission });
  const nextAction = getNextProfileAction({ profile, enabledModules, notificationPermission });
  const summaryStats = [
    { label: "Goal", value: getGoalLabel(profile.goal) },
    { label: "Weight", value: getWeightLabel(profile) },
    { label: "Streak", value: `${streakSummary?.currentStreak || 0} wk` },
  ];
  const ellipsis = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

  return (
    <Screen>
      <div style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 24px)", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <AvatarEditButton profile={profile} initials={initials} size={60} radius={20} fontSize={22} ringColor="#0A0A0F" onClick={pickAvatar} />
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#fff", ...ellipsis }}>{displayName}</h1>
            {firebaseUser?.email && <p style={{ margin: "3px 0 0", fontSize: 12, color: "#8A8F9C", ...ellipsis }}>{firebaseUser.email}</p>}
          </div>
        </div>
        {avatarInput}
        <div style={{ display: "flex", gap: 8 }}>
          {summaryStats.map((stat) => (
            <div key={stat.label} style={{ flex: 1, minWidth: 0, textAlign: "center", padding: "11px 6px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#fff", ...ellipsis }}>{stat.value}</p>
              <p style={{ margin: "2px 0 0", fontSize: 10, color: "#6C6F7B", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <SurfaceCard style={{ borderColor: "rgba(78,161,255,0.25)", background: "rgba(78,161,255,0.07)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <p style={{ margin: 0, color: "#fff", fontWeight: 800 }}>{completionPercent >= 100 ? "Profile complete" : `Profile ${completionPercent}% complete`}</p>
            <p style={{ margin: "4px 0 0", color: "#8BA6C9", fontSize: 12 }}>Next: {nextAction}</p>
          </div>
          <div style={{ width: 52, height: 52, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 800 }}>
            {completionPercent}%
          </div>
        </div>
      </SurfaceCard>

      <div style={{ display: "grid", gap: 10 }}>
        <ProfileRow icon="user" label="Edit profile" summary={(profile.name || profile.firstName || "").trim() || "Not set"} onClick={() => onOpenSection("editProfile")} />
        <ProfileRow icon="scale" label="Body & Goals" summary={getBodyGoalsSummary({ profile, calorieStats })} onClick={() => onOpenSection("bodyGoals")} />
        <ProfileRow icon="clipboard" label="What you track" summary={getEnabledModuleSummary(profile, MAIN_MODULES)} onClick={() => onOpenSection("trackingModules")} />
        <ProfileRow icon="calendar" label="Training cycle" summary={app.phaseStart ? `Week ${getPhaseProgress().week} of 12` : "Not started"} onClick={() => onOpenSection("phase")} />
        <ProfileRow icon="spark" label="Preferences" summary={`${unitLabel} · ${getSoundHapticsSummary(devicePrefs)}`} onClick={() => onOpenSection("preferences")} />
        <ProfileRow
          icon="bell"
          label="Notifications"
          summary={getNotificationSummary({ supported: notificationSupported, permission: notificationPermission, thresholdDays: devicePrefs.reminderThresholdDays })}
          onClick={() => onOpenSection("notifications")}
        />
        <ProfileRow icon="user" label="Account" summary={syncText} onClick={() => onOpenSection("account")} />
        <ProfileRow icon="barChart" label="Data & Backup" summary={getDataSummary(app).label} onClick={() => onOpenSection("dataBackup")} />
        <ProfileRow icon="info" label="About" summary="v1.0.0" onClick={() => onOpenSection("about")} />
      </div>
    </Screen>
  );
}
