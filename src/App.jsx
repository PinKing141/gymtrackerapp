import { NI } from "./components/WorkoutComponents.jsx";
import { CelebrationOverlay } from "./components/ui.jsx";
import { AuthScreen } from "./screens/AuthScreen.jsx";
import { BasketballScreen } from "./screens/BasketballScreen.jsx";
import { BikeRoutineScreen } from "./screens/BikeRoutineScreen.jsx";
import { HistoryScreen } from "./screens/HistoryScreen.jsx";
import { HomeScreen } from "./screens/HomeScreen.jsx";
import { LogScreen } from "./screens/LogScreen.jsx";
import { MoreScreen } from "./screens/MoreScreen.jsx";
import { OnboardingScreen } from "./screens/OnboardingScreen.jsx";
import { PersonalBestsScreen } from "./screens/PersonalBestsScreen.jsx";
import { ProgressScreen } from "./screens/ProgressScreen.jsx";
import { useAppState } from "./hooks/useAppState.js";
import { useFirebaseAuth } from "./hooks/useFirebaseAuth.js";
import { signOutUser } from "./services/firebaseAuth.js";
import { colors, radii, typeScale } from "./theme.js";

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
        onSaveWorkoutPreset={actions.saveWorkoutPreset}
        onDeleteWorkoutPreset={actions.deleteWorkoutPreset}
        onStartWorkout={actions.startWorkout}
        onUseWeekFreeze={actions.useCurrentWeekFreeze}
        streakSummary={streakSummary}
      />
    );
  }
  if (view === "bike") {
    content = (
      <BikeRoutineScreen
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
  if (view === "history") {
    content = (
      <HistoryScreen
        app={app}
        detailIndex={historyDetailIndex}
        setDetailIndex={setHistoryDetailIndex}
        setApp={setApp}
      />
    );
  }
  if (view === "progress") {
    content = <ProgressScreen app={app} />;
  }
  if (view === "pbs") {
    content = <PersonalBestsScreen app={app} />;
  }
  if (view === "more") {
    content = (
      <MoreScreen
        app={app}
        bodyStatsForm={bodyStatsForm}
        closeSection={actions.closeMoreSection}
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
            justifyContent: "space-around",
            padding: "6px 0 env(safe-area-inset-bottom, 6px)",
            zIndex: 100,
          }}
        >
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "5px 12px",
                color: view === item.id ? colors.textPrimary : colors.textMuted,
                background: view === item.id ? "rgba(78,161,255,0.14)" : "transparent",
                borderRadius: radii.pill,
                ...typeScale.caption,
                letterSpacing: "0.02em",
              }}
            >
              <NI d={item.icon} />
              <span>{item.l}</span>
            </button>
          ))}
        </div>
      )}
      <CelebrationOverlay celebration={celebration} onDismiss={actions.dismissCelebration} />
    </div>
  );
}
