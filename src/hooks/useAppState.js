import { useCallback, useEffect, useRef, useState } from "react";
import { fetchRemoteApp, getCloudClient, isCloudConfigured, saveRemoteApp } from "../cloud.js";
import { NAV, WQ } from "../data.js";
import { DB, DB_BACKUP, DD, dbLoad, dbRestoreBackup, dbSave, hasAnyUserData, isValidData, parseStoredDate, stampAppData, today, withDefaults } from "../storage.js";
import { createWorkoutSnapshot, getExercisesForWorkout, getWorkoutById } from "../workouts.js";

const CLOUD_SYNC_DELAY_MS = 1200;

function createWorkoutSession(workoutId) {
  const workout = getWorkoutById(workoutId);
  if (!workout) {
    return null;
  }

  const sets = {};
  getExercisesForWorkout(workout).forEach((exercise, index) => {
    sets[`${index}-${exercise.name}`] = Array.from({ length: exercise.sets }, () => ({ kg: "", reps: "" }));
  });

  return {
    workoutId,
    workoutSnapshot: createWorkoutSnapshot(workout),
    date: today(),
    energy: 7,
    sets,
    prehabDone: false,
    coreDone: false,
    notes: "",
    painFlags: { shoulder: 1, ankle: 1, hip: 1 },
    timer: { running: false, startedAt: null, lastResumedAt: null, accumulated: 0 },
  };
}

function getSessionStamp(app) {
  return app?.meta?.lastSavedAt || 0;
}

function getCloudMessage(text, tone = "neutral") {
  return text ? { text, tone } : null;
}

