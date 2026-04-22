import { useEffect, useMemo, useRef, useState } from "react";
import { PHASES, WORKOUTS } from "../data.js";
import { C, L, fd, fdu, today } from "../storage.js";
import { Icon } from "../components/icons.jsx";
import { ActionButton, Pill, Screen, ScreenHeader, SurfaceButton, SurfaceCard } from "../components/ui.jsx";

const BIKE_ROUTINES = [
  {
    id: "bike-w1-intervals",
    code: "W1",
    title: "Intervals (Primary Conditioning)",
    useWhen: "Use after an Upper session",
    totalTime: "22–25 min",
    steps: [
      { label: "Warm-up", seconds: 5 * 60, details: "Resistance 3–4 / 20 · RPM 65–75" },
      {
        label: "Main Set",
        rounds: 10,
        sequence: [
          { label: "HARD", seconds: 30, details: "Resistance 9–12 / 20 · RPM 90–100 · Effort 9/10" },
          { label: "EASY", seconds: 90, details: "Resistance 3–4 / 20 · RPM 60–70" },
        ],
      },
      {
        label: "Cooldown",
        options: [3 * 60, 4 * 60, 5 * 60],
        defaultSeconds: 4 * 60,
        details: "Easy spin",
      },
    ],
  },
  {
    id: "bike-w2-steady",
    code: "W2",
    title: "Steady State (Light Aerobic)",
    useWhen: "Use after Upper OR when legs feel okay",
    totalTime: "25–30 min",
    notes: ["✔ Slight sweat", "✔ You can talk comfortably", "❌ No leg burn"],
    steady: {
      options: [25 * 60, 30 * 60],
      defaultSeconds: 25 * 60,
      details: "Resistance 4–5 / 20 · RPM 65–75 · Effort 5–6/10",
    },
  },
  {
    id: "bike-w2-long-steady",
    code: "W2",
    title: "Long Steady (Fat Loss Focus)",
    useWhen: "Standalone or on lighter days",
    totalTime: "45–60 min",
    notes: ["✔ Consistent pace the whole time", "✔ Feels controlled, not draining", "❌ Do not turn this into a hard ride"],
    steady: {
      options: [45 * 60, 60 * 60],
      defaultSeconds: 45 * 60,
      details: "Resistance 4–5 / 20 · RPM 65–75 · Effort 5/10",
    },
  },
];

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0 && seconds === 0) {
    return `${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${seconds}s`;
}

function formatClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function buildTimerSequence(routine, selectedDurationByRoutine) {
  if (routine.steady) {
    const picked = selectedDurationByRoutine[routine.id] || routine.steady.defaultSeconds;
    return [{ label: routine.title, seconds: picked, details: routine.steady.details }];
  }

  const cooldownPicked = selectedDurationByRoutine[`${routine.id}-cooldown`] || routine.steps[2].defaultSeconds;
  const built = [];
  routine.steps.forEach((step) => {
    if (step.seconds) {
      built.push({ label: step.label, seconds: step.seconds, details: step.details });
      return;
    }

    if (step.rounds && step.sequence) {
      for (let round = 1; round <= step.rounds; round += 1) {
        step.sequence.forEach((segment) => {
          built.push({
            label: `Round ${round}/${step.rounds} · ${segment.label}`,
            seconds: segment.seconds,
            details: segment.details,
          });
        });
      }
      return;
    }

    if (step.options) {
      built.push({
        label: step.label,
        seconds: cooldownPicked,
        details: step.details,
      });
    }
  });

  return built;
}

