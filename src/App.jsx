import { useState } from "react";
import { CelebrationOverlay } from "./components/ui.jsx";
import { Icon } from "./components/icons.jsx";
import { QuickAddSheet } from "./components/QuickAddSheet.jsx";
import { AuthScreen } from "./screens/AuthScreen.jsx";
import { BasketballScreen } from "./screens/BasketballScreen.jsx";
import { CardioScreen } from "./screens/CardioScreen.jsx";
import { HomeScreen } from "./screens/HomeScreen.jsx";
import { LogScreen } from "./screens/LogScreen.jsx";
import { MoreScreen } from "./screens/MoreScreen.jsx";
import { NutritionScreen } from "./screens/NutritionScreen.jsx";
import { OnboardingScreen } from "./screens/OnboardingScreen.jsx";
import { ProgressHubScreen } from "./screens/ProgressHubScreen.jsx";
import { TrainScreen } from "./screens/TrainScreen.jsx";
import { useAppState } from "./hooks/useAppState.js";
import { useFirebaseAuth } from "./hooks/useFirebaseAuth.js";
import { signOutUser } from "./services/firebaseAuth.js";
import { colors, radii, typeScale } from "./theme.js";

const NAV_TABS = [
  { id: "home", label: "Home", icon: "home" },
  { id: "train", label: "Train", icon: "dumbbell" },
  { id: "progress", label: "Progress", icon: "barChart" },
  { id: "more", label: "Profile", icon: "user" },
];

function NavTab({ item, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "6px 10px",
        width: 64,
        color: active ? colors.accent : colors.textMuted,
        ...typeScale.caption,
      }}
    >
      <Icon name={item.icon} size={22} color={active ? colors.accent : colors.textMuted} />
      <span style={{ fontWeight: active ? 700 : 500 }}>{item.label}</span>
    </button>
  );
}

