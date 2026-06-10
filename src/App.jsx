import { NI } from "./components/WorkoutComponents.jsx";
import { CelebrationOverlay } from "./components/ui.jsx";
import { BasketballScreen } from "./screens/BasketballScreen.jsx";
import { BikeRoutineScreen } from "./screens/BikeRoutineScreen.jsx";
import { HistoryScreen } from "./screens/HistoryScreen.jsx";
import { HomeScreen } from "./screens/HomeScreen.jsx";
import { LogScreen } from "./screens/LogScreen.jsx";
import { MoreScreen } from "./screens/MoreScreen.jsx";
import { PersonalBestsScreen } from "./screens/PersonalBestsScreen.jsx";
import { ProgressScreen } from "./screens/ProgressScreen.jsx";
import { useAppState } from "./hooks/useAppState.js";
import { colors, radii, typeScale } from "./theme.js";

export function App() {
  const {
    app,
    bodyStatsForm,
    celebration,
    cloud,
    coreOpen,
    devicePrefs,
    expandedExercise,
    fileInputRef,
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
    setCloud,
    setCoreOpen,
    setDevicePrefs,
    setExpandedExercise,
    setHistoryDetailIndex,
    setPrehabOpen,
    setRecoveryForm,
    setReviewForm,
    setSession,
    submitCloudAuth,
    streakSummary,
    signOutCloud,
    toggleCloudSync,
    view,
    workoutId,
    actions,
  } = useAppState();

  let content = null;
  if (view === "home") {
    content = (
      <HomeScreen
        app={app}
        sessionsThisWeek={sessionsThisWeek}
        getPhaseProgress={getPhaseProgress}
        onOpenRecovery={actions.openRecoveryFromHome}
        onOpenReview={actions.openReviewFromHome}
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
    content = <BasketballScreen onExit={() => navigate("home")} />;
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
        cloud={cloud}
        closeSection={actions.closeMoreSection}
        fileInputRef={fileInputRef}
        getPhaseProgress={getPhaseProgress}
        onCloudSignOut={signOutCloud}
        onCloudSubmit={submitCloudAuth}
        onToggleCloudSync={toggleCloudSync}
        onExportData={actions.exportData}
        onImportData={actions.importData}
        onOpenSection={openMoreSection}
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
        setCloud={setCloud}
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
