import { useEffect, useMemo, useRef, useState } from "react";
import { ActionButton, BackButton, Pill, Screen, ScreenHeader, SurfaceCard } from "../components/ui.jsx";
import { CARDIO_LOG_TYPES, CARDIO_MACHINES, CARDIO_ROUTINES } from "../cardioData.js";
import { IS, devicePrefsLoad, fd, today } from "../storage.js";
import { colors, radii } from "../theme.js";

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

function pulseAlarm(audioContextRef) {
  if (typeof window === "undefined") {
    return;
  }

  // Respect the user's Sound & Haptics preferences so the settings truly govern
  // every timer sound (this is the "Timers" category).
  const prefs = devicePrefsLoad();
  const soundOn = prefs.soundEnabled !== false && prefs.soundCategories?.timers !== false;
  const volume = typeof prefs.soundVolume === "number" ? prefs.soundVolume : 0.6;
  const peak = Math.max(0.02, Math.min(0.3, volume * 0.33));

  if (soundOn) {
    try {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (AudioContextCtor) {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContextCtor();
        }

        const context = audioContextRef.current;
        if (context.state === "suspended") {
          context.resume();
        }

        const start = context.currentTime;
        [0, 0.2, 0.42].forEach((offset) => {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = "sine";
          oscillator.frequency.value = 880;
          gain.gain.setValueAtTime(0.0001, start + offset);
          gain.gain.exponentialRampToValueAtTime(peak, start + offset + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.16);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start(start + offset);
          oscillator.stop(start + offset + 0.18);
        });
      }
    } catch {
      // Best effort; browsers can block sound until a user interaction.
    }
  }

  if (prefs.hapticsEnabled !== false && navigator.vibrate) {
    navigator.vibrate([120, 80, 120, 80, 180]);
  }
}

function CardioLog({ app, onLogCardio }) {
  const [type, setType] = useState(CARDIO_LOG_TYPES[0]);
  const [duration, setDuration] = useState("");
  const [effort, setEffort] = useState(6);
  const [distance, setDistance] = useState("");
  const recent = [...(app?.cardioSessions || [])].slice(0, 6);

  const save = () => {
    const durationMin = Number(duration);
    if (!durationMin) return;
    onLogCardio?.({ type, durationMin, effort: Number(effort), distance: distance ? Number(distance) : null });
    setDuration("");
    setDistance("");
  };

  return (
    <>
      <SurfaceCard style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 11, color: colors.textMuted, textTransform: "uppercase", fontWeight: 700, margin: "0 0 10px" }}>Log a cardio session</p>
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 10, color: colors.textMuted, margin: "0 0 4px", textTransform: "uppercase", fontWeight: 700 }}>Type</p>
            <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...IS, padding: 11 }}>
              {CARDIO_LOG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ width: 100 }}>
            <p style={{ fontSize: 10, color: colors.textMuted, margin: "0 0 4px", textTransform: "uppercase", fontWeight: 700 }}>Minutes</p>
            <input type="number" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="30" style={{ ...IS, padding: 11 }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 10, color: colors.textMuted, margin: "0 0 4px", textTransform: "uppercase", fontWeight: 700 }}>Effort · {effort}/10</p>
            <input type="range" min="1" max="10" value={effort} onChange={(e) => setEffort(e.target.value)} style={{ width: "100%", accentColor: colors.accent }} />
          </div>
          <div style={{ width: 100 }}>
            <p style={{ fontSize: 10, color: colors.textMuted, margin: "0 0 4px", textTransform: "uppercase", fontWeight: 700 }}>Distance (km)</p>
            <input type="number" inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="—" style={{ ...IS, padding: 11 }} />
          </div>
        </div>
        <ActionButton onClick={save} disabled={!Number(duration)}>Save session</ActionButton>
      </SurfaceCard>

      {recent.length > 0 && (
        <>
          <p style={{ fontSize: 11, color: colors.textMuted, textTransform: "uppercase", fontWeight: 700, margin: "0 0 10px" }}>Recent cardio</p>
          {recent.map((entry) => (
            <SurfaceCard key={entry.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>{entry.type} · {entry.durationMin} min</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: colors.textMuted }}>{fd(entry.date)}{entry.distance ? ` · ${entry.distance} km` : ""}{entry.effort ? ` · effort ${entry.effort}/10` : ""}</p>
              </div>
            </SurfaceCard>
          ))}
        </>
      )}
    </>
  );
}