export function App() {
  const { user: firebaseUser, authLoading, isLoggedIn } = useFirebaseAuth();
  const {
    app,
    bodyStatsForm,
    celebration,
    coreOpen,
    devicePrefs,
    expandedExercise,
    fileInputRef,
    firestoreSync,
    getPhaseProgress,
    historyDetailIndex,
    navItems,
    navigate,
    notificationPermission,
    notificationSupported,
    openMoreSection,
    goBackMoreSection,
    prehabOpen,
    recoveryForm,
    reviewForm,
    scrollRef,
    sectionView,
    serviceWorkerSupported,
    session,
    sessionNotice,
    sessionsThisWeek,
    setApp,
    setBodyStatsForm,
    setCoreOpen,
    setDevicePrefs,
    setExpandedExercise,
    setHistoryDetailIndex,
    setPrehabOpen,
    setRecoveryForm,
    setReviewForm,
    setSession,
    streakSummary,
    view,
    workoutId,
    actions,
  } = useAppState(firebaseUser);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: colors.background,
          color: colors.textMuted,
          fontFamily: "'SF Pro Display',-apple-system,system-ui,sans-serif",
          fontSize: 13,
        }}
      >
        Loading…
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div
        style={{
          maxWidth: 430,
          margin: "0 auto",
          minHeight: "100dvh",
          background: colors.background,
          color: colors.textPrimary,
          fontFamily: "'SF Pro Display',-apple-system,system-ui,sans-serif",
        }}
      >
        <AuthScreen />
      </div>
    );
  }

  // Onboarding gate: logged in but profile not yet set up. Wait out the initial
  // Firestore load so a returning user's cloud profile isn't overwritten by a
  // premature onboarding flash.
  const onboardingReady = firestoreSync?.status !== "loading";
  if (onboardingReady && !app.profile?.onboardingComplete) {
    return (
      <div
        style={{
          maxWidth: 430,
          margin: "0 auto",
          minHeight: "100dvh",
          background: colors.background,
          color: colors.textPrimary,
          fontFamily: "'SF Pro Display',-apple-system,system-ui,sans-serif",
        }}
      >
        <OnboardingScreen
          profile={app.profile}
          onComplete={(patch) => setApp((current) => ({ ...current, profile: { ...current.profile, ...patch } }))}
        />
      </div>
    );
  }

  let content = null;
  if (view === "home") {
    content = (
      <HomeScreen
        app={app}
        sessionsThisWeek={sessionsThisWeek}
        getPhaseProgress={getPhaseProgress}
        onOpenRecovery={actions.openRecoveryFromHome}
        onOpenReview={actions.openReviewFromHome}
        onNavigate={navigate}
        streakSummary={streakSummary}
      />
    );
  }
  if (view === "train") {
    content = (
      <TrainScreen
        app={app}
        onStartWorkout={actions.startWorkout}
        onSaveWorkoutPreset={actions.saveWorkoutPreset}
        onDeleteWorkoutPreset={actions.deleteWorkoutPreset}
        onNavigate={navigate}
      />
    );
  }
  if (view === "cardio") {
    content = (
      <CardioScreen
        app={app}
        onLogCardio={actions.logCardioSession}
        notificationPermission={notificationPermission}
        notificationSupported={notificationSupported}
        onRequestReminderPermission={actions.requestReminderPermission}
      />
    );
  }
  if (view === "log") {
    content = (
      <LogScreen
        app={app}
        expandedExercise={expandedExercise}
        onToggleExercise={setExpandedExercise}
        prehabOpen={prehabOpen}
        setPrehabOpen={setPrehabOpen}
        coreOpen={coreOpen}
        setCoreOpen={setCoreOpen}
        session={session}
        sessionNotice={sessionNotice}
        setSession={setSession}
        workoutId={workoutId}
        onUpdateSet={actions.updateSet}
        onFinishWorkout={actions.finishWorkout}
        onCancelWorkout={actions.cancelWorkout}
      />
    );
  }
  if (view === "basketball") {
    content = <BasketballScreen onExit={() => navigate("home")} firebaseUser={firebaseUser} />;
  }
  if (view === "nutrition") {
    content = <NutritionScreen app={app} />;
  }
  if (view === "progress") {
    content = (
      <ProgressHubScreen
        app={app}
        historyDetailIndex={historyDetailIndex}
        setHistoryDetailIndex={setHistoryDetailIndex}
        setApp={setApp}
      />
    );
  }
  if (view === "more") {
    content = (
      <MoreScreen
        app={app}
        bodyStatsForm={bodyStatsForm}
        closeSection={actions.closeMoreSection}
        goBackSection={goBackMoreSection}
        fileInputRef={fileInputRef}
        getPhaseProgress={getPhaseProgress}
        onExportData={actions.exportData}
        onImportData={actions.importData}
        onOpenSection={openMoreSection}
        firebaseUser={firebaseUser}
        firestoreSync={firestoreSync}
        onFirebaseSignOut={signOutUser}
        onResetAllData={actions.resetAllData}
        onRestoreBackup={actions.restoreBackup}
        recoveryForm={recoveryForm}
        reviewForm={reviewForm}
        sectionView={sectionView}
        devicePrefs={devicePrefs}
        notificationPermission={notificationPermission}
        notificationSupported={notificationSupported}
        serviceWorkerSupported={serviceWorkerSupported}
        setApp={setApp}
        setBodyStatsForm={setBodyStatsForm}
        setDevicePrefs={setDevicePrefs}
        setRecoveryForm={setRecoveryForm}
        setReviewForm={setReviewForm}
        streakSummary={streakSummary}
        onRequestReminderPermission={actions.requestReminderPermission}
        onSendTestReminder={actions.sendTestReminder}
        onUseWeekFreeze={actions.useCurrentWeekFreeze}
      />
    );
  }

  return (
    <div
      style={{
        maxWidth: 430,
        margin: "0 auto",
        minHeight: "100dvh",
        background: colors.background,
        color: colors.textPrimary,
        fontFamily: "'SF Pro Display',-apple-system,system-ui,sans-serif",
        position: "relative",
      }}
    >
      <div
        ref={scrollRef}
        style={{
          height: "100dvh",
          overflowY: "auto",
          paddingBottom: view === "log" ? "max(20px, env(safe-area-inset-bottom, 0px))" : "calc(92px + env(safe-area-inset-bottom, 0px))",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {content}
      </div>
      {view !== "log" && view !== "basketball" && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "100%",
            maxWidth: 430,
            background: "rgba(10,10,15,0.94)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderTop: `1px solid ${colors.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-around",
            padding: "6px 0 env(safe-area-inset-bottom, 6px)",
            zIndex: 100,
          }}
        >
          {NAV_TABS.slice(0, 2).map((item) => (
            <NavTab key={item.id} item={item} active={view === item.id} onClick={() => navigate(item.id)} />
          ))}
          <button
            type="button"
            onClick={() => setQuickAddOpen(true)}
            aria-label="Quick add"
            style={{
              width: 52,
              height: 52,
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              background: colors.accent,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 24px rgba(78,161,255,0.4)",
              marginTop: -18,
              flexShrink: 0,
            }}
          >
            <Icon name="plus" size={26} color="#fff" strokeWidth={2.4} />
          </button>
          {NAV_TABS.slice(2).map((item) => (
            <NavTab key={item.id} item={item} active={view === item.id} onClick={() => navigate(item.id)} />
          ))}
        </div>
      )}
      <QuickAddSheet
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        items={[
          { key: "workout", label: "Start a workout", desc: "Gym session", icon: "dumbbell", onClick: () => navigate("train") },
          ...(app.profile?.enabledModules?.cardio ? [{ key: "cardio", label: "Cardio session", desc: "Bike, treadmill, run", icon: "pulse", onClick: () => navigate("cardio") }] : []),
          ...(app.profile?.enabledModules?.basketball ? [{ key: "ball", label: "Shoot hoops", desc: "Basketball session", icon: "basketball", onClick: () => navigate("basketball") }] : []),
          { key: "recovery", label: "Log recovery", desc: "Sleep, hydration, mobility", icon: "pulse", onClick: () => actions.openRecoveryFromHome() },
          { key: "weigh", label: "Weigh in", desc: "Body stats check-in", icon: "scale", onClick: () => { navigate("more"); openMoreSection("bodystats"); } },
          ...(app.profile?.enabledModules?.nutrition ? [{ key: "nutrition", label: "Nutrition", desc: "Calorie target", icon: "clipboard", onClick: () => navigate("nutrition") }] : []),
        ]}
      />
      <CelebrationOverlay celebration={celebration} onDismiss={actions.dismissCelebration} />
    </div>
  );
}