export function useAppState() {
  const [app, setAppState] = useState(() => withDefaults(dbLoad()));
  const [view, setView] = useState("home");
  const [workoutId, setWorkoutId] = useState(null);
  const [session, setSession] = useState(null);
  const [historyDetailIndex, setHistoryDetailIndex] = useState(null);
  const [sectionView, setSectionView] = useState(null);
  const [expandedExercise, setExpandedExercise] = useState(null);
  const [prehabOpen, setPrehabOpen] = useState(true);
  const [coreOpen, setCoreOpen] = useState(false);
  const [recoveryForm, setRecoveryForm] = useState(null);
  const [bodyStatsForm, setBodyStatsForm] = useState(null);
  const [reviewForm, setReviewForm] = useState(null);
  const [cloud, setCloud] = useState({
    available: isCloudConfigured,
    loading: isCloudConfigured,
    user: null,
    authMode: "signin",
    email: "",
    password: "",
    syncing: false,
    lastSyncedAt: null,
    message: isCloudConfigured ? null : getCloudMessage("Cloud sync is optional. Add Supabase keys to turn it on."),
  });

  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const localSaveTimeoutRef = useRef(null);
  const cloudSaveTimeoutRef = useRef(null);
  const skipNextCloudPushRef = useRef(false);
  const appRef = useRef(app);
  const cloudClient = getCloudClient();

  useEffect(() => {
    appRef.current = app;
  }, [app]);

  const applyApp = useCallback((updater, options = {}) => {
    const { stamp = true } = options;
    setAppState((current) => {
      const resolved = typeof updater === "function" ? updater(current) : updater;
      const nextApp = withDefaults(resolved);
      return stamp ? stampAppData(nextApp) : nextApp;
    });
  }, []);

  const setApp = useCallback((updater) => {
    applyApp(updater);
  }, [applyApp]);

  useEffect(() => {
    clearTimeout(localSaveTimeoutRef.current);
    localSaveTimeoutRef.current = setTimeout(() => {
      dbSave(app);
    }, 400);

    return () => clearTimeout(localSaveTimeoutRef.current);
  }, [app]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [view, sectionView]);

  const syncCloudNow = useCallback(async (userOverride) => {
    const user = userOverride || cloud.user;
    if (!cloudClient || !user) {
      return null;
    }

    try {
      setCloud((current) => ({ ...current, syncing: true, message: current.message?.tone === "error" ? null : current.message }));
      const saved = await saveRemoteApp(user.id, appRef.current);
      setCloud((current) => ({
        ...current,
        syncing: false,
        lastSyncedAt: saved?.updatedAt || new Date().toISOString(),
        message: getCloudMessage("Cloud sync complete.", "success"),
      }));
      return saved;
    } catch (error) {
      setCloud((current) => ({
        ...current,
        syncing: false,
        message: getCloudMessage(error.message || "Cloud sync failed.", "error"),
      }));
      return null;
    }
  }, [cloud.user, cloudClient]);

  const pullCloudState = useCallback(async (user) => {
    if (!cloudClient || !user) {
      return;
    }

    try {
      setCloud((current) => ({ ...current, syncing: true }));
      const remote = await fetchRemoteApp(user.id);
      const local = appRef.current;

      if (!remote?.app) {
        if (hasAnyUserData(local)) {
          await syncCloudNow(user);
        } else {
          setCloud((current) => ({
            ...current,
            syncing: false,
            message: getCloudMessage("Signed in. Your cloud account is ready.", "success"),
          }));
        }
        return;
      }

      const remoteStamp = getSessionStamp(remote.app);
      const localStamp = getSessionStamp(local);

      if (remoteStamp > localStamp) {
        skipNextCloudPushRef.current = true;
        applyApp(remote.app, { stamp: false });
        dbSave(remote.app);
        setCloud((current) => ({
          ...current,
          syncing: false,
          lastSyncedAt: remote.updatedAt,
          message: getCloudMessage("Loaded your latest cloud backup.", "success"),
        }));
        return;
      }

      if (localStamp > remoteStamp || hasAnyUserData(local)) {
        await syncCloudNow(user);
        return;
      }

      setCloud((current) => ({
        ...current,
        syncing: false,
        lastSyncedAt: remote.updatedAt,
      }));
    } catch (error) {
      setCloud((current) => ({
        ...current,
        syncing: false,
        message: getCloudMessage(error.message || "Could not load cloud data.", "error"),
      }));
    }
  }, [applyApp, cloudClient, syncCloudNow]);

  useEffect(() => {
    if (!cloudClient) {
      setCloud((current) => ({ ...current, loading: false }));
      return undefined;
    }

    let active = true;

    cloudClient.auth.getSession().then(({ data, error }) => {
      if (!active) {
        return;
      }

      const user = data.session?.user || null;
      setCloud((current) => ({
        ...current,
        loading: false,
        user,
        message: error ? getCloudMessage(error.message, "error") : current.message,
      }));

      if (user) {
        pullCloudState(user);
      }
    });

    const {
      data: { subscription },
    } = cloudClient.auth.onAuthStateChange((event, nextSession) => {
      const user = nextSession?.user || null;
      setCloud((current) => ({
        ...current,
        loading: false,
        user,
        message: event === "SIGNED_OUT"
          ? getCloudMessage("Signed out. Local data on this device is still available.")
          : current.message,
      }));

      if (user && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED")) {
        pullCloudState(user);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [cloudClient, pullCloudState]);

  useEffect(() => {
    if (!cloudClient || !cloud.user) {
      return undefined;
    }

    if (skipNextCloudPushRef.current) {
      skipNextCloudPushRef.current = false;
      return undefined;
    }

    clearTimeout(cloudSaveTimeoutRef.current);
    cloudSaveTimeoutRef.current = setTimeout(() => {
      syncCloudNow();
    }, CLOUD_SYNC_DELAY_MS);

    return () => clearTimeout(cloudSaveTimeoutRef.current);
  }, [app, cloud.user, cloudClient, syncCloudNow]);

  const exportData = useCallback(() => {
    try {
      const blob = new Blob([JSON.stringify(app, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `orion-gym-backup-${today()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // Ignore export failures in-browser.
    }
  }, [app]);

  const importData = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const fileReader = new FileReader();
    fileReader.onload = () => {
      try {
        const parsed = JSON.parse(fileReader.result);
        if (!isValidData(parsed)) {
          window.alert("Invalid backup file.");
          return;
        }
        const nextApp = stampAppData(withDefaults(parsed));
        dbSave(nextApp);
        applyApp(nextApp, { stamp: false });
        window.alert("Data imported successfully.");
      } catch {
        window.alert("Could not import this file.");
      }
    };
    fileReader.readAsText(file);
    event.target.value = "";
  }, [applyApp]);

  const restoreBackup = useCallback(() => {
    const restored = dbRestoreBackup();
    if (!restored) {
      window.alert("No valid backup found.");
      return;
    }
    applyApp(restored, { stamp: false });
    window.alert("Backup restored.");
  }, [applyApp]);

  const updateSet = useCallback((exerciseKey, setIndex, field, value) => {
    setSession((current) => {
      const nextSets = { ...current.sets };
      const exerciseSets = [...nextSets[exerciseKey]];
      exerciseSets[setIndex] = { ...exerciseSets[setIndex], [field]: value };
      nextSets[exerciseKey] = exerciseSets;
      return { ...current, sets: nextSets };
    });
  }, []);

  const startWorkout = useCallback((nextWorkoutId) => {
    const nextSession = createWorkoutSession(nextWorkoutId);
    if (!nextSession) {
      return;
    }

    setSession(nextSession);
    setWorkoutId(nextWorkoutId);
    setView("log");
    setExpandedExercise(null);
    setPrehabOpen(true);
    setCoreOpen(false);
  }, []);

  const finishWorkout = useCallback(() => {
    if (!session) {
      return;
    }

    const timer = session.timer;
    const currentSeconds = timer.running && timer.lastResumedAt ? Math.floor((Date.now() - timer.lastResumedAt) / 1000) : 0;
    const duration = Math.round((timer.accumulated + currentSeconds) / 60);
    const finishedSession = {
      ...session,
      workoutSnapshot: session.workoutSnapshot || createWorkoutSnapshot(getWorkoutById(session.workoutId)),
      duration,
      startedAt: timer.startedAt,
      finishedAt: Date.now(),
    };
    delete finishedSession.timer;

    applyApp((current) => {
      const workout = finishedSession.workoutSnapshot || getWorkoutById(finishedSession.workoutId);
      const personalBests = { ...current.personalBests };

      getExercisesForWorkout(workout).forEach((exercise, index) => {
        if (!exercise.tracked) {
          return;
        }
        (finishedSession.sets[`${index}-${exercise.name}`] || []).forEach((setData) => {
          const kg = parseFloat(setData.kg);
          if (kg > 0 && kg > (personalBests[exercise.name]?.kg || 0)) {
            personalBests[exercise.name] = { kg, reps: setData.reps, date: finishedSession.date };
          }
        });
      });

      return {
        ...current,
        sessions: [...current.sessions, finishedSession],
        personalBests,
        phaseStart: current.phaseStart || today(),
      };
    });

    setView("home");
    setWorkoutId(null);
    setSession(null);
  }, [applyApp, session]);

  const cancelWorkout = useCallback(() => {
    if (!window.confirm("Discard this session?")) {
      return;
    }

    setView("home");
    setWorkoutId(null);
    setSession(null);
    setExpandedExercise(null);
    setPrehabOpen(true);
    setCoreOpen(false);
  }, []);

  const getPhaseProgress = useCallback(() => {
    if (!app.phaseStart) {
      return { phase: 0, week: 0, deload: false };
    }

    const phaseStart = parseStoredDate(app.phaseStart);
    if (!phaseStart) {
      return { phase: 0, week: 0, deload: false };
    }

    const week = Math.min(Math.floor((Date.now() - phaseStart.getTime()) / (7 * 86400000)) + 1, 12);
    return {
      phase: week <= 4 ? 0 : week <= 8 ? 1 : 2,
      week,
      deload: week === 4 || week === 8 || week === 12,
    };
  }, [app.phaseStart]);

  const closeMoreSection = useCallback(() => {
    setSectionView(null);
    setRecoveryForm(null);
    setBodyStatsForm(null);
    setReviewForm(null);
  }, []);

  const openMoreSection = useCallback((key) => {
    setSectionView(key);

    if (key === "recovery") {
      setRecoveryForm(app.recovery.find((entry) => entry.date === today()) || { date: today(), sleep: 8, water: 3, mobilityDone: false });
    }
    if (key === "bodystats") {
      setBodyStatsForm({ date: today(), weight: app.bodyStats.length ? app.bodyStats[app.bodyStats.length - 1].weight : 210 });
    }
    if (key === "review") {
      setReviewForm(WQ.map(() => ""));
    }
  }, [app.bodyStats, app.recovery]);

  const openRecoveryFromHome = useCallback(() => {
    setView("more");
    openMoreSection("recovery");
  }, [openMoreSection]);

  const openReviewFromHome = useCallback(() => {
    setView("more");
    openMoreSection("review");
  }, [openMoreSection]);

  const navigate = useCallback((nextView) => {
    setView(nextView);
    setHistoryDetailIndex(null);
    closeMoreSection();
  }, [closeMoreSection]);

  const resetAllData = useCallback(() => {
    if (!window.confirm("This permanently removes all local data on this device. Continue?")) {
      return;
    }
    const confirmation = (window.prompt("Type DELETE to confirm reset") || "").trim();
    if (confirmation !== "DELETE") {
      return;
    }

    try {
      localStorage.removeItem(DB);
      localStorage.removeItem(DB_BACKUP);
    } catch {
      // Ignore local storage cleanup issues.
    }

    applyApp(DD());
  }, [applyApp]);

  const submitCloudAuth = useCallback(async () => {
    if (!cloudClient) {
      return;
    }

    const email = cloud.email.trim();
    const password = cloud.password;

    if (!email || !password) {
      setCloud((current) => ({ ...current, message: getCloudMessage("Enter both email and password.", "error") }));
      return;
    }

    try {
      setCloud((current) => ({ ...current, loading: true, message: null }));

      if (cloud.authMode === "signup") {
        const { data, error } = await cloudClient.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
          },
        });

        if (error) {
          throw error;
        }

        setCloud((current) => ({
          ...current,
          loading: false,
          email: "",
          password: "",
          user: data.user || current.user,
          message: data.session
            ? getCloudMessage("Account created and signed in.", "success")
            : getCloudMessage("Account created. Check your email to confirm it, then sign in.", "success"),
        }));
        return;
      }

      const { error } = await cloudClient.auth.signInWithPassword({ email, password });
      if (error) {
        throw error;
      }

      setCloud((current) => ({
        ...current,
        loading: false,
        email: "",
        password: "",
        message: getCloudMessage("Signed in successfully.", "success"),
      }));
    } catch (error) {
      setCloud((current) => ({
        ...current,
        loading: false,
        message: getCloudMessage(error.message || "Authentication failed.", "error"),
      }));
    }
  }, [cloud.authMode, cloud.email, cloud.password, cloudClient]);

  const signOutCloud = useCallback(async () => {
    if (!cloudClient) {
      return;
    }

    const { error } = await cloudClient.auth.signOut();
    if (error) {
      setCloud((current) => ({ ...current, message: getCloudMessage(error.message, "error") }));
    }
  }, [cloudClient]);

  const sessionsThisWeek = app.sessions.filter((entry) => {
    const sessionDate = parseStoredDate(entry.date);
    return sessionDate && (Date.now() - sessionDate.getTime()) / 86400000 < 7;
  }).length;

  return {
    app,
    bodyStatsForm,
    cloud,
    coreOpen,
    expandedExercise,
    fileInputRef,
    getPhaseProgress,
    historyDetailIndex,
    navigate,
    openMoreSection,
    prehabOpen,
    recoveryForm,
    reviewForm,
    scrollRef,
    sectionView,
    session,
    sessionsThisWeek,
    setApp,
    setBodyStatsForm,
    setCloud,
    setCoreOpen,
    setExpandedExercise,
    setHistoryDetailIndex,
    setPrehabOpen,
    setRecoveryForm,
    setReviewForm,
    setSession,
    submitCloudAuth,
    signOutCloud,
    syncCloudNow,
    view,
    workoutId,
    actions: {
      cancelWorkout,
      closeMoreSection,
      exportData,
      finishWorkout,
      importData,
      openRecoveryFromHome,
      openReviewFromHome,
      resetAllData,
      restoreBackup,
      startWorkout,
      updateSet,
    },
    navItems: NAV,
  };
}
