import { Spark } from "../components/WorkoutComponents.jsx";
import { Icon, WaterGlassIcon } from "../components/icons.jsx";
import { ActionButton, BackButton, Screen, ScreenHeader, SurfaceButton, SurfaceCard, TextAreaField } from "../components/ui.jsx";
import { PHASES, WQ } from "../data.js";
import { DD, IS, fd, today } from "../storage.js";

const cloudMessageColors = {
  error: "#E84545",
  success: "#45B649",
  neutral: "#888",
};

function formatSyncTime(value) {
  if (!value) {
    return "Not synced yet";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not synced yet";
  }

  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MoreScreen({
  app,
  bodyStatsForm,
  cloud,
  closeSection,
  fileInputRef,
  getPhaseProgress,
  onCloudSignOut,
  onCloudSubmit,
  onCloudSync,
  onExportData,
  onImportData,
  onOpenSection,
  onResetAllData,
  onRestoreBackup,
  recoveryForm,
  reviewForm,
  sectionView,
  devicePrefs,
  notificationPermission,
  notificationSupported,
  onRequestReminderPermission,
  onSendTestReminder,
  setApp,
  setBodyStatsForm,
  setCloud,
  setDevicePrefs,
  setRecoveryForm,
  setReviewForm,
}) {
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

  return (
    <Screen>
      <ScreenHeader title="More" />

      {[
        { key: "recovery", icon: "pulse", title: "Recovery Log", description: "Sleep, hydration, mobility" },
        { key: "bodystats", icon: "scale", title: "Body Stats", description: "Bodyweight check-in" },
        { key: "review", icon: "clipboard", title: "Weekly Review", description: "Sunday accountability" },
        { key: "phase", icon: "barChart", title: "Phase Tracker", description: "12-week progression" },
      ].map((item) => (
        <SurfaceButton key={item.key} onClick={() => onOpenSection(item.key)} style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <Icon name={item.icon} size={18} color="#9AA4B3" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "#fff" }}>{item.title}</p>
            <p style={{ fontSize: 11, color: "#555", margin: "2px 0 0" }}>{item.description}</p>
          </div>
          <span style={{ color: "#555", fontSize: 18 }}>›</span>
        </SurfaceButton>
      ))}

      <SurfaceCard style={{ marginTop: 16 }}>
        <p style={{ fontSize: 11, color: "#555", margin: "0 0 8px", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>Notifications</p>
        <p style={{ fontSize: 12, color: "#bbb", margin: "0 0 8px" }}>Get reminders when you have missed the gym for 2 days.</p>
        {!notificationSupported ? (
          <p style={{ fontSize: 11, color: "#666", margin: 0 }}>This browser does not support notifications.</p>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <p style={{ margin: 0, fontSize: 11, color: "#888" }}>Status: {notificationPermission}</p>
              <ActionButton onClick={onRequestReminderPermission} tone="tinted" color="#2D7DD2" compact fullWidth={false}>
                {notificationPermission === "granted" ? "Enabled" : "Enable"}
              </ActionButton>
            </div>
            <div style={{ marginTop: 10 }}>
              <p style={{ margin: "0 0 6px", fontSize: 10, color: "#666" }}>Reminder trigger (days since last session)</p>
              <input type="range" min="2" max="5" value={devicePrefs.reminderThresholdDays} onChange={(event) => setDevicePrefs((current) => ({ ...current, reminderThresholdDays: Number(event.target.value), lastReminderKey: null }))} style={{ width: "100%", accentColor: "#2D7DD2" }} />
              <p style={{ margin: "3px 0 0", fontSize: 11, color: "#8BA6C9", fontWeight: 600 }}>{devicePrefs.reminderThresholdDays} day threshold</p>
            </div>
            <ActionButton onClick={onSendTestReminder} tone="secondary" compact style={{ marginTop: 10 }}>
              Send Test Reminder
            </ActionButton>
          </>
        )}
      </SurfaceCard>

      <SurfaceCard style={{ marginTop: 16 }}>
        <p style={{ fontSize: 11, color: "#555", margin: "0 0 8px", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>Cloud Sync</p>
        {!cloud.available ? (
          <>
            <p style={{ fontSize: 12, color: "#bbb", margin: "0 0 6px" }}>Local storage is active on this device.</p>
            <p style={{ fontSize: 11, color: "#666", margin: 0 }}>To use the same data across multiple phones or browsers, add Supabase env keys and create the table in `supabase/schema.sql`.</p>
          </>
        ) : cloud.user ? (
          <>
            <p style={{ fontSize: 13, color: "#fff", fontWeight: 600, margin: "0 0 4px" }}>{cloud.user.email}</p>
            <p style={{ fontSize: 11, color: "#666", margin: "0 0 10px" }}>Last sync: {formatSyncTime(cloud.lastSyncedAt)}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <ActionButton onClick={() => onCloudSync()} tone="tinted" color="#2D7DD2" compact>{cloud.syncing ? "Syncing..." : "Sync Now"}</ActionButton>
              <ActionButton onClick={onCloudSignOut} tone="secondary" compact>Sign Out</ActionButton>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button onClick={() => setCloud((current) => ({ ...current, authMode: "signin", message: null }))} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, background: cloud.authMode === "signin" ? "rgba(45,125,210,0.2)" : "rgba(255,255,255,0.04)", color: cloud.authMode === "signin" ? "#2D7DD2" : "#666" }}>Sign In</button>
              <button onClick={() => setCloud((current) => ({ ...current, authMode: "signup", message: null }))} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, background: cloud.authMode === "signup" ? "rgba(245,166,35,0.2)" : "rgba(255,255,255,0.04)", color: cloud.authMode === "signup" ? "#F5A623" : "#666" }}>Create Account</button>
            </div>
            <input type="email" autoComplete="email" value={cloud.email} onChange={(event) => setCloud((current) => ({ ...current, email: event.target.value }))} placeholder="Email" style={{ ...IS, marginBottom: 8 }} />
            <input type="password" autoComplete={cloud.authMode === "signup" ? "new-password" : "current-password"} value={cloud.password} onChange={(event) => setCloud((current) => ({ ...current, password: event.target.value }))} placeholder="Password" style={IS} />
            <ActionButton onClick={onCloudSubmit} color={cloud.authMode === "signup" ? "#F5A623" : "#2D7DD2"} style={{ marginTop: 10 }}>
              {cloud.loading ? "Working..." : cloud.authMode === "signup" ? "Create Account" : "Sign In"}
            </ActionButton>
          </>
        )}
        {cloud.message && <p style={{ fontSize: 11, color: cloudMessageColors[cloud.message.tone] || "#888", margin: "10px 0 0" }}>{cloud.message.text}</p>}
      </SurfaceCard>

      <SurfaceCard style={{ marginTop: 16 }}>
        <p style={{ fontSize: 11, color: "#555", margin: "0 0 8px", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>Data</p>
        <div style={{ fontSize: 12, color: "#888" }}>
          <p style={{ margin: "3px 0" }}>{app.sessions.length} sessions · {app.recovery.length} recovery logs</p>
          <p style={{ margin: "3px 0" }}>{app.bodyStats.length} weigh-ins · {app.weeklyReviews.length} reviews · {Object.keys(app.personalBests).length} PBs</p>
        </div>
      </SurfaceCard>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
        <ActionButton onClick={onExportData} tone="tinted" color="#2D7DD2" compact>Export Backup</ActionButton>
        <ActionButton onClick={() => fileInputRef.current?.click()} tone="tinted" color="#F5A623" compact>Import Backup</ActionButton>
      </div>
      <input ref={fileInputRef} type="file" accept="application/json" onChange={onImportData} style={{ display: "none" }} />
      <ActionButton onClick={onRestoreBackup} tone="tinted" color="#45B649" compact style={{ marginTop: 8 }}>Restore Local Backup</ActionButton>
      <ActionButton onClick={() => { if (cloud.user && !window.confirm("Resetting now will also sync the empty state to your cloud account. Continue?")) { return; } onResetAllData(); }} tone="danger" compact style={{ marginTop: 10 }}>Reset All Data</ActionButton>
    </Screen>
  );
}
