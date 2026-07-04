import { PHASES } from "../data.js";
import { fd, fdu, today } from "../storage.js";
import { Icon } from "../components/icons.jsx";
import { Avatar } from "../components/Avatar.jsx";
import { ActionButton, Screen, ScreenHeader, SurfaceButton, SurfaceCard } from "../components/ui.jsx";
import { colors, radii, typeScale } from "../theme.js";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function HomeScreen({
  app,
  sessionsThisWeek,
  streakSummary,
  getPhaseProgress,
  onOpenRecovery,
  onOpenReview,
  onNavigate,
}) {
  const { phase, week, deload } = getPhaseProgress();
  const todayRecovery = app.recovery.find((entry) => entry.date === today());
  const firstName = (app.profile?.firstName || app.profile?.name || "").trim().split(" ")[0];
  const recentSessions = [...(app.sessions || [])].slice(-3).reverse();

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

      <ActionButton onClick={() => onNavigate("train")} style={{ marginBottom: 16 }}>
        Start training
      </ActionButton>

      <SurfaceButton onClick={onOpenRecovery} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, border: todayRecovery ? "1px solid rgba(61,220,151,0.24)" : undefined, background: todayRecovery ? "rgba(61,220,151,0.06)" : undefined }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: todayRecovery ? colors.success : colors.textPrimary, display: "flex", alignItems: "center", gap: 6 }}>{todayRecovery && <Icon name="check" size={14} color={colors.success} />}Today's Recovery</p>
          <p style={{ ...typeScale.caption, color: colors.textMuted, margin: "2px 0 0" }}>{todayRecovery ? `${todayRecovery.sleep}h sleep · ${todayRecovery.water}L water` : "Log sleep, hydration & mobility"}</p>
        </div>
        <Icon name="chevronRight" size={16} color={colors.textMuted} />
      </SurfaceButton>

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
