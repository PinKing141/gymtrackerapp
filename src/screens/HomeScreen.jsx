import { PHASES } from "../data.js";
import { fd, fdu, today } from "../storage.js";
import { getChecklistProgress, getDailyChecklist, getMissedPrompt, getReadiness, getTodayPlan } from "../today.js";
import { moveOccurrence, setOccurrenceStatus } from "../trainingPlan.js";
import { Icon } from "../components/icons.jsx";
import { Avatar } from "../components/Avatar.jsx";
import { ActionButton, Screen, ScreenHeader, SurfaceButton, SurfaceCard } from "../components/ui.jsx";
import { colors, typeScale } from "../theme.js";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const READINESS_TONES = {
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  muted: colors.textMuted,
};

function ReadinessCard({ readiness }) {
  const tone = READINESS_TONES[readiness.tone] || colors.textMuted;
  return (
    <SurfaceCard style={{ marginBottom: 14, border: `1px solid ${tone}33`, background: `${tone}0D` }}>
      <p style={{ ...typeScale.overline, color: tone, textTransform: "uppercase", margin: 0 }}>Readiness</p>
      <p style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 800, color: colors.textPrimary }}>{readiness.label}</p>
      <p style={{ margin: "6px 0 0", ...typeScale.caption, color: colors.textSecondary, lineHeight: 1.5 }}>{readiness.suggestion}</p>
      {readiness.reasons.length > 0 && (
        <div style={{ marginTop: 8, display: "grid", gap: 3 }}>
          {readiness.reasons.map((reason) => (
            <p key={reason} style={{ margin: 0, ...typeScale.caption, color: colors.textMuted }}>· {reason}</p>
          ))}
        </div>
      )}
    </SurfaceCard>
  );
}

// "You missed Lower Power on Tuesday. Move it to today or mark it skipped?"
// Missing a day never breaks the programme — the athlete decides.
function MissedWorkoutCard({ prompt, onMoveToToday, onSkip }) {
  return (
    <SurfaceCard style={{ marginBottom: 14, border: "1px solid rgba(246,183,60,0.3)", background: "rgba(246,183,60,0.06)" }}>
      <p style={{ ...typeScale.overline, color: colors.warning, textTransform: "uppercase", margin: 0 }}>Missed session</p>
      <p style={{ margin: "6px 0 0", fontSize: 13, color: colors.textPrimary, fontWeight: 700, lineHeight: 1.5 }}>{prompt.question}</p>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <ActionButton compact tone="tinted" color="#2D7DD2" onClick={onMoveToToday}>Move to today</ActionButton>
        <ActionButton compact tone="secondary" onClick={onSkip}>Mark skipped</ActionButton>
      </div>
      {prompt.remaining > 0 && (
        <p style={{ margin: "8px 0 0", ...typeScale.caption, color: colors.textMuted }}>{prompt.remaining} more missed session{prompt.remaining === 1 ? "" : "s"} in the calendar.</p>
      )}
    </SurfaceCard>
  );
}

function TodayPlan({ items, onOpenItem, onOpenCalendar }) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 0 10px" }}>
        <p style={{ ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase", margin: 0 }}>Today's plan</p>
        {onOpenCalendar && (
          <button
            type="button"
            onClick={onOpenCalendar}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, color: colors.accent, display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <Icon name="calendar" size={13} color={colors.accent} />
            Calendar ›
          </button>
        )}
      </div>
      {items.map((item) => (
        <SurfaceButton
          key={item.key}
          onClick={() => onOpenItem(item)}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
            ...(item.done ? { border: "1px solid rgba(61,220,151,0.24)", background: "rgba(61,220,151,0.06)" } : {}),
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: item.done ? colors.success : colors.textPrimary, display: "flex", alignItems: "center", gap: 6 }}>
              {item.done && <Icon name="check" size={14} color={colors.success} />}
              {item.title}
            </p>
            <p style={{ ...typeScale.caption, color: colors.textMuted, margin: "2px 0 0" }}>{item.detail}</p>
          </div>
          <Icon name="chevronRight" size={16} color={colors.textMuted} />
        </SurfaceButton>
      ))}
    </>
  );
}

