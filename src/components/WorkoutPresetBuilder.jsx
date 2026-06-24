import { useMemo, useState } from "react";
import {
  EXERCISE_CATEGORY_OPTIONS,
  EXERCISE_LIBRARY,
  EXERCISE_REGION_OPTIONS,
  getDefaultExercisePrescription,
} from "../exerciseLibrary.js";
import { formatRestLabel } from "../workouts.js";
import { IS } from "../storage.js";
import { colors, radii, typeScale } from "../theme.js";
import { ActionButton, Pill, SurfaceCard } from "./ui.jsx";
import { Icon } from "./icons.jsx";

const COLOR_OPTIONS = ["#4EA1FF", "#3DDC97", "#F6B73C", "#FF5D5D", "#8B5CF6", "#14B8A6"];

const fieldLabel = {
  ...typeScale.overline,
  display: "block",
  color: colors.textMuted,
  marginBottom: 6,
  textTransform: "uppercase",
};

const compactInput = {
  ...IS,
  minHeight: 40,
  fontSize: 13,
};

const iconButton = {
  appearance: "none",
  WebkitAppearance: "none",
  width: 34,
  height: 34,
  borderRadius: radii.sm,
  border: `1px solid ${colors.border}`,
  background: "rgba(255,255,255,0.04)",
  color: colors.textSecondary,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
};

