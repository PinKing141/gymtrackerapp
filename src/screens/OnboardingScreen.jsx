import { useMemo, useState } from "react";
import { IS } from "../storage.js";
import { ActionButton } from "../components/ui.jsx";
import { colors, radii, typeScale } from "../theme.js";
import {
  ACTIVITY_OPTIONS,
  GOAL_OPTIONS,
  feetInchesToCm,
  kgToPounds,
  poundsToKg,
  toFeetInches,
} from "../units.js";

const MODULES = [
  { key: "gym", label: "Gym / Lifting", desc: "Strength workouts, presets, PBs", locked: true },
  { key: "nutrition", label: "Nutrition", desc: "Food logging, calories and macros" },
  { key: "cardio", label: "Cardio", desc: "Bike, treadmill, running & more" },
  { key: "basketball", label: "Basketball", desc: "Shot tracking & session stats" },
];

const SEX_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

function Label({ children }) {
  return (
    <p style={{ ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase", margin: "0 0 6px" }}>{children}</p>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, padding: 4, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: `1px solid ${colors.border}` }}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          style={{
            flex: 1,
            minWidth: 0,
            padding: "9px 4px",
            borderRadius: 9,
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 12,
            fontWeight: 700,
            background: value === option.value ? "rgba(78,161,255,0.18)" : "transparent",
            color: value === option.value ? colors.accent : colors.textMuted,
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function OnboardingScreen({ profile, onComplete }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(() => ({
    firstName: profile?.firstName || "",
    lastName: profile?.lastName || "",
    sex: profile?.sex || "male",
    age: profile?.age || "",
    unitSystem: profile?.unitSystem || "imperial",
    heightCm: profile?.heightCm || "",
    weightKg: profile?.weightKg || "",
    goal: profile?.goal || "maintain",
    targetWeightKg: profile?.targetWeightKg || "",
    activityLevel: profile?.activityLevel || "moderate",
    enabledModules: {
      gym: true,
      nutrition: profile?.enabledModules?.nutrition ?? true,
      cardio: profile?.enabledModules?.cardio ?? true,
      basketball: profile?.enabledModules?.basketball ?? false,
    },
  }));

  const set = (patch) => setDraft((current) => ({ ...current, ...patch }));
  const imperial = draft.unitSystem === "imperial";
  const { feet, inches } = useMemo(() => toFeetInches(draft.heightCm), [draft.heightCm]);
  const lbs = useMemo(() => (draft.weightKg ? kgToPounds(draft.weightKg) : ""), [draft.weightKg]);
  const targetLbs = useMemo(() => (draft.targetWeightKg ? kgToPounds(draft.targetWeightKg) : ""), [draft.targetWeightKg]);

  const steps = [
    {
      title: "What should we call you?",
      subtitle: "This personalizes your dashboard.",
      valid: draft.firstName.trim().length > 0,
      body: (
        <>
          <Label>First name</Label>
          <input value={draft.firstName} onChange={(e) => set({ firstName: e.target.value })} placeholder="First name" autoComplete="given-name" style={{ ...IS, marginBottom: 12, padding: 12 }} />
          <Label>Last name (optional)</Label>
          <input value={draft.lastName} onChange={(e) => set({ lastName: e.target.value })} placeholder="Last name" autoComplete="family-name" style={{ ...IS, padding: 12 }} />
        </>
      ),
    },
    {
      title: "A bit about you",
      subtitle: "Used to tailor targets and calories.",
      valid: Number(draft.age) > 0 && Number(draft.heightCm) > 0 && Number(draft.weightKg) > 0,
      body: (
        <>
          <Label>Units</Label>
          <div style={{ marginBottom: 14 }}>
            <Segmented
              options={[{ value: "imperial", label: "Imperial (ft/lb)" }, { value: "metric", label: "Metric (cm/kg)" }]}
              value={draft.unitSystem}
              onChange={(v) => set({ unitSystem: v })}
            />
          </div>
          <Label>Sex</Label>
          <div style={{ marginBottom: 14 }}>
            <Segmented options={SEX_OPTIONS} value={draft.sex} onChange={(v) => set({ sex: v })} />
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Label>Age</Label>
              <input type="number" inputMode="numeric" value={draft.age} onChange={(e) => set({ age: e.target.value })} placeholder="Age" style={{ ...IS, padding: 12 }} />
            </div>
          </div>
          <Label>Height</Label>
          {imperial ? (
            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <input type="number" inputMode="numeric" value={feet || ""} onChange={(e) => set({ heightCm: feetInchesToCm(e.target.value, inches) })} placeholder="ft" style={{ ...IS, padding: 12 }} />
              <input type="number" inputMode="numeric" value={inches || ""} onChange={(e) => set({ heightCm: feetInchesToCm(feet, e.target.value) })} placeholder="in" style={{ ...IS, padding: 12 }} />
            </div>
          ) : (
            <input type="number" inputMode="decimal" value={draft.heightCm || ""} onChange={(e) => set({ heightCm: e.target.value })} placeholder="cm" style={{ ...IS, padding: 12, marginBottom: 14 }} />
          )}
          <Label>Weight</Label>
          {imperial ? (
            <input type="number" inputMode="decimal" value={lbs || ""} onChange={(e) => set({ weightKg: poundsToKg(e.target.value) })} placeholder="lb" style={{ ...IS, padding: 12 }} />
          ) : (
            <input type="number" inputMode="decimal" value={draft.weightKg || ""} onChange={(e) => set({ weightKg: e.target.value })} placeholder="kg" style={{ ...IS, padding: 12 }} />
          )}
        </>
      ),
    },
    {
      title: "What's your goal?",
      subtitle: "We'll shape your targets around it.",
      valid: true,
      body: (
        <>
          <Label>Goal</Label>
          <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
            {GOAL_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => set({ goal: option.value })}
                style={{
                  textAlign: "left",
                  padding: "13px 14px",
                  borderRadius: radii.md,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 14,
                  fontWeight: 700,
                  color: draft.goal === option.value ? colors.accent : colors.textPrimary,
                  background: draft.goal === option.value ? "rgba(78,161,255,0.12)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${draft.goal === option.value ? "rgba(78,161,255,0.5)" : colors.border}`,
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          {draft.goal !== "maintain" && (
            <>
              <Label>Target weight ({imperial ? "lb" : "kg"}) — optional</Label>
              {imperial ? (
                <input type="number" inputMode="decimal" value={targetLbs || ""} onChange={(e) => set({ targetWeightKg: poundsToKg(e.target.value) })} placeholder="Target lb" style={{ ...IS, padding: 12, marginBottom: 14 }} />
              ) : (
                <input type="number" inputMode="decimal" value={draft.targetWeightKg || ""} onChange={(e) => set({ targetWeightKg: e.target.value })} placeholder="Target kg" style={{ ...IS, padding: 12, marginBottom: 14 }} />
              )}
            </>
          )}
          <Label>Activity level</Label>
          <select value={draft.activityLevel} onChange={(e) => set({ activityLevel: e.target.value })} style={{ ...IS, padding: 12 }}>
            {ACTIVITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </>
      ),
    },
    {
      title: "What do you want to track?",
      subtitle: "You can change these anytime in settings.",
      valid: true,
      skippable: true,
      body: (
        <div style={{ display: "grid", gap: 10 }}>
          {MODULES.map((module) => {
            const on = module.locked ? true : draft.enabledModules[module.key];
            return (
              <button
                key={module.key}
                type="button"
                disabled={module.locked}
                onClick={() => set({ enabledModules: { ...draft.enabledModules, [module.key]: !draft.enabledModules[module.key] } })}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  textAlign: "left",
                  padding: "14px 16px",
                  borderRadius: radii.md,
                  cursor: module.locked ? "default" : "pointer",
                  fontFamily: "inherit",
                  background: on ? "rgba(78,161,255,0.10)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${on ? "rgba(78,161,255,0.45)" : colors.border}`,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: colors.textPrimary }}>{module.label}{module.locked ? " · Core" : ""}</p>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: colors.textSecondary }}>{module.desc}</p>
                </div>
                <div style={{
                  width: 44, height: 26, borderRadius: 999, flexShrink: 0,
                  background: on ? colors.accent : "rgba(255,255,255,0.14)",
                  position: "relative", transition: "background 160ms ease", opacity: module.locked ? 0.6 : 1,
                }}>
                  <div style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: "#fff", transition: "left 160ms ease" }} />
                </div>
              </button>
            );
          })}
        </div>
      ),
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  const finish = () => {
    onComplete({
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      name: [draft.firstName.trim(), draft.lastName.trim()].filter(Boolean).join(" ") || draft.firstName.trim(),
      sex: draft.sex,
      age: draft.age,
      unitSystem: draft.unitSystem,
      heightCm: draft.heightCm,
      weightKg: draft.weightKg,
      goal: draft.goal,
      targetWeightKg: draft.targetWeightKg,
      activityLevel: draft.activityLevel,
      enabledModules: { ...draft.enabledModules, gym: true },
      onboardingComplete: true,
    });
  };

  const next = () => {
    if (!current.valid) return;
    if (isLast) finish();
    else setStep((s) => s + 1);
  };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", padding: "calc(env(safe-area-inset-top, 0px) + 24px) 22px calc(env(safe-area-inset-bottom, 0px) + 22px)", boxSizing: "border-box" }}>
      {/* Progress dots */}
      <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
        {steps.map((_, index) => (
          <div key={index} style={{ flex: 1, height: 4, borderRadius: 999, background: index <= step ? colors.accent : "rgba(255,255,255,0.12)", transition: "background 200ms ease" }} />
        ))}
      </div>

      <div style={{ flex: 1 }}>
        <h1 style={{ fontSize: 25, fontWeight: 800, margin: "0 0 6px", color: colors.textPrimary }}>{current.title}</h1>
        <p style={{ fontSize: 13, color: colors.textSecondary, margin: "0 0 22px" }}>{current.subtitle}</p>
        {current.body}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        {step > 0 && (
          <ActionButton tone="secondary" fullWidth={false} onClick={() => setStep((s) => s - 1)} style={{ minWidth: 96 }}>
            Back
          </ActionButton>
        )}
        <div style={{ flex: 1, display: "grid", gap: 8 }}>
          <ActionButton onClick={next} disabled={!current.valid}>
            {isLast ? "Finish" : "Continue"}
          </ActionButton>
          {current.skippable && (
            <button type="button" onClick={finish} style={{ background: "none", border: "none", color: colors.textMuted, fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 4 }}>
              Set up later
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