function DailyChecklist({ items }) {
  const progress = getChecklistProgress(items);
  return (
    <SurfaceCard style={{ margin: "6px 0 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <p style={{ ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase", margin: 0 }}>Daily completion</p>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: progress.percent === 100 ? colors.success : colors.textSecondary }}>
          {progress.done}/{progress.total}
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {items.map((item) => (
          <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 9px", borderRadius: 10, background: item.done ? "rgba(61,220,151,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${item.done ? "rgba(61,220,151,0.25)" : colors.border}` }}>
            <div style={{ width: 16, height: 16, borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: item.done ? colors.success : "rgba(255,255,255,0.08)" }}>
              {item.done && <Icon name="check" size={11} color="#0A0A0F" strokeWidth={3} />}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: item.done ? colors.success : colors.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</p>
              {item.detail && <p style={{ margin: 0, fontSize: 9, color: colors.textMuted }}>{item.detail}</p>}
            </div>
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}

export function HomeScreen({
  app,
  sessionsThisWeek,
  streakSummary,
  getPhaseProgress,
  onOpenRecovery,
  onOpenBodyStats,
  onOpenReview,
  onOpenCalendar,
  onUpdatePlan,
  onNavigate,
}) {
  const { phase, week, deload } = getPhaseProgress();
  const firstName = (app.profile?.firstName || app.profile?.name || "").trim().split(" ")[0];
  const recentSessions = [...(app.sessions || [])].slice(-3).reverse();

  const readiness = getReadiness(app);
  const planItems = getTodayPlan(app);
  const checklist = getDailyChecklist(app);
  const missedPrompt = onUpdatePlan ? getMissedPrompt(app) : null;

  const openPlanItem = (item) => {
    if (item.view === "recovery") return onOpenRecovery();
    if (item.view === "bodystats") return onOpenBodyStats ? onOpenBodyStats() : onNavigate("more");
    return onNavigate(item.view);
  };

  return (
    <Screen>
      <ScreenHeader bottomSpace={22} topPadding="calc(env(safe-area-inset-top, 0px) + 24px)">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ ...typeScale.caption, color: colors.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>
              {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: "4px 0 0", lineHeight: 1.2, color: colors.textPrimary }}>
              {greeting()}{firstName ? `, ${firstName}` : ""}
            </h1>
          </div>
          <Avatar profile={app.profile} size={46} radius={15} fontSize={17} onClick={() => onNavigate("more")} />
        </div>
      </ScreenHeader>

      <ReadinessCard readiness={readiness} />

      {missedPrompt && (
        <MissedWorkoutCard
          prompt={missedPrompt}
          onMoveToToday={() => onUpdatePlan((plan, currentApp) => moveOccurrence(plan, currentApp, missedPrompt.ref, today()))}
          onSkip={() => onUpdatePlan((plan) => setOccurrenceStatus(plan, missedPrompt.ref, "skipped"))}
        />
      )}

      <TodayPlan items={planItems} onOpenItem={openPlanItem} onOpenCalendar={onOpenCalendar} />

      <DailyChecklist items={checklist} />

      {app.phaseStart && (
        <SurfaceCard style={{ marginBottom: 14, background: `${PHASES[phase].color}12`, border: `1px solid ${PHASES[phase].color}33`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: PHASES[phase].color, margin: 0 }}>Phase {phase + 1} — {PHASES[phase].name}</p>
            <p style={{ ...typeScale.caption, color: colors.textMuted, margin: "2px 0 0" }}>{PHASES[phase].theme}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 20, fontWeight: 800, color: colors.textPrimary, margin: 0 }}>W{week}</p>
            {deload && <p style={{ fontSize: 9, color: colors.warning, fontWeight: 700, margin: 0, textTransform: "uppercase" }}>Deload</p>}
          </div>
        </SurfaceCard>
      )}

      <SurfaceCard style={{ marginBottom: 14, borderColor: "rgba(78,161,255,0.24)", background: "rgba(78,161,255,0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ ...typeScale.overline, color: colors.accent, textTransform: "uppercase", margin: 0 }}>Weekly Streak</p>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: colors.textPrimary, fontWeight: 700 }}>
              {streakSummary.currentStreak} week{streakSummary.currentStreak === 1 ? "" : "s"} running
            </p>
            <p style={{ margin: "2px 0 0", ...typeScale.caption, color: colors.textSecondary }}>
              {streakSummary.currentWeekCount}/{streakSummary.weeklyTarget} sessions this week ({streakSummary.currentWeekLabel})
            </p>
          </div>
          <Icon name="calendar" size={20} color={colors.accent} />
        </div>
      </SurfaceCard>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[
          { value: app.sessions.length, label: "Sessions" },
          { value: sessionsThisWeek, label: "This Week" },
          { value: Object.keys(app.personalBests).length, label: "PBs" },
        ].map((stat) => (
          <SurfaceCard key={stat.label} style={{ flex: 1, minWidth: 0, textAlign: "center", marginBottom: 0 }}>
            <p style={{ fontSize: 22, fontWeight: 800, margin: 0, color: colors.textPrimary }}>{stat.value}</p>
            <p style={{ ...typeScale.caption, color: colors.textMuted, margin: 0 }}>{stat.label}</p>
          </SurfaceCard>
        ))}
      </div>

      {new Date().getDay() === 0 && !app.weeklyReviews.find((review) => review.date === today()) && (
        <SurfaceButton onClick={onOpenReview} style={{ background: "rgba(246,183,60,0.06)", border: "1px solid rgba(246,183,60,0.2)", marginBottom: 10 }}>
          <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: colors.warning, display: "flex", alignItems: "center", gap: 6 }}><Icon name="clipboard" size={14} color={colors.warning} />Weekly Review Due</p>
          <p style={{ ...typeScale.caption, color: colors.textSecondary, margin: "2px 0 0" }}>Answer 5 questions. Stay accountable.</p>
        </SurfaceButton>
      )}

      {recentSessions.length > 0 && (
        <>
          <p style={{ ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase", margin: "18px 0 10px" }}>Recent activity</p>
          {recentSessions.map((session) => (
            <SurfaceCard key={session.id || session.date} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: colors.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {session.workoutSnapshot?.shortTitle || session.workoutSnapshot?.title || "Workout"}
                </p>
                <p style={{ ...typeScale.caption, color: colors.textMuted, margin: "2px 0 0" }}>{fd(session.date)}{session.duration ? ` · ${fdu(session.duration)}` : ""}</p>
              </div>
              <Icon name="check" size={16} color={colors.success} />
            </SurfaceCard>
          ))}
        </>
      )}
    </Screen>
  );
}