function Field({ label, children, style }) {
  return (
    <label style={{ display: "block", ...style }}>
      <span style={fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function getSearchResults(query, category, region) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return EXERCISE_LIBRARY
    .filter((exercise) => {
      if (category && exercise.mainCategory !== category) return false;
      if (region && exercise.bodyRegion !== region) return false;
      return terms.every((term) => exercise.searchText.includes(term));
    })
    .slice(0, 18);
}

export function WorkoutPresetBuilder({ onCancel, onSave }) {
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [region, setRegion] = useState("");
  const [exercises, setExercises] = useState([]);
  const [error, setError] = useState("");

  const searchResults = useMemo(() => getSearchResults(query, category, region), [category, query, region]);
  const selectedIds = useMemo(() => new Set(exercises.map((exercise) => exercise.exerciseId).filter(Boolean)), [exercises]);

  const addExercise = (libraryExercise) => {
    if (selectedIds.has(libraryExercise.id)) {
      return;
    }
    setError("");
    setExercises((current) => [...current, getDefaultExercisePrescription(libraryExercise)]);
  };

  const updateExercise = (index, patch) => {
    setExercises((current) => current.map((exercise, itemIndex) => (itemIndex === index ? { ...exercise, ...patch } : exercise)));
  };

  const moveExercise = (index, direction) => {
    setExercises((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  };

  const removeExercise = (index) => {
    setExercises((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSave = () => {
    const presetTitle = title.trim();
    if (!presetTitle) {
      setError("Name the preset before saving.");
      return;
    }
    if (!exercises.length) {
      setError("Add at least one exercise.");
      return;
    }
    onSave({
      title: presetTitle,
      shortTitle: presetTitle,
      goal: goal.trim() || "Personal preset",
      color,
      performance: exercises,
      finisher: [],
      core: null,
    });
  };

  return (
    <SurfaceCard style={{ marginBottom: 16, borderColor: `${color}55`, background: "rgba(255,255,255,0.035)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <div>
          <p style={{ ...typeScale.overline, color, margin: 0, textTransform: "uppercase" }}>New Preset</p>
          <h2 style={{ ...typeScale.titleMd, margin: "3px 0 0", color: colors.textPrimary }}>Workout Builder</h2>
        </div>
        <button type="button" onClick={onCancel} title="Close builder" style={iconButton}>
          <Icon name="x" size={16} />
        </button>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <Field label="Name">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Push day" style={compactInput} />
        </Field>
        <Field label="Goal">
          <input value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Strength, hypertrophy, conditioning" style={compactInput} />
        </Field>
      </div>

      <div style={{ marginTop: 12 }}>
        <span style={fieldLabel}>Color</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {COLOR_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setColor(option)}
              title={`Use ${option}`}
              style={{
                ...iconButton,
                width: 32,
                height: 32,
                borderColor: color === option ? option : colors.border,
                background: option,
                boxShadow: color === option ? `0 0 0 3px ${option}33` : "none",
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <span style={fieldLabel}>Exercise Library</span>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ position: "relative" }}>
            <Icon name="search" size={15} color={colors.textMuted} style={{ position: "absolute", left: 11, top: 12 }} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search 498 exercises"
              style={{ ...compactInput, paddingLeft: 34 }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <select value={category} onChange={(event) => setCategory(event.target.value)} style={compactInput}>
              <option value="">All categories</option>
              {EXERCISE_CATEGORY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <select value={region} onChange={(event) => setRegion(event.target.value)} style={compactInput}>
              <option value="">All regions</option>
              {EXERCISE_REGION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 10, display: "grid", gap: 7, maxHeight: 300, overflowY: "auto", paddingRight: 2 }}>
          {searchResults.map((exercise) => {
            const added = selectedIds.has(exercise.id);
            return (
              <button
                key={exercise.id}
                type="button"
                onClick={() => addExercise(exercise)}
                disabled={added}
                style={{
                  appearance: "none",
                  WebkitAppearance: "none",
                  width: "100%",
                  border: `1px solid ${added ? `${colors.success}44` : colors.border}`,
                  borderRadius: radii.sm,
                  background: added ? "rgba(61,220,151,0.08)" : "rgba(255,255,255,0.035)",
                  color: colors.textPrimary,
                  padding: "10px 11px",
                  cursor: added ? "default" : "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  opacity: added ? 0.75 : 1,
                }}
              >
                <span style={{ ...iconButton, width: 28, height: 28, borderColor: added ? `${colors.success}55` : colors.border, color: added ? colors.success : color }}>
                  <Icon name={added ? "check" : "plus"} size={14} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 800, color: colors.textPrimary }}>{exercise.name}</span>
                  <span style={{ display: "block", fontSize: 10, color: colors.textMuted, marginTop: 2 }}>
                    {exercise.mainCategory} · {exercise.primaryMuscle} · {exercise.equipment}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {exercises.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <span style={fieldLabel}>Selected Exercises</span>
          <div style={{ display: "grid", gap: 8 }}>
            {exercises.map((exercise, index) => (
              <div key={`${exercise.exerciseId}-${index}`} style={{ border: `1px solid ${colors.border}`, borderRadius: radii.md, background: "rgba(255,255,255,0.03)", padding: 10 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 850, color: colors.textPrimary }}>{index + 1}. {exercise.name}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 10, color: colors.textMuted }}>{exercise.type} · {exercise.libraryMeta?.trackBy || "Tracked manually"}</p>
                  </div>
                  <button type="button" onClick={() => moveExercise(index, -1)} disabled={index === 0} title="Move up" style={{ ...iconButton, opacity: index === 0 ? 0.35 : 1 }}>
                    <Icon name="chevronUp" size={15} />
                  </button>
                  <button type="button" onClick={() => moveExercise(index, 1)} disabled={index === exercises.length - 1} title="Move down" style={{ ...iconButton, opacity: index === exercises.length - 1 ? 0.35 : 1 }}>
                    <Icon name="chevronDown" size={15} />
                  </button>
                  <button type="button" onClick={() => removeExercise(index)} title="Remove exercise" style={{ ...iconButton, color: colors.danger }}>
                    <Icon name="trash" size={15} />
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "0.65fr 1fr 0.8fr", gap: 7, marginTop: 10 }}>
                  <Field label="Sets">
                    <input
                      type="number"
                      min="1"
                      value={exercise.sets}
                      onChange={(event) => updateExercise(index, { sets: event.target.value })}
                      style={compactInput}
                    />
                  </Field>
                  <Field label="Reps">
                    <input
                      value={exercise.reps}
                      onChange={(event) => updateExercise(index, { reps: event.target.value })}
                      style={compactInput}
                    />
                  </Field>
                  <Field label="Rest">
                    <input
                      type="number"
                      min="0"
                      value={exercise.rest}
                      onChange={(event) => {
                        const rest = Number.parseInt(event.target.value, 10) || 0;
                        updateExercise(index, { rest, restLabel: formatRestLabel(rest) });
                      }}
                      style={compactInput}
                    />
                  </Field>
                </div>

                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9, color: colors.textSecondary, ...typeScale.bodySm }}>
                  <input
                    type="checkbox"
                    checked={exercise.tracked}
                    onChange={(event) => updateExercise(index, { tracked: event.target.checked })}
                    style={{ accentColor: color }}
                  />
                  Track load or score
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <Pill color={colors.danger} background="rgba(255,93,93,0.1)" border={`1px solid ${colors.danger}55`} style={{ marginTop: 12 }}>
          {error}
        </Pill>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 16 }}>
        <ActionButton type="button" tone="secondary" onClick={onCancel}>Cancel</ActionButton>
        <ActionButton type="button" color={color} onClick={handleSave}>Save Preset</ActionButton>
      </div>
    </SurfaceCard>
  );
}

