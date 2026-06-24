import { useCallback, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { fetchRemoteApp, getCloudClient, isCloudConfigured, saveRemoteApp } from "../cloud.js";
import { NAV, WQ } from "../data.js";
import {
  DB,
  DB_BACKUP,
  DD,
  devicePrefsLoad,
  devicePrefsReset,
  devicePrefsSave,
  draftClear,
  draftLoad,
  draftSave,
  dbLoad,
  dbRestoreBackup,
  dbSave,
  hasAnyUserData,
  isValidData,
  parseStoredDate,
  stampAppData,
  today,
  withDefaults,
} from "../storage.js";
import { applyWeeklyFreeze, getStreakSummary, getWeekKey, rewardCompletedWeek } from "../streaks.js";
import {
  createEmptySet,
  createWorkoutSnapshot,
  getExerciseRecordCandidate,
  getExercisesForWorkout,
  getWorkoutById,
  normalizeWorkoutPreset,
} from "../workouts.js";

const CLOUD_SYNC_DELAY_MS = 1200;
const CLOUD_SYNC_TIMEOUT_MS = 15000;

function createWorkoutSession(workoutId, workoutPresets) {
  const workout = getWorkoutById(workoutId, workoutPresets);
  if (!workout) {
    return null;
  }

  const sets = {};
  getExercisesForWorkout(workout).forEach((exercise, index) => {
    sets[`${index}-${exercise.name}`] = Array.from({ length: exercise.sets }, () => createEmptySet(exercise));
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

function createPresetId(title) {
  const slug = String(title || "custom")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 28) || "custom";
  return `custom-${slug}-${Date.now().toString(36)}`;
}

function getSessionStamp(app) {
  return app?.meta?.lastSavedAt || 0;
}

function getCloudMessage(text, tone = "neutral") {
  return text ? { text, tone } : null;
}

function buildReminderBody(daysSinceLastSession, streakSummary) {
  const sessionsRemaining = Math.max(0, (streakSummary?.weeklyTarget || 0) - (streakSummary?.currentWeekCount || 0));
  if (sessionsRemaining === 0) {
    return `Quick check-in: it has been ${daysSinceLastSession} day${daysSinceLastSession === 1 ? "" : "s"} since your last workout. You're on track this week—keep your momentum going.`;
  }
  return `Quick check-in: it has been ${daysSinceLastSession} day${daysSinceLastSession === 1 ? "" : "s"} since your last workout. Complete ${sessionsRemaining} more session${sessionsRemaining === 1 ? "" : "s"} to hit this week's goal.`;
}

export function useAppState() {
  const initialDraftRef = useRef(undefined);
  if (initialDraftRef.current === undefined) {
    initialDraftRef.current = draftLoad();
  }
  const initialDraft = initialDraftRef.current;

  const [app, setAppState] = useState(() => withDefaults(dbLoad()));
  const [view, setView] = useState(() => initialDraft ? "log" : "home");
  const [workoutId, setWorkoutId] = useState(() => initialDraft?.workoutId || null);
  const [session, setSession] = useState(() => initialDraft?.session || null);
  const [historyDetailIndex, setHistoryDetailIndex] = useState(null);
  const [sectionView, setSectionView] = useState(null);
  const [expandedExercise, setExpandedExercise] = useState(() => initialDraft?.expandedExercise || null);
  const [prehabOpen, setPrehabOpen] = useState(() => initialDraft?.prehabOpen !== false);
  const [coreOpen, setCoreOpen] = useState(() => Boolean(initialDraft?.coreOpen));
  const [recoveryForm, setRecoveryForm] = useState(null);
  const [bodyStatsForm, setBodyStatsForm] = useState(null);
  const [reviewForm, setReviewForm] = useState(null);
  const [sessionNotice, setSessionNotice] = useState(() => initialDraft ? "Draft restored from your last session." : null);
  const [celebration, setCelebration] = useState(null);
  const [devicePrefs, setDevicePrefsState] = useState(() => devicePrefsLoad());
  const [cloud, setCloud] = useState({
    available: isCloudConfigured,
    loading: isCloudConfigured,
    user: null,
    authMode: "signin",
    email: "",
    password: "",
    syncing: false,
    syncEnabled: devicePrefs.cloudSyncEnabled !== false,
    syncStartedAt: null,
    lastSyncedAt: null,
    message: isCloudConfigured ? null : getCloudMessage("Cloud sync is optional. Add Supabase keys to turn it on."),
  });

  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const localSaveTimeoutRef = useRef(null);
  const cloudSaveTimeoutRef = useRef(null);
  const draftSaveTimeoutRef = useRef(null);
  const skipNextCloudPushRef = useRef(false);
  const syncRequestRef = useRef(null);
  const appRef = useRef(app);
  const sessionRef = useRef(session);
  const workoutIdRef = useRef(workoutId);
  const expandedExerciseRef = useRef(expandedExercise);
  const prehabOpenRef = useRef(prehabOpen);
  const coreOpenRef = useRef(coreOpen);
  const cloudClient = getCloudClient();
  const notificationSupported = typeof window !== "undefined" && "Notification" in window;
  const serviceWorkerSupported = typeof navigator !== "undefined" && "serviceWorker" in navigator;
  const notificationPermission = notificationSupported ? Notification.permission : "unsupported";
  const streakSummary = getStreakSummary(app);

  const getDraftPayload = useCallback(() => {
    if (!sessionRef.current || !workoutIdRef.current) {
      return null;
    }

    return {
      workoutId: workoutIdRef.current,
      session: sessionRef.current,
      expandedExercise: expandedExerciseRef.current,
      prehabOpen: prehabOpenRef.current,
      coreOpen: coreOpenRef.current,
    };
  }, []);

  useEffect(() => {
    appRef.current = app;
  }, [app]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    workoutIdRef.current = workoutId;
  }, [workoutId]);

  useEffect(() => {
    expandedExerciseRef.current = expandedExercise;
  }, [expandedExercise]);

  useEffect(() => {
    prehabOpenRef.current = prehabOpen;
  }, [prehabOpen]);

  useEffect(() => {
    coreOpenRef.current = coreOpen;
  }, [coreOpen]);

  const setDevicePrefs = useCallback((updater) => {
    setDevicePrefsState((current) => {
      const nextPrefs = typeof updater === "function" ? updater(current) : updater;
      return devicePrefsSave(nextPrefs);
    });
  }, []);

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

  const showLocalNotification = useCallback(async (title, body) => {
    if (!notificationSupported || notificationPermission !== "granted") {
      return false;
    }

    try {
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration?.showNotification) {
          await registration.showNotification(title, {
            body,
            tag: "orion-gym-reminder",
            renotify: true,
          });
          return true;
        }
      }

      new Notification(title, { body });
      return true;
    } catch {
      try {
        new Notification(title, { body });
        return true;
      } catch {
        return false;
      }
    }
  }, [notificationPermission, notificationSupported]);

  useEffect(() => {
    clearTimeout(localSaveTimeoutRef.current);
    localSaveTimeoutRef.current = setTimeout(() => {
      dbSave(app);
    }, 400);

    return () => clearTimeout(localSaveTimeoutRef.current);
  }, [app]);

  useEffect(() => {
    clearTimeout(draftSaveTimeoutRef.current);

    if (!session || !workoutId) {
      draftClear();
      return undefined;
    }

    draftSaveTimeoutRef.current = setTimeout(() => {
      draftSave({
        workoutId,
        session,
        expandedExercise,
        prehabOpen,
        coreOpen,
      });
    }, 250);

    return () => clearTimeout(draftSaveTimeoutRef.current);
  }, [coreOpen, expandedExercise, prehabOpen, session, workoutId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const flushLocalState = () => {
      dbSave(appRef.current);
      const draftPayload = getDraftPayload();
      if (draftPayload) {
        draftSave(draftPayload);
      } else {
        draftClear();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushLocalState();
      }
    };

    window.addEventListener("pagehide", flushLocalState);
    window.addEventListener("beforeunload", flushLocalState);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", flushLocalState);
      window.removeEventListener("beforeunload", flushLocalState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [getDraftPayload]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [view, sectionView]);

  useEffect(() => {
    if (!celebration) {
      return undefined;
    }

    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([35, 25, 60]);
    }

    const timeoutId = setTimeout(() => setCelebration(null), 3200);
    return () => clearTimeout(timeoutId);
  }, [celebration]);

  useEffect(() => {
    if (!notificationSupported || notificationPermission !== "granted") {
      return;
    }

    if (!devicePrefs.reminderNotifications) {
      return;
    }

    const daysSinceLastSession = streakSummary.daysSinceLastSession;
    if (daysSinceLastSession === null || daysSinceLastSession < devicePrefs.reminderThresholdDays) {
      return;
    }

    const reminderKey = `${today()}-${daysSinceLastSession}`;
    if (devicePrefs.lastReminderKey === reminderKey) {
      return;
    }

    showLocalNotification("Gym reminder", buildReminderBody(daysSinceLastSession, streakSummary)).then((sent) => {
      if (sent) {
        setDevicePrefs((current) => ({ ...current, lastReminderKey: reminderKey }));
      }
    });
  }, [
    devicePrefs.lastReminderKey,
    devicePrefs.reminderNotifications,
    devicePrefs.reminderThresholdDays,
    notificationPermission,
    notificationSupported,
    setDevicePrefs,
    showLocalNotification,
    streakSummary.daysSinceLastSession,
    streakSummary,
  ]);


  useEffect(() => {
    if (typeof navigator === "undefined" || !serviceWorkerSupported || !notificationSupported) {
      return;
    }

    navigator.serviceWorker.ready
      .then(async (registration) => {
        const supportsPeriodic = "periodicSync" in registration;
        if (!supportsPeriodic || !devicePrefs.reminderNotifications || notificationPermission !== "granted") {
          return;
        }
        try {
          await registration.periodicSync.register("orion-gym-reminder-check", {
            minInterval: 24 * 60 * 60 * 1000,
          });
        } catch {
          // Periodic sync may be blocked by browser policies.
        }
      })
      .catch(() => {});
  }, [devicePrefs.reminderNotifications, notificationPermission, notificationSupported, serviceWorkerSupported]);

  const syncCloudNow = useCallback(async (userOverride, options = {}) => {
    const { silent = false } = options;
    const user = userOverride || cloud.user;
    if (!cloudClient || !user || !cloud.syncEnabled) {
      return null;
    }

    if (syncRequestRef.current) {
      return syncRequestRef.current;
    }

    const syncStartedAt = Date.now();
    setCloud((current) => ({
      ...current,
      syncing: true,
      syncStartedAt,
      message: silent && current.message?.tone === "error" ? current.message : (silent ? current.message : null),
    }));

    const syncPromise = (async () => {
      try {
        const saved = await Promise.race([
          saveRemoteApp(user.id, appRef.current),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Sync is taking longer than expected. Please try again in a moment.")), CLOUD_SYNC_TIMEOUT_MS);
          }),
        ]);
        setCloud((current) => ({
          ...current,
          syncing: false,
          syncStartedAt: null,
          lastSyncedAt: saved?.updatedAt || new Date().toISOString(),
          message: silent ? current.message : getCloudMessage("Cloud sync complete.", "success"),
        }));
        return saved;
      } catch (error) {
        setCloud((current) => ({
          ...current,
          syncing: false,
          syncStartedAt: null,
          message: getCloudMessage(error.message || "Cloud sync failed.", "error"),
        }));
        return null;
      } finally {
        syncRequestRef.current = null;
      }
    })();

    syncRequestRef.current = syncPromise;
    return syncPromise;
  }, [cloud.syncEnabled, cloud.user, cloudClient]);

  const pullCloudState = useCallback(async (user) => {
    if (!cloudClient || !user || !cloud.syncEnabled) {
      return;
    }

    try {
      setCloud((current) => ({ ...current, syncing: true, syncStartedAt: Date.now() }));
      const remote = await fetchRemoteApp(user.id);
      const local = appRef.current;

      if (!remote?.app) {
        if (hasAnyUserData(local)) {
          await syncCloudNow(user);
        } else {
          setCloud((current) => ({
            ...current,
            syncing: false,
            syncStartedAt: null,
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
          syncStartedAt: null,
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
        syncStartedAt: null,
        lastSyncedAt: remote.updatedAt,
      }));
    } catch (error) {
      setCloud((current) => ({
        ...current,
        syncing: false,
        syncStartedAt: null,
        message: getCloudMessage(error.message || "Could not load cloud data.", "error"),
      }));
    }
  }, [applyApp, cloud.syncEnabled, cloudClient, syncCloudNow]);

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

      if (user && cloud.syncEnabled) {
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

      if (user && cloud.syncEnabled && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED")) {
        pullCloudState(user);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [cloud.syncEnabled, cloudClient, pullCloudState]);

  useEffect(() => {
    if (!cloudClient || !cloud.user || !cloud.syncEnabled) {
      return undefined;
    }

    if (skipNextCloudPushRef.current) {
      skipNextCloudPushRef.current = false;
      return undefined;
    }

    clearTimeout(cloudSaveTimeoutRef.current);
    cloudSaveTimeoutRef.current = setTimeout(() => {
      syncCloudNow(undefined, { silent: true });
    }, CLOUD_SYNC_DELAY_MS);

    return () => clearTimeout(cloudSaveTimeoutRef.current);
  }, [app, cloud.syncEnabled, cloud.user, cloudClient, syncCloudNow]);

  const toggleCloudSync = useCallback(() => {
    const nextEnabled = !cloud.syncEnabled;
    setDevicePrefs((current) => ({ ...current, cloudSyncEnabled: nextEnabled }));

    if (!nextEnabled) {
      clearTimeout(cloudSaveTimeoutRef.current);
      setCloud((current) => ({
        ...current,
        syncEnabled: false,
        syncing: false,
        syncStartedAt: null,
        message: getCloudMessage("Cloud sync turned off for this device."),
      }));
      return;
    }

    setCloud((current) => ({
      ...current,
      syncEnabled: true,
      message: getCloudMessage("Cloud sync turned on.", "success"),
    }));

    if (cloud.user) {
      syncCloudNow(cloud.user);
    }
  }, [cloud.syncEnabled, cloud.user, setDevicePrefs, syncCloudNow]);

  const exportData = useCallback(() => {
    try {
      const workbook = XLSX.utils.book_new();
      const sessions = [...(app.sessions || [])].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
      const recovery = [...(app.recovery || [])].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
      const bodyStats = [...(app.bodyStats || [])].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

      const sessionsByWeek = sessions.reduce((acc, session) => {
        const key = getWeekKey(session.date || today());
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      const summaryRows = [
        ["Orion Gym - Workout Export"],
        ["Generated", new Date().toLocaleString()],
        [],
        ["Metric", "Value"],
        ["Total sessions", sessions.length],
        ["Current streak (weeks on target)", streakSummary.streakWeeks],
        ["Sessions this week", streakSummary.currentWeekCount],
        ["Weekly target", streakSummary.weeklyTarget],
        ["Recovery logs", recovery.length],
        ["Bodyweight entries", bodyStats.length],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
      summarySheet['!cols'] = [{ wch: 36 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

      const sessionRows = sessions.map((session) => ({
        Date: session.date || "",
        Workout: session.workoutSnapshot?.title || session.workoutSnapshot?.shortTitle || session.workoutId || "",
        Energy: session.energy ?? "",
        Duration_Min: Math.round((session.timer?.accumulated || 0) / 60000),
        Prehab_Done: session.prehabDone ? "Yes" : "No",
        Core_Done: session.coreDone ? "Yes" : "No",
        Notes: session.notes || "",
      }));
      const sessionSheet = XLSX.utils.json_to_sheet(sessionRows);
      sessionSheet['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(workbook, sessionSheet, "Sessions");

      const trendRows = [
        ["Week", "Sessions", "Bodyweight_lbs", "Sleep_hours", "Water_litres"],
        ...Object.entries(sessionsByWeek).sort(([a], [b]) => a.localeCompare(b)).map(([week, count]) => [week, count, "", "", ""]),
      ];
      const maxLen = Math.max(trendRows.length - 1, bodyStats.length, recovery.length);
      for (let i = 1; i <= maxLen; i += 1) {
        if (!trendRows[i]) trendRows[i] = ["", "", "", "", ""];
        if (bodyStats[i - 1]) trendRows[i][2] = bodyStats[i - 1].weight ?? "";
        if (recovery[i - 1]) {
          trendRows[i][3] = recovery[i - 1].sleep ?? "";
          trendRows[i][4] = recovery[i - 1].water ?? "";
        }
      }
      const trendSheet = XLSX.utils.aoa_to_sheet(trendRows);
      trendSheet['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(workbook, trendSheet, "Trend Data");

      XLSX.writeFile(workbook, `orion-gym-workout-stats-${today()}.xlsx`);
    } catch {
      // Ignore export failures in-browser.
    }
  }, [app, streakSummary]);

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
      if (!current) {
        return current;
      }
      const nextSets = { ...current.sets };
      const exerciseSets = [...(nextSets[exerciseKey] || [])];
      exerciseSets[setIndex] = { ...exerciseSets[setIndex], [field]: value };
      nextSets[exerciseKey] = exerciseSets;
      return { ...current, sets: nextSets };
    });
  }, []);

  const startWorkout = useCallback((nextWorkoutId) => {
    const nextSession = createWorkoutSession(nextWorkoutId, appRef.current.workoutPresets);
    if (!nextSession) {
      return;
    }

    setSession(nextSession);
    setWorkoutId(nextWorkoutId);
    setView("log");
    setExpandedExercise(null);
    setPrehabOpen(true);
    setCoreOpen(false);
    setSessionNotice("Draft autosaves on this device while you log.");
  }, []);

  const saveWorkoutPreset = useCallback((draft) => {
    const timestamp = Date.now();
    const preset = normalizeWorkoutPreset({
      ...draft,
      id: draft.id || createPresetId(draft.title || draft.shortTitle),
      source: "custom",
      day: "Custom",
      createdAt: draft.createdAt || timestamp,
      updatedAt: timestamp,
    }, appRef.current.workoutPresets?.length || 0);

    applyApp((current) => {
      const currentPresets = Array.isArray(current.workoutPresets) ? current.workoutPresets : [];
      const existingIndex = currentPresets.findIndex((item) => item.id === preset.id);
      const nextPresets = existingIndex >= 0
        ? currentPresets.map((item, index) => (index === existingIndex ? preset : item))
        : [...currentPresets, preset];
      return { ...current, workoutPresets: nextPresets };
    });

    return preset;
  }, [applyApp]);

  const deleteWorkoutPreset = useCallback((presetId) => {
    const preset = (appRef.current.workoutPresets || []).find((item) => item.id === presetId);
    if (!preset || preset.source !== "custom") {
      return;
    }
    if (!window.confirm(`Delete ${preset.shortTitle || preset.title}?`)) {
      return;
    }
    applyApp((current) => ({
      ...current,
      workoutPresets: (current.workoutPresets || []).filter((item) => item.id !== presetId),
    }));
  }, [applyApp]);

  const finishWorkout = useCallback(() => {
    if (!session) {
      return;
    }

    const currentApp = appRef.current;
    const timer = session.timer;
    const currentSeconds = timer.running && timer.lastResumedAt ? Math.floor((Date.now() - timer.lastResumedAt) / 1000) : 0;
    const duration = Math.round((timer.accumulated + currentSeconds) / 60);
    const finishedSession = {
      ...session,
      workoutSnapshot: session.workoutSnapshot || createWorkoutSnapshot(getWorkoutById(session.workoutId, currentApp.workoutPresets)),
      duration,
      startedAt: timer.startedAt,
      finishedAt: Date.now(),
    };
    delete finishedSession.timer;

    const workout = finishedSession.workoutSnapshot || getWorkoutById(finishedSession.workoutId, currentApp.workoutPresets);
    const personalBests = { ...currentApp.personalBests };
    const earnedRecords = new Map();

    getExercisesForWorkout(workout).forEach((exercise, index) => {
      const exerciseKey = `${index}-${exercise.name}`;
      (finishedSession.sets[exerciseKey] || []).forEach((setData) => {
        const candidate = getExerciseRecordCandidate(setData, exercise);
        const currentBest = Number(personalBests[exercise.name]?.value ?? personalBests[exercise.name]?.kg ?? 0);
        if (candidate && candidate.value > currentBest) {
          personalBests[exercise.name] = {
            value: candidate.value,
            unit: candidate.unit,
            kg: candidate.unit === "kg" ? candidate.value : 0,
            reps: candidate.reps || null,
            summary: candidate.summary,
            date: finishedSession.date,
          };
          earnedRecords.set(exercise.name, {
            name: exercise.name,
            value: candidate.value,
            unit: candidate.unit,
            summary: candidate.summary,
          });
        }
      });
    });

    const weekKey = getWeekKey(finishedSession.date);
    const beforeStreak = getStreakSummary(currentApp);
    let nextApp = {
      ...currentApp,
      sessions: [...currentApp.sessions, finishedSession],
      personalBests,
      phaseStart: currentApp.phaseStart || today(),
    };
    nextApp = rewardCompletedWeek(nextApp, weekKey);
    const afterStreak = getStreakSummary(nextApp);

    applyApp(nextApp);
    draftClear();
    setDevicePrefs((current) => ({ ...current, lastReminderKey: null }));
    setSessionNotice(null);

    const justCompletedWeek = !beforeStreak.currentWeekComplete && afterStreak.currentWeekComplete;
    if (earnedRecords.size || justCompletedWeek) {
      setCelebration({
        color: workout?.color || "#45B649",
        title: earnedRecords.size ? "New personal record" : "Week complete",
        subtitle: justCompletedWeek
          ? `Weekly streak: ${afterStreak.currentStreak} week${afterStreak.currentStreak === 1 ? "" : "s"}`
          : workout?.shortTitle || "Session complete",
        records: [...earnedRecords.values()],
        weekComplete: justCompletedWeek,
      });
    }

    setView("home");
    setWorkoutId(null);
    setSession(null);
    setExpandedExercise(null);
    setPrehabOpen(true);
    setCoreOpen(false);
  }, [applyApp, session, setDevicePrefs]);

  const cancelWorkout = useCallback(() => {
    if (!window.confirm("Discard this session?")) {
      return;
    }

    draftClear();
    setView("home");
    setWorkoutId(null);
    setSession(null);
    setExpandedExercise(null);
    setPrehabOpen(true);
    setCoreOpen(false);
    setSessionNotice(null);
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
      setRecoveryForm(app.recovery.find((entry) => entry.date === today()) || { date: today(), sleep: 8, water: 3, mobilityDone: false, recoveryState: 2, explosiveness: 2, jointCondition: 2, motivationState: 2, setQuality: 2 });
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

    draftClear();
    devicePrefsReset();
    setDevicePrefsState(devicePrefsLoad());
    setCelebration(null);
    setSessionNotice(null);
    applyApp(DD());
    setView("home");
    setWorkoutId(null);
    setSession(null);
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

  const useCurrentWeekFreeze = useCallback(() => {
    const currentApp = appRef.current;
    const nextApp = applyWeeklyFreeze(currentApp, getWeekKey(today()));
    if (nextApp === currentApp) {
      return false;
    }

    const afterStreak = getStreakSummary(nextApp);
    applyApp(nextApp);
    setCelebration({
      color: "#2D7DD2",
      title: "Streak protected",
      subtitle: `Freeze bank: ${afterStreak.freezeCredits}`,
      records: [],
      weekComplete: false,
    });
    return true;
  }, [applyApp]);

  const requestReminderPermission = useCallback(async () => {
    if (!notificationSupported) {
      return "unsupported";
    }

    const permission = await Notification.requestPermission();
    setDevicePrefs((current) => ({
      ...current,
      reminderNotifications: permission === "granted" ? true : current.reminderNotifications && permission === "granted",
      lastReminderKey: permission === "granted" ? current.lastReminderKey : null,
    }));
    return permission;
  }, [notificationSupported, setDevicePrefs]);

  const sendTestReminder = useCallback(() => {
    if (!notificationSupported || notificationPermission !== "granted") {
      return false;
    }

    showLocalNotification("Orion Gym Reminder", "Notifications are active. We'll remind you if training is overdue.");
    return true;
  }, [notificationPermission, notificationSupported, showLocalNotification]);

  const dismissCelebration = useCallback(() => {
    setCelebration(null);
  }, []);

  return {
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
    navigate,
    notificationPermission,
    notificationSupported,
    serviceWorkerSupported,
    openMoreSection,
    prehabOpen,
    recoveryForm,
    reviewForm,
    scrollRef,
    sectionView,
    session,
    sessionNotice,
    sessionsThisWeek: streakSummary.currentWeekCount,
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
    signOutCloud,
    streakSummary,
    submitCloudAuth,
    syncCloudNow,
    toggleCloudSync,
    view,
    workoutId,
    actions: {
      cancelWorkout,
      closeMoreSection,
      dismissCelebration,
      exportData,
      finishWorkout,
      importData,
      deleteWorkoutPreset,
      openRecoveryFromHome,
      openReviewFromHome,
      requestReminderPermission,
      resetAllData,
      restoreBackup,
      sendTestReminder,
      saveWorkoutPreset,
      startWorkout,
      updateSet,
      useCurrentWeekFreeze,
    },
    navItems: NAV,
  };
}
