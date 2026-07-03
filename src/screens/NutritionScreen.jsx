import { Screen, ScreenHeader, SurfaceCard } from "../components/ui.jsx";
import { Icon } from "../components/icons.jsx";
import { calculateCalories } from "../units.js";
import { colors, radii, typeScale } from "../theme.js";

// Structural shell for future food logging. Shows the calorie/BMR target derived
// from the user's profile; the food diary + search drops in here later.
export function NutritionScreen({ app }) {
  const profile = app?.profile || {};
  const calories = calculateCalories(profile);

  return (
    <Screen>
      <ScreenHeader title="Nutrition" titleAs="h1" subtitle="Your daily target now — food logging is coming soon." topPadding="calc(env(safe-area-inset-top, 0px) + 24px)" />

      <SurfaceCard style={{ textAlign: "center", padding: "22px 16px" }}>
        <p style={{ ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase", margin: 0 }}>Daily calorie target</p>
        {calories ? (
          <>
            <p style={{ fontSize: 40, fontWeight: 800, color: colors.accent, margin: "6px 0 0", lineHeight: 1 }}>{calories.target}</p>
            <p style={{ ...typeScale.caption, color: colors.textSecondary, margin: "6px 0 0" }}>kcal · BMR {calories.bmr} · goal {profile.goal || "maintain"}</p>
          </>
        ) : (
          <p style={{ ...typeScale.bodySm, color: colors.textSecondary, margin: "8px 0 0" }}>Add your age, height and weight in You → profile to see a target.</p>
        )}
      </SurfaceCard>

      <SurfaceCard style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 42, height: 42, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(78,161,255,0.12)", border: `1px solid ${colors.accent}33`, flexShrink: 0 }}>
          <Icon name="clipboard" size={20} color={colors.accent} />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>Food logging is on the way</p>
          <p style={{ margin: "2px 0 0", ...typeScale.caption, color: colors.textMuted }}>Search foods, log meals and track macros against your target.</p>
        </div>
      </SurfaceCard>
    </Screen>
  );
}
