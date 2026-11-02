import { TextAreaField } from "../../components/ui.jsx";
import { SettingsField as Field, SettingsGroup as Group, ToggleRow } from "../../components/ProfileSettings.jsx";
import { getProteinRange } from "../../profileSummary.js";
import { IS } from "../../storage.js";
import { ACTIVITY_OPTIONS, GOAL_OPTIONS, feetInchesToCm, kgToPounds, poundsToKg, toFeetInches } from "../../units.js";
import { AvatarEditButton } from "./ProfileAvatar.jsx";
import { MAIN_MODULES, SUPPORT_MODULES } from "./modules.js";
import { mutedStyle, textStyle } from "./styles.js";

const BULK_RATES = ["Slow lean bulk", "Moderate gain", "Aggressive gain"];
const CUT_RATES = ["0.25 kg/week", "0.5 kg/week", "0.75 kg/week", "1.0 kg/week"];
const linkButtonStyle = { marginTop: 6, background: "none", border: "none", padding: 0, fontSize: 12, fontWeight: 700, cursor: "pointer" };

export function EditProfileSection({ profile, displayName, initials, email, onPickAvatar, avatarInput, setProfile }) {
  return (
    <Group title="Identity">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <AvatarEditButton profile={profile} initials={initials} size={56} radius={18} fontSize={20} ringColor="#15151F" onClick={onPickAvatar} />
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, color: "#fff", fontWeight: 800 }}>{displayName}</p>
          <p style={{ margin: "3px 0 0", color: "#8A8F9C", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {email || "Signed out"}
          </p>
          {profile.avatar ? (
            <button type="button" onClick={() => setProfile({ avatar: null })} style={{ ...linkButtonStyle, color: "#FF8A8A" }}>
              Remove photo
            </button>
          ) : (
            <button type="button" onClick={onPickAvatar} style={{ ...linkButtonStyle, color: "#4EA1FF" }}>
              Add photo
            </button>
          )}
        </div>
      </div>
      {avatarInput}
      <Field label="Display name">
        <input style={IS} value={profile.name || ""} onChange={(e) => setProfile({ name: e.target.value })} placeholder="Your name" />
      </Field>
      <Field label="Personal notes">
        <TextAreaField value={profile.notes || ""} onChange={(e) => setProfile({ notes: e.target.value })} placeholder="Injuries, schedule, preferences..." />
      </Field>
    </Group>
  );
}

function NumberField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <input style={IS} type="number" value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function ImperialBodyFields({ profile, setProfile }) {
  const { feet, inches } = toFeetInches(profile.heightCm);
  const targetWeight = profile.targetWeightKg ? kgToPounds(profile.targetWeightKg) : "";
  return (
    <>
      <NumberField label="Height feet" value={feet || ""} onChange={(value) => setProfile({ heightCm: feetInchesToCm(value, inches) })} />
      <NumberField label="Height inches" value={inches || ""} onChange={(value) => setProfile({ heightCm: feetInchesToCm(feet, value) })} />
      <NumberField label="Current weight (lb)" value={kgToPounds(profile.weightKg)} onChange={(value) => setProfile({ weightKg: poundsToKg(value) })} />
      <NumberField label="Target weight (lb)" value={targetWeight} onChange={(value) => setProfile({ targetWeightKg: poundsToKg(value) })} />
    </>
  );
}

function MetricBodyFields({ profile, setProfile }) {
  return (
    <>
      <NumberField label="Height (cm)" value={profile.heightCm || ""} onChange={(value) => setProfile({ heightCm: value })} />
      <NumberField label="Current weight (kg)" value={profile.weightKg || ""} onChange={(value) => setProfile({ weightKg: value })} />
      <NumberField label="Target weight (kg)" value={profile.targetWeightKg || ""} onChange={(value) => setProfile({ targetWeightKg: value })} />
    </>
  );
}

export function BodyGoalsSection({ profile, unitSystem, calorieStats, setProfile }) {
  const BodyFields = unitSystem === "imperial" ? ImperialBodyFields : MetricBodyFields;
  const rates = profile.goal === "bulk" ? BULK_RATES : CUT_RATES;

  return (
    <>
      <Group title="Body">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <NumberField label="Age" value={profile.age || ""} onChange={(value) => setProfile({ age: value })} />
          <Field label="Sex">
            <select style={IS} value={profile.sex || "male"} onChange={(e) => setProfile({ sex: e.target.value })}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Field>
          <BodyFields profile={profile} setProfile={setProfile} />
        </div>
      </Group>

      <Group title="Goal">
        <select style={IS} value={profile.goal || "maintain"} onChange={(e) => setProfile({ goal: e.target.value })}>
          {GOAL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select style={IS} value={profile.weeklyGoalRate || "moderate"} onChange={(e) => setProfile({ weeklyGoalRate: e.target.value })}>
          {rates.map((rate) => <option key={rate} value={rate}>{rate}</option>)}
        </select>
        <select style={IS} value={profile.activityLevel || "moderate"} onChange={(e) => setProfile({ activityLevel: e.target.value })}>
          {ACTIVITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </Group>

      <Group title="Nutrition target">
        {calorieStats ? (
          <>
            <p style={textStyle}>BMR estimate: <strong>{calorieStats.bmr}</strong> kcal/day</p>
            <p style={textStyle}>Maintenance calories: <strong>{calorieStats.maintenance}</strong> kcal/day</p>
            <p style={textStyle}>Goal calories: <strong>{calorieStats.target}</strong> kcal/day</p>
            <p style={{ margin: 0, color: "#8BA6C9" }}>Protein target: <strong>{getProteinRange(profile)}</strong></p>
          </>
        ) : (
          <p style={{ ...mutedStyle, color: "#888" }}>Add age, height, and current weight to estimate calories and protein.</p>
        )}
      </Group>
    </>
  );
}

export function TrackingModulesSection({ enabledModules, toggleModule }) {
  return (
    <>
      <Group title="Main modules">
        {MAIN_MODULES.map((module) => (
          <ToggleRow
            key={module.key}
            label={`${module.label}${module.locked ? " · Core" : ""}`}
            desc={module.desc}
            on={module.locked || enabledModules[module.key]}
            disabled={module.locked}
            onClick={() => toggleModule(module.key)}
          />
        ))}
      </Group>
      <Group title="Support modules">
        {SUPPORT_MODULES.map((module) => (
          <ToggleRow key={module.key} label={module.label} desc={module.desc} on={enabledModules[module.key]} onClick={() => toggleModule(module.key)} />
        ))}
      </Group>
    </>
  );
}