export function CardioScreen({ app, onBack, onLogCardio, notificationPermission, notificationSupported, onRequestReminderPermission }) {
  const [machine, setMachine] = useState("bike");
  const [selectedDurationByRoutine, setSelectedDurationByRoutine] = useState(() => ({}));
  const [activeTimer, setActiveTimer] = useState(null);
  const tickerRef = useRef(null);
  const alarmLoopRef = useRef(null);
  const wakeLockRef = useRef(null);
  const audioContextRef = useRef(null);
  const sentMilestonesRef = useRef(new Set());
  const previousTickRef = useRef(null);

  const activeStep = useMemo(() => {
    if (!activeTimer) {
      return null;
    }
    return activeTimer.sequence[activeTimer.stepIndex] || null;
  }, [activeTimer]);

  useEffect(() => {
    if (!activeTimer || activeTimer.status !== "running") {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
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
          status: "running",
        };
      });
    }, 1000);

    return () => {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    };
  }, [activeTimer]);

  useEffect(() => {
    if (!activeTimer) {
      return;
    }

    const currentStep = activeTimer.sequence[activeTimer.stepIndex];
    if (activeTimer.status === "done") {
      pulseAlarm(audioContextRef);
      clearInterval(alarmLoopRef.current);
      alarmLoopRef.current = setInterval(() => pulseAlarm(audioContextRef), 2200);
    } else if (currentStep && activeTimer.remaining === currentStep.seconds && activeTimer.elapsed > 0) {
      pulseAlarm(audioContextRef);
    }

    return () => {
      if (activeTimer.status !== "done") {
        clearInterval(alarmLoopRef.current);
        alarmLoopRef.current = null;
      }
    };
  }, [activeTimer]);

  useEffect(() => {
    if (!activeTimer || !notificationSupported || notificationPermission !== "granted") {
      previousTickRef.current = null;
      return;
    }

    const currentStep = activeTimer.sequence[activeTimer.stepIndex];
    const previousTick = previousTickRef.current;
    previousTickRef.current = {
      status: activeTimer.status,
      stepIndex: activeTimer.stepIndex,
      remaining: activeTimer.remaining,
    };

    if (
      previousTick
      && previousTick.status === activeTimer.status
      && previousTick.stepIndex === activeTimer.stepIndex
      && previousTick.remaining === activeTimer.remaining
    ) {
      return;
    }

    let body = null;
    let milestoneKey = null;

    if (activeTimer.status === "done" && previousTick?.status !== "done") {
      body = `${activeTimer.routineTitle} complete. Tap to return.`;
      milestoneKey = "done";
    } else if (currentStep) {
      const halfwayRemaining = Math.ceil(currentStep.seconds / 2);
      const tenSecondRemaining = 10;
      const previousRemaining = previousTick?.stepIndex === activeTimer.stepIndex ? previousTick.remaining : currentStep.seconds + 1;
      const shouldNotifyHalfway = (
        currentStep.seconds > 1
        && previousRemaining > halfwayRemaining
        && activeTimer.remaining <= halfwayRemaining
      );
      const shouldNotifyTenSeconds = (
        currentStep.seconds > 10
        && previousRemaining > tenSecondRemaining
        && activeTimer.remaining <= tenSecondRemaining
      );

      if (shouldNotifyHalfway && shouldNotifyTenSeconds) {
        body = `${currentStep.label} · Halfway and 10 seconds left.`;
        milestoneKey = `${activeTimer.stepIndex}-halfway-10`;
      } else if (shouldNotifyHalfway) {
        body = `${currentStep.label} · Halfway point reached.`;
        milestoneKey = `${activeTimer.stepIndex}-halfway`;
      } else if (shouldNotifyTenSeconds) {
        body = `${currentStep.label} · 10 seconds left.`;
        milestoneKey = `${activeTimer.stepIndex}-ten-seconds`;
      }
    }

    if (!body || !milestoneKey || sentMilestonesRef.current.has(milestoneKey)) {
      return;
    }

    sentMilestonesRef.current.add(milestoneKey);

    navigator.serviceWorker?.ready
      ?.then((registration) => registration.showNotification("Bike routine alarm", {
        body,
        tag: "bike-routine-alarm",
        renotify: false,
        requireInteraction: activeTimer.status !== "done",
        silent: false,
        vibrate: activeTimer.status === "done" ? [200, 120, 200, 120, 260] : [120],
      }))
      .catch(() => {});
  }, [activeTimer, notificationPermission, notificationSupported]);

  useEffect(() => {
    if (!activeTimer) {
      sentMilestonesRef.current.clear();
      previousTickRef.current = null;
    }
  }, [activeTimer]);

  useEffect(() => {
    const requestWakeLock = async () => {
      if (!activeTimer || activeTimer.status !== "running") {
        if (wakeLockRef.current) {
          await wakeLockRef.current.release().catch(() => {});
          wakeLockRef.current = null;
        }
        return;
      }

      if (!("wakeLock" in navigator) || wakeLockRef.current) {
        return;
      }

      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      } catch {
        // Ignore wake lock rejections.
      }
    };

    requestWakeLock();

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [activeTimer]);

  useEffect(() => () => {
    clearInterval(alarmLoopRef.current);
    clearInterval(tickerRef.current);
    wakeLockRef.current?.release().catch(() => {});
  }, []);

  const startRoutineTimer = (routine) => {
    const sequence = buildTimerSequence(routine, selectedDurationByRoutine);
    const totalSeconds = sequence.reduce((sum, step) => sum + step.seconds, 0);

    pulseAlarm(audioContextRef);
    sentMilestonesRef.current.clear();
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

  const stopTimer = () => {
    clearInterval(alarmLoopRef.current);
    alarmLoopRef.current = null;
    navigator.vibrate?.(0);
    sentMilestonesRef.current.clear();
    setActiveTimer(null);
  };

  return (
    <Screen>
      <ScreenHeader action={onBack ? <BackButton onClick={onBack} /> : undefined} title="Cardio" subtitle="Guided routines with a full-screen countdown, plus a quick session log." />

      <div style={{ display: "flex", gap: 6, padding: 4, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: `1px solid ${colors.border}`, marginBottom: 16 }}>
        {CARDIO_MACHINES.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setMachine(option.key)}
            style={{ flex: 1, minWidth: 0, padding: "9px 4px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: machine === option.key ? "rgba(78,161,255,0.18)" : "transparent", color: machine === option.key ? colors.accent : colors.textMuted }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {machine === "log" && <CardioLog app={app} onLogCardio={onLogCardio} />}

      {machine !== "log" && notificationSupported && notificationPermission !== "granted" && (
        <SurfaceCard style={{ marginBottom: 12, borderColor: "rgba(246,183,60,0.22)", background: "rgba(246,183,60,0.08)" }}>
          <p style={{ margin: 0, fontSize: 11, color: colors.warning }}>
            Turn on notifications so the timer can alert you like a phone alarm.
          </p>
          <ActionButton tone="tinted" color={colors.warning} compact style={{ marginTop: 8 }} onClick={onRequestReminderPermission}>Enable cardio alarms</ActionButton>
        </SurfaceCard>
      )}

      {machine !== "log" && CARDIO_ROUTINES.filter((routine) => routine.machine === machine).map((routine) => {
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

      {activeTimer && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 220,
          background: "radial-gradient(circle at top, rgba(69,182,73,0.16), #08090f 62%)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          padding: "calc(env(safe-area-inset-top, 0px) + 18px) 24px calc(env(safe-area-inset-bottom, 0px) + 18px)",
        }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: "#8BEA94", textTransform: "uppercase" }}>
            {activeTimer.status === "done" ? "Routine Complete" : activeTimer.routineTitle}
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 20, color: "#fff", fontWeight: 700 }}>{activeStep?.label || "Done"}</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9AA4B3" }}>{activeStep?.details || "Great job. Cool down and hydrate."}</p>
          <p style={{ margin: "18px 0 8px", fontSize: 104, lineHeight: 1, letterSpacing: "0.02em", fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums", fontFamily: "'SF Mono','Menlo',monospace" }}>
            {formatClock(Math.max(0, activeTimer.remaining))}
          </p>
          <p style={{ margin: "0 0 20px", fontSize: 12, color: "#9AA4B3" }}>
            {formatDuration(activeTimer.elapsed)} elapsed · {formatDuration(Math.max(0, activeTimer.totalSeconds - activeTimer.elapsed))} left
          </p>

          <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 360 }}>
            {activeTimer.status === "running" ? (
              <ActionButton tone="secondary" onClick={() => setActiveTimer((current) => (current ? { ...current, status: "paused" } : current))}>Pause</ActionButton>
            ) : (
              <ActionButton tone="tinted" color="#45B649" onClick={() => setActiveTimer((current) => (current && current.status !== "done" ? { ...current, status: "running" } : current))}>
                {activeTimer.status === "done" ? "Done" : "Resume"}
              </ActionButton>
            )}
            <ActionButton tone="danger" onClick={stopTimer}>Stop</ActionButton>
          </div>
        </div>
      )}
    </Screen>
  );
}