export function HomeScreen({
  app,
  sessionsThisWeek,
  streakSummary,
  getPhaseProgress,
  onOpenRecovery,
  onOpenReview,
  onStartWorkout,
  notificationPermission,
  notificationSupported,
  onRequestReminderPermission,
}) {
  const { phase, week, deload } = getPhaseProgress();
  const todayRecovery = app.recovery.find((entry) => entry.date === today());
  const athleteName = (app.profile?.name || "").trim();
  const [selectedDurationByRoutine, setSelectedDurationByRoutine] = useState(() => ({}));
  const [activeTimer, setActiveTimer] = useState(null);
  const tickerRef = useRef(null);

  const activeStep = useMemo(() => {
    if (!activeTimer) {
      return null;
    }
    return activeTimer.sequence[activeTimer.stepIndex] || null;
  }, [activeTimer]);

  useEffect(() => {
    if (!activeTimer) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
      return undefined;
    }

    if (activeTimer.status !== "running") {
      return undefined;
    }

    tickerRef.current = setInterval(() => {
      setActiveTimer((current) => {
        if (!current || current.status !== "running") {
          return current;
        }

        if (current.remaining > 1) {
          return { ...current, remaining: current.remaining - 1, elapsed: current.elapsed + 1 };
        }

        const nextStepIndex = current.stepIndex + 1;
        if (nextStepIndex >= current.sequence.length) {
          return { ...current, remaining: 0, elapsed: current.elapsed + 1, status: "done" };
        }

        const nextStep = current.sequence[nextStepIndex];
        return {
          ...current,
          stepIndex: nextStepIndex,
          remaining: nextStep.seconds,
          elapsed: current.elapsed + 1,
        };
      });
    }, 1000);

    return () => {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    };
  }, [activeTimer]);

  useEffect(() => {
    if (!notificationSupported || notificationPermission !== "granted") {
      return;
    }
    if (!activeTimer) {
      return;
    }

    const currentStep = activeTimer.sequence[activeTimer.stepIndex];
    if (!currentStep) {
      return;
    }

    const body = activeTimer.status === "done"
      ? `${activeTimer.routineTitle} complete.`
      : `${currentStep.label} · ${formatClock(activeTimer.remaining)} left`;

    if (navigator.serviceWorker?.ready) {
      navigator.serviceWorker.ready
        .then((registration) => registration.showNotification("Bike timer", {
          body,
          tag: "bike-routine-timer",
          renotify: false,
          requireInteraction: activeTimer.status === "running",
          silent: true,
        }))
        .catch(() => {
          // Best effort fallback below.
        });
    }
  }, [activeTimer, notificationPermission, notificationSupported]);

  const startRoutineTimer = (routine) => {
    const sequence = buildTimerSequence(routine, selectedDurationByRoutine);
    const totalSeconds = sequence.reduce((sum, step) => sum + step.seconds, 0);

    setActiveTimer({
      routineId: routine.id,
      routineTitle: `${routine.code} — ${routine.title}`,
      sequence,
      stepIndex: 0,
      remaining: sequence[0].seconds,
      totalSeconds,
      elapsed: 0,
      status: "running",
    });
  };

  return (
    <Screen>
      <ScreenHeader bottomSpace={28} topPadding="calc(env(safe-area-inset-top, 0px) + 24px)">
        <p style={{ fontSize: 12, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Coach Orion Hale</p>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, lineHeight: 1.2, color: "#fff" }}>{athleteName ? `${athleteName}, ready to train?` : "Elite Athlete Program"}</h1>
        {app.phaseStart && (
          <SurfaceCard style={{ marginTop: 14, background: `${PHASES[phase].color}12`, border: `1px solid ${PHASES[phase].color}33`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: PHASES[phase].color, margin: 0 }}>Phase {phase + 1} — {PHASES[phase].name}</p>
              <p style={{ fontSize: 11, color: "#666", margin: "2px 0 0" }}>{PHASES[phase].theme}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: 0 }}>W{week}</p>
              {deload && <p style={{ fontSize: 9, color: "#F5A623", fontWeight: 700, margin: 0, textTransform: "uppercase" }}>Deload</p>}
            </div>
          </SurfaceCard>
        )}
      </ScreenHeader>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {[
          { value: app.sessions.length, label: "Sessions" },
          { value: sessionsThisWeek, label: "This Week" },
          { value: Object.keys(app.personalBests).length, label: "PBs" },
        ].map((stat) => (
          <SurfaceCard key={stat.label} style={{ flex: 1, textAlign: "center", marginBottom: 0 }}>
            <p style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#fff" }}>{stat.value}</p>
            <p style={{ fontSize: 10, color: "#555", margin: 0 }}>{stat.label}</p>
          </SurfaceCard>
        ))}
      </div>

      <SurfaceCard style={{ marginBottom: 14, borderColor: "rgba(45,125,210,0.24)", background: "rgba(45,125,210,0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: "#8BA6C9", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>Weekly Streak</p>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "#fff", fontWeight: 700 }}>
              {streakSummary.currentStreak} week{streakSummary.currentStreak === 1 ? "" : "s"} running
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9AA4B3" }}>
              {streakSummary.currentWeekCount}/{streakSummary.weeklyTarget} sessions this week ({streakSummary.currentWeekLabel})
            </p>
          </div>
          <Icon name="calendar" size={20} color="#2D7DD2" />
        </div>
      </SurfaceCard>

      <SurfaceButton onClick={onOpenRecovery} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, border: todayRecovery ? "1px solid rgba(69,182,73,0.2)" : C.border, background: todayRecovery ? "rgba(69,182,73,0.04)" : C.background }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: todayRecovery ? "#45B649" : "#fff", display: "flex", alignItems: "center", gap: 6 }}>{todayRecovery && <Icon name="check" size={14} color="#45B649" />}Today's Recovery</p>
          <p style={{ fontSize: 11, color: "#555", margin: "2px 0 0" }}>{todayRecovery ? `${todayRecovery.sleep}h sleep · ${todayRecovery.water}L water` : "Log sleep, hydration & mobility"}</p>
        </div>
        <span style={{ color: "#555", fontSize: 18 }}>›</span>
      </SurfaceButton>

      {new Date().getDay() === 0 && !app.weeklyReviews.find((review) => review.date === today()) && (
        <SurfaceButton onClick={onOpenReview} style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.2)", marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: "#F5A623", display: "flex", alignItems: "center", gap: 6 }}><Icon name="clipboard" size={14} color="#F5A623" />Weekly Review Due</p>
          <p style={{ fontSize: 11, color: "#888", margin: "2px 0 0" }}>Answer 5 questions. Stay accountable.</p>
        </SurfaceButton>
      )}

      <p style={L}>Bike Routines</p>
      {notificationSupported && notificationPermission !== "granted" && (
        <SurfaceCard style={{ marginBottom: 12, borderColor: "rgba(245,166,35,0.22)", background: "rgba(245,166,35,0.08)" }}>
          <p style={{ margin: 0, fontSize: 11, color: "#f7ce82" }}>
            Enable notifications to pin the active countdown in your phone's notification shade.
          </p>
          <ActionButton tone="tinted" color="#F5A623" compact style={{ marginTop: 8 }} onClick={onRequestReminderPermission}>Enable Countdown Notifications</ActionButton>
        </SurfaceCard>
      )}

      {activeTimer && (
        <SurfaceCard style={{ marginBottom: 14, borderColor: "rgba(69,182,73,0.3)", background: "rgba(69,182,73,0.08)" }}>
          <p style={{ margin: 0, fontSize: 10, color: "#9BE2A1", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>Active Bike Timer</p>
          <p style={{ margin: "4px 0 0", fontSize: 15, color: "#fff", fontWeight: 700 }}>{activeTimer.routineTitle}</p>
          <p style={{ margin: "6px 0 0", fontSize: 20, color: "#45B649", fontWeight: 800 }}>
            {activeStep ? `${activeStep.label} · ${formatClock(activeTimer.remaining)}` : "Complete"}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#99a1ab" }}>
            {formatDuration(activeTimer.elapsed)} elapsed · {formatDuration(Math.max(0, activeTimer.totalSeconds - activeTimer.elapsed))} left
          </p>
          {activeStep?.details && <p style={{ margin: "6px 0 0", fontSize: 11, color: "#A9B7C8" }}>{activeStep.details}</p>}
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            {activeTimer.status === "running" ? (
              <ActionButton compact tone="secondary" onClick={() => setActiveTimer((current) => current ? { ...current, status: "paused" } : current)}>Pause</ActionButton>
            ) : (
              <ActionButton compact tone="tinted" color="#45B649" onClick={() => setActiveTimer((current) => current ? { ...current, status: current.status === "done" ? "done" : "running" } : current)}>
                {activeTimer.status === "done" ? "Completed" : "Resume"}
              </ActionButton>
            )}
            <ActionButton compact tone="danger" onClick={() => setActiveTimer(null)}>Stop</ActionButton>
          </div>
        </SurfaceCard>
      )}

      {BIKE_ROUTINES.map((routine) => {
        const steadyConfig = routine.steady;
        const cooldownKey = `${routine.id}-cooldown`;
        const cooldownStep = routine.steps?.find((step) => Array.isArray(step.options));
        const selectedSteady = selectedDurationByRoutine[routine.id] || steadyConfig?.defaultSeconds;
        const selectedCooldown = selectedDurationByRoutine[cooldownKey] || cooldownStep?.defaultSeconds;

        return (
          <SurfaceCard key={routine.id} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#8BA6C9" }}>{routine.code} — {routine.title}</p>
              <Pill color="#45B649" background="rgba(69,182,73,0.1)" border="1px solid rgba(69,182,73,0.25)">{routine.totalTime}</Pill>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#8a9098" }}>{routine.useWhen}</p>

            {routine.steps?.map((step, index) => (
              <div key={`${routine.id}-step-${index}`} style={{ marginTop: 8, paddingTop: 8, borderTop: index === 0 ? "none" : "1px solid rgba(255,255,255,0.05)" }}>
                <p style={{ margin: 0, fontSize: 12, color: "#fff", fontWeight: 600 }}>{step.label}</p>
                {step.seconds && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9aa3b1" }}>{formatDuration(step.seconds)} · {step.details}</p>}
                {step.rounds && (
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9aa3b1" }}>
                    {step.sequence.map((segment) => `${formatDuration(segment.seconds)} ${segment.label}`).join(" / ")} × {step.rounds} rounds
                  </p>
                )}
                {step.options && (
                  <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {step.options.map((seconds) => (
                      <button
                        key={`${routine.id}-${seconds}`}
                        onClick={() => setSelectedDurationByRoutine((current) => ({ ...current, [cooldownKey]: seconds }))}
                        style={{
                          background: selectedCooldown === seconds ? "rgba(69,182,73,0.18)" : "rgba(255,255,255,0.04)",
                          border: selectedCooldown === seconds ? "1px solid rgba(69,182,73,0.6)" : "1px solid rgba(255,255,255,0.1)",
                          color: selectedCooldown === seconds ? "#8BEA94" : "#9aa3b1",
                          borderRadius: 999,
                          padding: "5px 10px",
                          fontSize: 11,
                          cursor: "pointer",
                        }}
                      >
                        {formatDuration(seconds)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {steadyConfig && (
              <>
                <p style={{ margin: "10px 0 0", fontSize: 11, color: "#9aa3b1" }}>{steadyConfig.details}</p>
                <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {steadyConfig.options.map((seconds) => (
                    <button
                      key={`${routine.id}-${seconds}`}
                      onClick={() => setSelectedDurationByRoutine((current) => ({ ...current, [routine.id]: seconds }))}
                      style={{
                        background: selectedSteady === seconds ? "rgba(69,182,73,0.18)" : "rgba(255,255,255,0.04)",
                        border: selectedSteady === seconds ? "1px solid rgba(69,182,73,0.6)" : "1px solid rgba(255,255,255,0.1)",
                        color: selectedSteady === seconds ? "#8BEA94" : "#9aa3b1",
                        borderRadius: 999,
                        padding: "5px 10px",
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      {formatDuration(seconds)}
                    </button>
                  ))}
                </div>
              </>
            )}

            {routine.notes && (
              <div style={{ marginTop: 8 }}>
                {routine.notes.map((note) => (
                  <p key={note} style={{ margin: "2px 0", fontSize: 11, color: "#9AA4B3" }}>{note}</p>
                ))}
              </div>
            )}

            <ActionButton
              compact
              style={{ marginTop: 10 }}
              onClick={() => startRoutineTimer(routine)}
              disabled={activeTimer?.status === "running"}
            >
              {activeTimer?.routineId === routine.id && activeTimer.status !== "done" ? "Timer Running" : "Start Guided Timer"}
            </ActionButton>
          </SurfaceCard>
        );
      })}

      <p style={L}>Start a Workout</p>
      {Object.values(WORKOUTS).map((workout) => {
        const lastSession = [...app.sessions].reverse().find((session) => session.workoutId === workout.id);
        return (
          <SurfaceButton key={workout.id} onClick={() => onStartWorkout(workout.id)} style={{ position: "relative", overflow: "hidden", paddingLeft: 22 }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: workout.color }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ fontSize: 10, color: workout.color, fontWeight: 700, margin: 0, letterSpacing: "0.08em", textTransform: "uppercase" }}>{workout.id} · {workout.day}</p>
                <p style={{ fontSize: 16, fontWeight: 600, margin: "3px 0 0", color: "#fff" }}>{workout.shortTitle}</p>
                <p style={{ fontSize: 11, color: "#555", margin: "2px 0 0" }}>{workout.goal}</p>
              </div>
              <span style={{ fontSize: 22, color: workout.color, fontWeight: 300 }}>→</span>
            </div>
            {lastSession && <p style={{ fontSize: 10, color: "#444", marginTop: 6, marginBottom: 0 }}>Last: {fd(lastSession.date)} · {fdu(lastSession.duration)}</p>}
          </SurfaceButton>
        );
      })}
    </Screen>
  );
}
