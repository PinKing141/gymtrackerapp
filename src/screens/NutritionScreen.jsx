import { useEffect, useMemo, useState } from "react";
import { Icon } from "../components/icons.jsx";
import { ActionButton, BackButton, Pill, Screen, ScreenHeader, SurfaceButton, SurfaceCard } from "../components/ui.jsx";
import { IS, fd, today } from "../storage.js";
import { colors, radii, typeScale } from "../theme.js";
import { getFoodDisplayDetail, getFoodDisplayName, getFoodSourceLabel, getLoggedFoodParts, loadFoodDatabase, searchFoods } from "../services/nutrition/foodSearch.js";
import { lookupByBarcode, normalizeBarcode, searchOnline } from "../services/nutrition/openFoodFacts.js";
import { assessFoodQuality } from "../services/nutrition/quality.js";
import { getWeeklyNutritionSummary } from "../services/nutrition/insights.js";
import { computeAmount, getServingOptions } from "../services/nutrition/servings.js";
import { createRecipeFood, getPerServing, getRecipeTotals, ingredientFromFood } from "../services/nutrition/recipes.js";
import { BarcodeScanner } from "../components/nutrition/BarcodeScanner.jsx";
import { Avatar } from "../components/Avatar.jsx";
import {
  MEAL_TYPES,
  createFoodLogEntry,
  createQuickAddLogEntry,
  getDefaultMealType,
  getRecentFoodLogs,
  repeatFoodLogEntry,
} from "../services/nutrition/foodLog.js";
import { createFoodLogsFromSavedMeal, createSavedMealFromLogs } from "../services/nutrition/mealBuilder.js";
import { getProgressRatio, nutritionForAmount, sumNutrition, toPer100FromServing } from "../services/nutrition/nutritionMath.js";
import { getNutritionTargets } from "../services/nutrition/nutritionTargets.js";

const EMPTY_NUTRITION = {
  foodLogs: [],
  customFoods: [],
  savedMeals: [],
  favourites: [],
  barcodeCache: {},
  targets: null,
};

const DEFAULT_CUSTOM_DRAFT = {
  name: "",
  brand: "",
  servingSize: 100,
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
  sugar: "",
  fibre: "",
  salt: "",
};

function createEmptyQuickDraft() {
  return {
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    mealType: getDefaultMealType(),
  };
}

function normalizeNutrition(value) {
  return {
    ...EMPTY_NUTRITION,
    ...(value && typeof value === "object" ? value : {}),
    foodLogs: Array.isArray(value?.foodLogs) ? value.foodLogs : [],
    customFoods: Array.isArray(value?.customFoods) ? value.customFoods : [],
    savedMeals: Array.isArray(value?.savedMeals) ? value.savedMeals : [],
    favourites: Array.isArray(value?.favourites) ? value.favourites : [],
    barcodeCache: value?.barcodeCache && typeof value.barcodeCache === "object" ? value.barcodeCache : {},
    targets: value?.targets && typeof value.targets === "object" ? value.targets : null,
  };
}

function shiftDate(dateString, days) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatAmount(value, unit = "g") {
  const number = Number(value);
  const suffix = unit === "g" ? "g" : ` ${unit}`;
  if (!Number.isFinite(number)) return `0${suffix}`;
  return `${number % 1 === 0 ? number : number.toFixed(1)}${suffix}`;
}

function formatMacro(value, unit = "g") {
  const number = Number(value);
  if (!Number.isFinite(number)) return `0${unit}`;
  if (unit === "kcal") return `${Math.round(number).toLocaleString()} ${unit}`;
  return `${(number % 1 === 0 ? number : number.toFixed(1)).toLocaleString()}${unit}`;
}

function formatPer100(value, unit) {
  if (value === null || value === undefined || value === "") return `- ${unit}`;
  return formatMacro(value, unit);
}

function foodId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function NutritionStateUpdater(setApp, updater) {
  setApp((current) => {
    const currentNutrition = normalizeNutrition(current.nutrition);
    const nextNutrition = typeof updater === "function" ? updater(currentNutrition) : updater;
    return {
      ...current,
      nutrition: normalizeNutrition(nextNutrition),
    };
  });
}

function ProgressLine({ label, value, target, unit, color = colors.accent, limit = false }) {
  const ratio = getProgressRatio(value, target);
  const overLimit = limit && Number(target) > 0 && Number(value) > Number(target);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", marginBottom: 6 }}>
        <p style={{ margin: 0, fontSize: 12, color: colors.textSecondary, fontWeight: 700 }}>{label}</p>
        <p style={{ margin: 0, fontSize: 12, color: overLimit ? colors.danger : colors.textMuted, fontWeight: 700 }}>
          {formatMacro(value, unit)} / {formatMacro(target, unit)}
        </p>
      </div>
      <div style={{ height: 7, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, ratio * 100)}%`, height: "100%", borderRadius: 999, background: overLimit ? colors.danger : color }} />
      </div>
    </div>
  );
}

function MealTabs({ value, onChange }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
      {MEAL_TYPES.map((meal) => {
        const active = value === meal.id;
        return (
          <button
            key={meal.id}
            type="button"
            onClick={() => onChange(meal.id)}
            style={{
              minHeight: 36,
              borderRadius: radii.sm,
              border: `1px solid ${active ? "rgba(78,161,255,0.5)" : colors.border}`,
              background: active ? "rgba(78,161,255,0.14)" : "rgba(255,255,255,0.03)",
              color: active ? colors.accent : colors.textMuted,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            {meal.label}
          </button>
        );
      })}
    </div>
  );
}

function DateSwitcher({ selectedDate, onChange }) {
  const isToday = selectedDate === today();

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <button type="button" aria-label="Previous day" onClick={() => onChange(shiftDate(selectedDate, -1))} style={iconButtonStyle}>
        <Icon name="chevronLeft" size={16} color={colors.textSecondary} />
      </button>
      <div style={{ textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: colors.textPrimary }}>{isToday ? "Today" : fd(selectedDate)}</p>
        <p style={{ margin: "2px 0 0", ...typeScale.caption, color: colors.textMuted }}>{selectedDate}</p>
      </div>
      <button type="button" aria-label="Next day" onClick={() => onChange(shiftDate(selectedDate, 1))} style={iconButtonStyle}>
        <Icon name="chevronRight" size={16} color={colors.textSecondary} />
      </button>
    </div>
  );
}

const iconButtonStyle = {
  width: 38,
  height: 38,
  borderRadius: radii.sm,
  border: `1px solid ${colors.border}`,
  background: "rgba(255,255,255,0.03)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

function SummaryCard({ totals, targets }) {
  return (
    <SurfaceCard style={{ padding: "18px 16px", borderColor: "rgba(78,161,255,0.22)", background: "rgba(78,161,255,0.07)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 14, marginBottom: 14 }}>
        <div>
          <p style={{ ...typeScale.overline, textTransform: "uppercase", color: colors.accent, margin: 0 }}>Calories</p>
          <p style={{ margin: "4px 0 0", fontSize: 36, lineHeight: 1, fontWeight: 900, color: colors.textPrimary }}>{Math.round(totals.calories).toLocaleString()}</p>
        </div>
        <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 800, color: colors.textSecondary }}>
          / {targets.calorieTarget ? targets.calorieTarget.toLocaleString() : "-"} kcal
        </p>
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        <ProgressLine label="Calories" value={totals.calories} target={targets.calorieTarget} unit="kcal" />
        <ProgressLine label="Protein" value={totals.protein} target={targets.proteinTarget} unit="g" color={colors.success} />
        <ProgressLine label="Carbs" value={totals.carbs} target={targets.carbsTarget} unit="g" color={colors.warning} />
        <ProgressLine label="Fat" value={totals.fat} target={targets.fatTarget} unit="g" color="#FF8A5B" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 14 }}>
        {[
          ["Fibre", totals.fibre, targets.fibreTarget, "g", colors.success, false],
          ["Sugar", totals.sugar, 0, "g", colors.textSecondary, false],
          ["Salt", totals.salt, targets.saltLimit, "g", colors.danger, true],
        ].map(([label, value, target, unit, color, limit]) => (
          <div key={label} style={{ minWidth: 0, padding: "9px 8px", borderRadius: radii.sm, background: "rgba(255,255,255,0.04)", border: `1px solid ${colors.border}` }}>
            <p style={{ margin: 0, ...typeScale.caption, color: colors.textMuted }}>{label}</p>
            <p style={{ margin: "3px 0 0", fontSize: 13, fontWeight: 800, color: limit && target && value > target ? colors.danger : color }}>
              {formatMacro(value, unit)}
            </p>
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}

const SOURCE_ACCENT = {
  recipe: { color: "#F5A623", bg: "rgba(246,183,60,0.12)", border: "rgba(246,183,60,0.35)", icon: "clipboard", tag: "Recipe" },
  custom: { color: colors.success, bg: "rgba(61,220,151,0.12)", border: "rgba(61,220,151,0.3)", icon: "spark", tag: "Custom" },
  open_food_facts: { color: "#B58BFF", bg: "rgba(139,92,246,0.14)", border: "rgba(139,92,246,0.4)", icon: "search", tag: "Branded" },
  default: { color: colors.accent, bg: "rgba(78,161,255,0.12)", border: "rgba(78,161,255,0.3)", icon: "clipboard", tag: "Database" },
};

function sourceAccent(source) {
  return SOURCE_ACCENT[source] || SOURCE_ACCENT.default;
}

function FoodResultRow({ food, onClick, pinned = false, onTogglePin, warning = false }) {
  const accent = sourceAccent(food.source);
  const detail = getFoodDisplayDetail(food);
  const perUnit = food.serving_unit === "ml" ? "per 100ml" : "per 100g";
  return (
    <SurfaceButton onClick={onClick} style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: accent.bg, border: `1px solid ${accent.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon name={accent.icon} size={18} color={accent.color} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ margin: 0, ...typeScale.body, fontWeight: 800, color: colors.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getFoodDisplayName(food)}</p>
        {detail && (
          <p style={{ margin: "2px 0 0", ...typeScale.caption, color: colors.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detail}</p>
        )}
        <p style={{ margin: "4px 0 0", ...typeScale.caption, color: colors.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {formatPer100(food.calories_per_100g, "kcal")} · {formatPer100(food.protein_per_100g, "g")} protein {perUnit}
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {warning && <span title="Data quality warning" style={{ fontSize: 12 }}>⚠️</span>}
          {onTogglePin && (
            <span
              role="button"
              aria-label={pinned ? "Unpin food" : "Pin food"}
              onClick={(event) => { event.stopPropagation(); onTogglePin(); }}
              style={{ fontSize: 15, color: pinned ? colors.warning : colors.textMuted, cursor: "pointer", lineHeight: 1 }}
            >
              {pinned ? "★" : "☆"}
            </span>
          )}
          <Pill color={accent.color} background={accent.bg} border={`1px solid ${accent.border}`}>{accent.tag}</Pill>
        </span>
        <Icon name="chevronRight" size={16} color={colors.textMuted} />
      </div>
    </SurfaceButton>
  );
}

function SavedMealRow({ meal, onLog }) {
  return (
    <SurfaceCard style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: colors.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meal.name}</p>
        <p style={{ margin: "3px 0 0", ...typeScale.caption, color: colors.textMuted }}>
          {Math.round(meal.totalCalories || 0)} kcal · {meal.totalProtein || 0}g protein · {(meal.items || []).length} items
        </p>
      </div>
      <button type="button" onClick={onLog} style={{ ...smallButtonStyle, color: colors.success, borderColor: "rgba(61,220,151,0.35)", background: "rgba(61,220,151,0.10)" }}>
        Log
      </button>
    </SurfaceCard>
  );
}

function RecentFoodRow({ entry, onRepeat }) {
  return (
    <SurfaceCard style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: colors.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getLoggedFoodParts(entry.foodName).title}</p>
        <p style={{ margin: "3px 0 0", ...typeScale.caption, color: colors.textMuted }}>
          {formatAmount(entry.amount, entry.unit)} · {Math.round(entry.calories || 0)} kcal · {entry.protein || 0}g protein
        </p>
      </div>
      <button type="button" onClick={onRepeat} style={smallButtonStyle}>Again</button>
    </SurfaceCard>
  );
}

const smallButtonStyle = {
  border: `1px solid ${colors.border}`,
  borderRadius: radii.sm,
  background: "rgba(255,255,255,0.04)",
  color: colors.textSecondary,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 800,
  padding: "8px 10px",
};

function MealSection({ meal, entries, onDelete, onSaveMeal }) {
  const totals = sumNutrition(entries);

  return (
    <SurfaceCard style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: entries.length ? 10 : 0 }}>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: colors.textPrimary }}>{meal.label}</p>
          <p style={{ margin: "3px 0 0", ...typeScale.caption, color: colors.textMuted }}>
            {entries.length ? `${Math.round(totals.calories)} kcal · ${totals.protein}g protein` : "No foods logged"}
          </p>
        </div>
        {entries.length > 0 && (
          <button type="button" onClick={() => onSaveMeal(meal.id)} style={{ ...smallButtonStyle, padding: "7px 9px" }}>
            Save meal
          </button>
        )}
      </div>
      {entries.map((entry) => {
        const parts = getLoggedFoodParts(entry.foodName);
        return (
          <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: `1px solid ${colors.border}` }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 750, color: colors.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{parts.title}</p>
              <p style={{ margin: "2px 0 0", ...typeScale.caption, color: colors.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {formatAmount(entry.amount, entry.unit)} · {Math.round(entry.calories || 0)} kcal · {entry.protein || 0}g protein
              </p>
            </div>
            <button type="button" aria-label={`Delete ${parts.title}`} onClick={() => onDelete(entry.id)} style={{ ...iconButtonStyle, width: 32, height: 32, borderRadius: 9 }}>
              <Icon name="trash" size={14} color={colors.danger} />
            </button>
          </div>
        );
      })}
    </SurfaceCard>
  );
}

// Weekly view: averages beat daily noise. Every number states its basis.
function WeeklyCard({ summary }) {
  const [basisOpen, setBasisOpen] = useState(false);
  if (!summary.loggedDayCount) {
    return null;
  }
  return (
    <SurfaceCard style={{ marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <p style={{ margin: 0, ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase" }}>Last 7 days</p>
        <span style={{ display: "flex", gap: 3 }}>
          {summary.days.map((day) => (
            <span key={day.date} title={day.date} style={{ width: 7, height: 7, borderRadius: 999, background: day.logged ? colors.success : "rgba(255,255,255,0.12)" }} />
          ))}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        <div>
          <p style={{ margin: 0, ...typeScale.caption, color: colors.textMuted }}>Avg kcal</p>
          <p style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 900, color: colors.textPrimary }}>{summary.avgCalories.toLocaleString()}</p>
        </div>
        <div>
          <p style={{ margin: 0, ...typeScale.caption, color: colors.textMuted }}>Avg protein</p>
          <p style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 900, color: colors.success }}>{summary.avgProtein}g</p>
        </div>
        <div>
          <p style={{ margin: 0, ...typeScale.caption, color: colors.textMuted }}>Consistency</p>
          <p style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 900, color: summary.consistencyPercent >= 70 ? colors.success : colors.warning }}>{summary.consistencyPercent}%</p>
        </div>
      </div>
      {summary.trend && (
        <p style={{ margin: "10px 0 0", ...typeScale.caption, color: colors.textSecondary }}>
          Estimated weight trend: <strong style={{ color: summary.trend.kgPerWeek > 0 ? colors.warning : colors.accent }}>{summary.trend.text}</strong>
          {" "}
          <button type="button" onClick={() => setBasisOpen((open) => !open)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", ...typeScale.caption, color: colors.textMuted, textDecoration: "underline" }}>
            {basisOpen ? "hide basis" : "how?"}
          </button>
        </p>
      )}
      {summary.trend && basisOpen && (
        <p style={{ margin: "6px 0 0", ...typeScale.caption, color: colors.textMuted, lineHeight: 1.5 }}>{summary.trend.basis}</p>
      )}
    </SurfaceCard>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 11, color: colors.textMuted, fontWeight: 800 }}>
      {label}
      {children}
    </label>
  );
}

export function NutritionScreen({ app, setApp, onBack, onOpenProfile }) {
  const [foods, setFoods] = useState([]);
  const [foodStatus, setFoodStatus] = useState("idle");
  const [foodError, setFoodError] = useState("");
  const [mode, setMode] = useState("home");
  const [selectedDate, setSelectedDate] = useState(today());
  const [query, setQuery] = useState("");
  const [selectedFood, setSelectedFood] = useState(null);
  const [qty, setQty] = useState(100);
  const [unitId, setUnitId] = useState("g");
  const [unitGrams, setUnitGrams] = useState("");
  const [recipeDraft, setRecipeDraft] = useState({ name: "", cookedWeightG: "", servings: "2", ingredients: [] });
  const [recipeQuery, setRecipeQuery] = useState("");
  const [mealType, setMealType] = useState(() => getDefaultMealType());
  const [customDraft, setCustomDraft] = useState(DEFAULT_CUSTOM_DRAFT);
  const [quickDraft, setQuickDraft] = useState(() => createEmptyQuickDraft());
  const [saveMealDraft, setSaveMealDraft] = useState(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeStatus, setBarcodeStatus] = useState("idle");
  const [barcodeError, setBarcodeError] = useState("");
  const [incompleteProduct, setIncompleteProduct] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [onlineResults, setOnlineResults] = useState([]);
  const [onlineStatus, setOnlineStatus] = useState("idle");
  const [onlineError, setOnlineError] = useState("");

  const nutrition = useMemo(() => normalizeNutrition(app?.nutrition), [app?.nutrition]);
  const logs = nutrition.foodLogs;
  const customFoods = nutrition.customFoods;
  const savedMeals = nutrition.savedMeals;
  const dateLogs = useMemo(() => logs.filter((entry) => entry.date === selectedDate), [logs, selectedDate]);
  const totals = useMemo(() => sumNutrition(dateLogs), [dateLogs]);
  const targets = useMemo(() => getNutritionTargets(app?.profile || {}, nutrition.targets), [app?.profile, nutrition.targets]);
  const recentFoods = useMemo(() => getRecentFoodLogs(logs), [logs]);
  const results = useMemo(() => searchFoods({ foods, customFoods, query }), [foods, customFoods, query]);
  const servingOptions = useMemo(() => (selectedFood ? getServingOptions(selectedFood) : []), [selectedFood]);
  const activeServing = servingOptions.find((option) => option.id === unitId) || servingOptions[0] || null;
  const amount = activeServing ? computeAmount(qty, activeServing, unitGrams) : 0;
  const preview = useMemo(() => (selectedFood ? nutritionForAmount(selectedFood, amount) : null), [selectedFood, amount]);
  const weeklySummary = useMemo(() => getWeeklyNutritionSummary(app, selectedDate), [app, selectedDate]);
  const foodKey = (food) => String(food?.id ?? food?.food_id ?? "");
  const isPinned = (food) => nutrition.favourites.includes(foodKey(food));
  const togglePin = (food) => {
    const key = foodKey(food);
    if (!key) return;
    updateNutrition((current) => ({
      ...current,
      favourites: (current.favourites || []).includes(key)
        ? (current.favourites || []).filter((id) => id !== key)
        : [...(current.favourites || []), key],
    }));
  };
  // Resolve pinned ids back to food objects from every pool we know about.
  const pinnedFoods = useMemo(() => {
    const pools = [...customFoods, ...Object.values(nutrition.barcodeCache || {}), ...foods];
    return nutrition.favourites
      .map((id) => pools.find((food) => String(food?.id ?? food?.food_id ?? "") === id))
      .filter(Boolean);
  }, [customFoods, foods, nutrition.barcodeCache, nutrition.favourites]);
  const recipeResults = useMemo(
    () => (recipeQuery.trim().length >= 2 ? searchFoods({ foods, customFoods, query: recipeQuery }).slice(0, 5) : []),
    [foods, customFoods, recipeQuery]
  );

  useEffect(() => {
    let active = true;
    setFoodStatus("loading");
    loadFoodDatabase()
      .then((items) => {
        if (!active) return;
        setFoods(Array.isArray(items) ? items : []);
        setFoodStatus("ready");
      })
      .catch((error) => {
        if (!active) return;
        setFoodError(error?.message || "Food database could not be loaded.");
        setFoodStatus("error");
      });

    return () => {
      active = false;
    };
  }, []);

  // Clear online results whenever the query changes, so results always match the
  // current text and the OFF request only ever fires from the button.
  useEffect(() => {
    setOnlineResults([]);
    setOnlineStatus("idle");
    setOnlineError("");
  }, [query]);

  const updateNutrition = (updater) => NutritionStateUpdater(setApp, updater);
  const addLogs = (entries) => {
    updateNutrition((current) => ({
      ...current,
      foodLogs: [...entries, ...current.foodLogs],
    }));
  };

  const openFoodDetail = (food) => {
    setSelectedFood(food);
    if (Number(food?.serving_size) > 0) {
      setUnitId("serving");
      setQty(1);
    } else {
      setUnitId(food?.serving_unit === "ml" ? "ml" : "g");
      setQty(100);
    }
    setUnitGrams("");
    setMealType(getDefaultMealType());
    setMode("detail");
  };

  const openBarcode = () => {
    setBarcodeInput("");
    setBarcodeStatus("idle");
    setBarcodeError("");
    setIncompleteProduct(null);
    setMode("barcode");
  };

  const cacheBarcode = (barcode, food) => {
    updateNutrition((current) => ({
      ...current,
      barcodeCache: { ...(current.barcodeCache || {}), [barcode]: food },
    }));
  };

  const lookupBarcodeValue = async (rawValue) => {
    const barcode = normalizeBarcode(rawValue);
    if (barcode.length < 6) {
      setBarcodeStatus("error");
      setBarcodeError("Enter a full barcode number.");
      return;
    }

    setIncompleteProduct(null);

    // Cache hit — never re-hit the API for a barcode we've already resolved.
    const cached = (nutrition.barcodeCache || {})[barcode];
    if (cached) {
      openFoodDetail(cached);
      return;
    }

    setBarcodeStatus("loading");
    setBarcodeError("");
    const result = await lookupByBarcode(barcode);

    if (result.status === "found") {
      cacheBarcode(barcode, result.food);
      setBarcodeStatus("idle");
      openFoodDetail(result.food);
    } else if (result.status === "incomplete") {
      setIncompleteProduct(result.food);
      setBarcodeStatus("incomplete");
    } else if (result.status === "not_found") {
      setBarcodeStatus("not_found");
    } else {
      setBarcodeStatus("error");
      setBarcodeError(result.error || "Something went wrong.");
    }
  };

  const runBarcodeLookup = () => lookupBarcodeValue(barcodeInput);

  const handleScan = (code) => {
    setScannerOpen(false);
    const normalized = normalizeBarcode(code);
    setBarcodeInput(normalized);
    lookupBarcodeValue(normalized);
  };

  const addProductManually = (product) => {
    setCustomDraft({ ...DEFAULT_CUSTOM_DRAFT, name: product?.food_name || "", brand: product?.brand || "" });
    setMode("custom");
  };

  const runOnlineSearch = async () => {
    const q = query.trim();
    if (q.length < 2 || onlineStatus === "loading") return;
    setOnlineStatus("loading");
    setOnlineError("");
    const res = await searchOnline(q);
    if (res.status === "ok") {
      setOnlineResults(res.foods);
      setOnlineStatus("done");
    } else if (res.status === "empty") {
      setOnlineResults([]);
      setOnlineStatus("empty");
    } else {
      setOnlineResults([]);
      setOnlineStatus("error");
      setOnlineError(res.error || "Online search failed.");
    }
  };

  const addSelectedFood = () => {
    if (!selectedFood || Number(amount) <= 0) return;
    addLogs([createFoodLogEntry({ food: selectedFood, amount: Number(amount), mealType, date: selectedDate })]);
    setMode("home");
    setQuery("");
    setSelectedFood(null);
  };

  const deleteLog = (id) => {
    updateNutrition((current) => ({
      ...current,
      foodLogs: current.foodLogs.filter((entry) => entry.id !== id),
    }));
  };

  const repeatLog = (entry) => {
    addLogs([repeatFoodLogEntry(entry, selectedDate)]);
    setMode("home");
  };

  const copyYesterday = () => {
    const previousDate = shiftDate(selectedDate, -1);
    const entries = logs.filter((entry) => entry.date === previousDate);
    if (!entries.length) return;
    addLogs(entries.map((entry) => repeatFoodLogEntry(entry, selectedDate)));
  };

  const openQuickAdd = () => {
    setQuickDraft({ ...createEmptyQuickDraft(), mealType: getDefaultMealType() });
    setMode("quick");
  };

  const addQuickLog = () => {
    if (!quickDraft.calories && !quickDraft.protein && !quickDraft.carbs && !quickDraft.fat) return;
    addLogs([createQuickAddLogEntry({ ...quickDraft, date: selectedDate })]);
    setMode("home");
  };

  const saveCustomFood = () => {
    if (!customDraft.name.trim() || Number(customDraft.servingSize) <= 0) return;
    const customFood = {
      id: foodId("custom-food"),
      food_name: customDraft.name.trim(),
      name: customDraft.name.trim(),
      brand: customDraft.brand.trim(),
      food_group: "Custom food",
      source: "custom",
      serving_size: Number(customDraft.servingSize),
      serving_unit: "g",
      ...toPer100FromServing(customDraft),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    updateNutrition((current) => ({
      ...current,
      customFoods: [customFood, ...current.customFoods],
    }));
    setCustomDraft(DEFAULT_CUSTOM_DRAFT);
    openFoodDetail(customFood);
  };

  const addRecipeIngredient = (food) => {
    setRecipeDraft((current) => ({ ...current, ingredients: [...current.ingredients, ingredientFromFood(food, 100)] }));
    setRecipeQuery("");
  };

  const saveRecipe = () => {
    const recipeFood = createRecipeFood(recipeDraft);
    if (!recipeFood) return;
    updateNutrition((current) => ({
      ...current,
      customFoods: [recipeFood, ...current.customFoods],
    }));
    setRecipeDraft({ name: "", cookedWeightG: "", servings: "2", ingredients: [] });
    openFoodDetail(recipeFood);
  };

  const saveMealFromType = (type) => {
    const meal = MEAL_TYPES.find((item) => item.id === type);
    setSaveMealDraft({ mealType: type, name: `${meal?.label || "Meal"} ${fd(selectedDate)}` });
  };

  const confirmSaveMeal = () => {
    const entries = dateLogs.filter((entry) => entry.mealType === saveMealDraft?.mealType);
    if (!entries.length || !saveMealDraft?.name.trim()) return;
    const savedMeal = createSavedMealFromLogs(saveMealDraft.name, entries);
    updateNutrition((current) => ({
      ...current,
      savedMeals: [savedMeal, ...current.savedMeals],
    }));
    setSaveMealDraft(null);
  };

  const logSavedMeal = (savedMeal) => {
    const entries = createFoodLogsFromSavedMeal(savedMeal, selectedDate);
    addLogs(entries);
    setMode("home");
  };

  const headerAction = mode === "home"
    ? (onBack ? <BackButton onClick={onBack} /> : undefined)
    : <BackButton onClick={() => setMode("home")} label="Nutrition" />;

  if (mode === "barcode") {
    const canLookup = normalizeBarcode(barcodeInput).length >= 6 && barcodeStatus !== "loading";
    const cameraAvailable = typeof navigator !== "undefined" && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    return (
      <Screen>
        {scannerOpen && <BarcodeScanner onDetected={handleScan} onClose={() => setScannerOpen(false)} />}
        <ScreenHeader action={<BackButton onClick={() => setMode("search")} label="Add food" />} title="Barcode lookup" subtitle="Find a branded product on Open Food Facts" titleAs="h1" topPadding="calc(env(safe-area-inset-top, 0px) + 24px)" />
        {cameraAvailable && (
          <ActionButton onClick={() => setScannerOpen(true)} color="#8B5CF6" style={{ marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Icon name="search" size={17} color="#fff" />
            Scan with camera
          </ActionButton>
        )}
        <SurfaceCard>
          <Field label={cameraAvailable ? "Or enter the barcode number" : "Barcode number"}>
            <input
              value={barcodeInput}
              inputMode="numeric"
              placeholder="e.g. 5011321100000"
              onChange={(event) => setBarcodeInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter" && canLookup) runBarcodeLookup(); }}
              style={{ ...IS, fontSize: 18, letterSpacing: "0.06em", padding: 13 }}
            />
          </Field>
          <ActionButton onClick={runBarcodeLookup} disabled={!canLookup} tone="secondary" style={{ marginTop: 12 }}>
            {barcodeStatus === "loading" ? "Looking up…" : "Look up product"}
          </ActionButton>
          <p style={{ margin: "10px 0 0", ...typeScale.caption, color: colors.textMuted }}>
            The number printed under the barcode works too — handy if a code won't scan.
          </p>
        </SurfaceCard>

        {barcodeStatus === "not_found" && (
          <SurfaceCard>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: colors.textPrimary }}>No product found</p>
            <p style={{ margin: "4px 0 12px", ...typeScale.caption, color: colors.textMuted }}>That barcode isn't in Open Food Facts yet. You can add it as a custom food.</p>
            <ActionButton tone="secondary" onClick={() => addProductManually(null)}>Add as custom food</ActionButton>
          </SurfaceCard>
        )}

        {barcodeStatus === "error" && (
          <SurfaceCard style={{ borderColor: "rgba(255,93,93,0.3)", background: "rgba(255,93,93,0.06)" }}>
            <p style={{ margin: 0, ...typeScale.bodySm, color: colors.danger }}>{barcodeError}</p>
          </SurfaceCard>
        )}

        {barcodeStatus === "incomplete" && incompleteProduct && (
          <SurfaceCard style={{ borderColor: "rgba(246,183,60,0.3)", background: "rgba(246,183,60,0.07)" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: colors.textPrimary }}>{getFoodDisplayName(incompleteProduct)}</p>
            {getFoodDisplayDetail(incompleteProduct) && (
              <p style={{ margin: "2px 0 0", ...typeScale.caption, color: colors.textSecondary }}>{getFoodDisplayDetail(incompleteProduct)}</p>
            )}
            <p style={{ margin: "8px 0 12px", ...typeScale.caption, color: colors.warning }}>Product found, but its nutrition is incomplete. Add the values manually?</p>
            <ActionButton onClick={() => addProductManually(incompleteProduct)} color={colors.warning}>Add nutrition manually</ActionButton>
          </SurfaceCard>
        )}
      </Screen>
    );
  }

  if (mode === "search") {
    return (
      <Screen>
        <ScreenHeader action={headerAction} title="Add food" subtitle={fd(selectedDate)} titleAs="h1" topPadding="calc(env(safe-area-inset-top, 0px) + 24px)" />
        <div style={{ position: "relative", marginBottom: 12 }}>
          <Icon name="search" size={17} color={colors.textMuted} style={{ position: "absolute", left: 12, top: 12 }} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search foods" autoFocus style={{ ...IS, padding: "11px 12px 11px 38px" }} />
        </div>

        <ActionButton tone="tinted" color="#B58BFF" compact onClick={openBarcode} style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Icon name="search" size={16} color="#B58BFF" />
          Scan or enter a barcode
        </ActionButton>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          <ActionButton tone="secondary" compact onClick={() => setMode("custom")}>
            Custom
          </ActionButton>
          <ActionButton tone="secondary" compact onClick={openQuickAdd}>
            Quick add
          </ActionButton>
          <ActionButton tone="tinted" color="#F5A623" compact onClick={() => setMode("recipe")}>
            Recipe
          </ActionButton>
        </div>

        {!query.trim() && pinnedFoods.length > 0 && (
          <>
            <p style={sectionLabelStyle}>Pinned</p>
            {pinnedFoods.map((food) => (
              <FoodResultRow key={`pin-${foodKey(food)}`} food={food} onClick={() => openFoodDetail(food)} pinned onTogglePin={() => togglePin(food)} />
            ))}
          </>
        )}

        {!query.trim() && savedMeals.length > 0 && (
          <>
            <p style={sectionLabelStyle}>Saved meals</p>
            {savedMeals.slice(0, 6).map((meal) => <SavedMealRow key={meal.id} meal={meal} onLog={() => logSavedMeal(meal)} />)}
          </>
        )}

        {!query.trim() && recentFoods.length > 0 && (
          <>
            <p style={sectionLabelStyle}>Recent foods</p>
            {recentFoods.map((entry) => <RecentFoodRow key={entry.id} entry={entry} onRepeat={() => repeatLog(entry)} />)}
          </>
        )}

        {query.trim().length > 0 && (
          <>
            <p style={sectionLabelStyle}>Results</p>
            {foodStatus === "loading" && <SurfaceCard><p style={{ margin: 0, color: colors.textMuted, fontSize: 12 }}>Loading food database...</p></SurfaceCard>}
            {foodStatus === "error" && <SurfaceCard><p style={{ margin: 0, color: colors.danger, fontSize: 12 }}>{foodError}</p></SurfaceCard>}
            {results.map((food) => <FoodResultRow key={`${food.source}-${food.id || food.food_id}`} food={food} onClick={() => openFoodDetail(food)} pinned={isPinned(food)} onTogglePin={() => togglePin(food)} />)}
            {foodStatus === "ready" && results.length === 0 && query.trim().length >= 2 && (
              <SurfaceCard><p style={{ margin: 0, color: colors.textMuted, fontSize: 12 }}>No local matches — try branded foods online below.</p></SurfaceCard>
            )}

            {query.trim().length >= 2 && (
              <>
                {onlineStatus !== "done" && (
                  <ActionButton tone="tinted" color="#B58BFF" compact onClick={runOnlineSearch} disabled={onlineStatus === "loading"} style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <Icon name="search" size={15} color="#B58BFF" />
                    {onlineStatus === "loading" ? "Searching Open Food Facts…" : "Search branded foods online"}
                  </ActionButton>
                )}
                {onlineStatus === "error" && (
                  <SurfaceCard style={{ marginTop: 8, borderColor: "rgba(255,93,93,0.3)", background: "rgba(255,93,93,0.06)" }}>
                    <p style={{ margin: 0, ...typeScale.bodySm, color: colors.danger }}>{onlineError}</p>
                  </SurfaceCard>
                )}
                {onlineStatus === "empty" && (
                  <SurfaceCard style={{ marginTop: 8 }}><p style={{ margin: 0, color: colors.textMuted, fontSize: 12 }}>No branded matches on Open Food Facts.</p></SurfaceCard>
                )}
                {onlineResults.length > 0 && (
                  <>
                    <p style={sectionLabelStyle}>Branded · Open Food Facts</p>
                    {onlineResults.map((food) => <FoodResultRow key={`off-${food.food_id}`} food={food} onClick={() => openFoodDetail(food)} pinned={isPinned(food)} onTogglePin={() => togglePin(food)} warning={assessFoodQuality(food).status === "warning"} />)}
                  </>
                )}
              </>
            )}
          </>
        )}
      </Screen>
    );
  }

  if (mode === "detail" && selectedFood) {
    return (
      <Screen>
        <ScreenHeader action={headerAction} title="Food details" subtitle={fd(selectedDate)} titleAs="h1" topPadding="calc(env(safe-area-inset-top, 0px) + 24px)" />
        <SurfaceCard>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 900, color: colors.textPrimary }}>{getFoodDisplayName(selectedFood)}</p>
            <button
              type="button"
              aria-label={isPinned(selectedFood) ? "Unpin food" : "Pin food"}
              onClick={() => togglePin(selectedFood)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 19, lineHeight: 1, color: isPinned(selectedFood) ? colors.warning : colors.textMuted }}
            >
              {isPinned(selectedFood) ? "★" : "☆"}
            </button>
            <Pill
              color={sourceAccent(selectedFood.source).color}
              background={sourceAccent(selectedFood.source).bg}
              border={`1px solid ${sourceAccent(selectedFood.source).border}`}
              style={{ flexShrink: 0 }}
            >
              {getFoodSourceLabel(selectedFood)}
            </Pill>
          </div>
          {getFoodDisplayDetail(selectedFood) && (
            <p style={{ margin: "5px 0 0", ...typeScale.bodySm, color: colors.textSecondary }}>{getFoodDisplayDetail(selectedFood)}</p>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginTop: 14 }}>
            {[
              ["kcal", selectedFood.calories_per_100g, "kcal"],
              ["Protein", selectedFood.protein_per_100g, "g"],
              ["Carbs", selectedFood.carbs_per_100g, "g"],
              ["Fat", selectedFood.fat_per_100g, "g"],
            ].map(([label, value, unit]) => (
              <div key={label} style={{ minWidth: 0 }}>
                <p style={{ margin: 0, ...typeScale.caption, color: colors.textMuted }}>{label}</p>
                <p style={{ margin: "3px 0 0", fontSize: 13, fontWeight: 800, color: colors.textPrimary }}>{formatPer100(value, unit)}</p>
              </div>
            ))}
          </div>
        </SurfaceCard>

        {(() => {
          const quality = assessFoodQuality(selectedFood);
          if (quality.status === "warning") {
            return (
              <SurfaceCard style={{ borderColor: "rgba(246,183,60,0.35)", background: "rgba(246,183,60,0.07)" }}>
                <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 800, color: colors.warning }}>⚠️ Check this product's data</p>
                {quality.issues.map((issue) => (
                  <p key={issue} style={{ margin: "0 0 4px", ...typeScale.caption, color: "#FFCA8A", lineHeight: 1.5 }}>· {issue}</p>
                ))}
                <p style={{ margin: "4px 0 0", ...typeScale.caption, color: colors.textMuted }}>Community data can be wrong — compare with the label before trusting it.</p>
              </SurfaceCard>
            );
          }
          if (quality.verifiedLooking && selectedFood.source === "open_food_facts") {
            return <p style={{ margin: "0 0 10px", ...typeScale.caption, color: colors.success }}>✓ {quality.note}</p>;
          }
          return null;
        })()}

        <SurfaceCard>
          <p style={{ margin: "0 0 7px", fontSize: 11, color: colors.textMuted, fontWeight: 800 }}>Amount</p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="number" min="0" inputMode="decimal" value={qty} onChange={(event) => setQty(event.target.value)} style={{ ...IS, fontSize: 22, textAlign: "center", padding: 14, width: 110, flexShrink: 0 }} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {servingOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => { setUnitId(option.id); if (option.id !== activeServing?.id) setUnitGrams(""); }}
                  style={{ background: activeServing?.id === option.id ? "rgba(78,161,255,0.16)" : "rgba(255,255,255,0.04)", border: `1px solid ${activeServing?.id === option.id ? colors.accent : colors.border}`, borderRadius: 999, color: activeServing?.id === option.id ? colors.accent : colors.textMuted, fontFamily: "inherit", fontSize: 11, fontWeight: 700, padding: "6px 10px", cursor: "pointer" }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {activeServing?.editable && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <span style={{ ...typeScale.caption, color: colors.textMuted }}>One {activeServing.label} weighs</span>
              <input type="number" inputMode="decimal" value={unitGrams || activeServing.gramsPerUnit} onChange={(event) => setUnitGrams(event.target.value)} style={{ ...IS, width: 74, padding: "6px 8px", fontSize: 13 }} />
              <span style={{ ...typeScale.caption, color: colors.textMuted }}>{selectedFood.serving_unit === "ml" ? "ml" : "g"}</span>
            </div>
          )}
          {activeServing && activeServing.gramsPerUnit !== 1 && (
            <p style={{ margin: "8px 0 0", ...typeScale.caption, color: colors.textSecondary }}>= {amount}{selectedFood.serving_unit === "ml" ? "ml" : "g"} total</p>
          )}
          <div style={{ marginTop: 14 }}>
            <p style={{ margin: "0 0 7px", fontSize: 11, color: colors.textMuted, fontWeight: 800 }}>Meal</p>
            <MealTabs value={mealType} onChange={setMealType} />
          </div>
        </SurfaceCard>

        {preview && (
          <SurfaceCard>
            <p style={{ margin: "0 0 12px", ...typeScale.overline, color: colors.textMuted, textTransform: "uppercase" }}>Nutrition</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
              {[
                ["Calories", preview.calories, "kcal", colors.accent],
                ["Protein", preview.protein, "g", colors.success],
                ["Carbs", preview.carbs, "g", colors.warning],
                ["Fat", preview.fat, "g", "#FF8A5B"],
              ].map(([label, value, unit, color]) => (
                <div key={label} style={{ padding: "10px 11px", borderRadius: radii.sm, background: "rgba(255,255,255,0.04)", border: `1px solid ${colors.border}` }}>
                  <p style={{ margin: 0, ...typeScale.caption, color: colors.textMuted }}>{label}</p>
                  <p style={{ margin: "3px 0 0", fontSize: 17, fontWeight: 900, color }}>{formatMacro(value, unit)}</p>
                </div>
              ))}
            </div>
          </SurfaceCard>
        )}

        <ActionButton onClick={addSelectedFood} disabled={Number(amount) <= 0}>Add food</ActionButton>
      </Screen>
    );
  }

  if (mode === "recipe") {
    const { totals, rawWeightG } = getRecipeTotals(recipeDraft.ingredients);
    const previewRecipe = createRecipeFood(recipeDraft);
    const perServing = previewRecipe ? getPerServing(previewRecipe) : null;
    return (
      <Screen>
        <ScreenHeader action={headerAction} title="New recipe" subtitle="Homemade meals, per-serving accurate" titleAs="h1" topPadding="calc(env(safe-area-inset-top, 0px) + 24px)" />

        <SurfaceCard>
          <Field label="Recipe name">
            <input value={recipeDraft.name} onChange={(event) => setRecipeDraft((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Chicken & rice prep" style={IS} />
          </Field>
        </SurfaceCard>

        <SurfaceCard>
          <p style={{ margin: "0 0 8px", fontSize: 11, color: colors.textMuted, fontWeight: 800 }}>INGREDIENTS (RAW WEIGHTS)</p>
          {recipeDraft.ingredients.map((ingredient, index) => (
            <div key={`${ingredient.name}-${index}`} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <p style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: colors.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ingredient.name}</p>
              <input
                type="number"
                inputMode="decimal"
                value={ingredient.grams}
                onChange={(event) => setRecipeDraft((current) => ({
                  ...current,
                  ingredients: current.ingredients.map((item, itemIndex) => (itemIndex === index ? { ...item, grams: event.target.value } : item)),
                }))}
                style={{ ...IS, width: 72, padding: "7px 8px", fontSize: 13 }}
              />
              <span style={{ ...typeScale.caption, color: colors.textMuted }}>g</span>
              <button
                type="button"
                aria-label={`Remove ${ingredient.name}`}
                onClick={() => setRecipeDraft((current) => ({ ...current, ingredients: current.ingredients.filter((_, itemIndex) => itemIndex !== index) }))}
                style={{ background: "none", border: "none", cursor: "pointer", color: colors.danger, fontSize: 15, padding: 2 }}
              >
                ✕
              </button>
            </div>
          ))}
          <input
            value={recipeQuery}
            onChange={(event) => setRecipeQuery(event.target.value)}
            placeholder="Search foods to add…"
            style={{ ...IS, marginTop: recipeDraft.ingredients.length ? 4 : 0 }}
          />
          {recipeResults.map((food) => (
            <button
              key={`ri-${food.source}-${food.id || food.food_id}`}
              type="button"
              onClick={() => addRecipeIngredient(food)}
              style={{ width: "100%", textAlign: "left", marginTop: 6, background: "rgba(255,255,255,0.04)", border: `1px solid ${colors.border}`, borderRadius: radii.sm, padding: "8px 10px", color: colors.textSecondary, fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              + {getFoodDisplayName(food)} <span style={{ color: colors.textMuted, fontWeight: 600 }}>({formatPer100(food.calories_per_100g, "kcal")}/100g)</span>
            </button>
          ))}
        </SurfaceCard>

        <SurfaceCard>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label={`Cooked weight (g)${rawWeightG ? ` · raw ${Math.round(rawWeightG)}g` : ""}`}>
              <input type="number" inputMode="decimal" value={recipeDraft.cookedWeightG} placeholder={rawWeightG ? String(Math.round(rawWeightG)) : "0"} onChange={(event) => setRecipeDraft((current) => ({ ...current, cookedWeightG: event.target.value }))} style={IS} />
            </Field>
            <Field label="Servings">
              <input type="number" inputMode="numeric" min="1" value={recipeDraft.servings} onChange={(event) => setRecipeDraft((current) => ({ ...current, servings: event.target.value }))} style={IS} />
            </Field>
          </div>
          <p style={{ margin: "8px 0 0", ...typeScale.caption, color: colors.textMuted, lineHeight: 1.5 }}>
            Weigh the finished dish — cooking changes weight but not nutrition. Leave blank to use the raw total.
          </p>
        </SurfaceCard>

        {perServing && (
          <SurfaceCard style={{ borderColor: "rgba(246,183,60,0.3)", background: "rgba(246,183,60,0.05)" }}>
            <p style={{ margin: "0 0 8px", ...typeScale.overline, color: colors.warning, textTransform: "uppercase" }}>Per serving ({perServing.grams}g)</p>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: colors.textPrimary }}>
              {perServing.calories} kcal · {perServing.protein}g protein · {perServing.carbs}g carbs · {perServing.fat}g fat
            </p>
            <p style={{ margin: "6px 0 0", ...typeScale.caption, color: colors.textMuted }}>
              Whole recipe: {Math.round(totals.calories)} kcal across {recipeDraft.ingredients.length} ingredient{recipeDraft.ingredients.length === 1 ? "" : "s"}.
            </p>
          </SurfaceCard>
        )}

        <ActionButton onClick={saveRecipe} disabled={!previewRecipe}>Save recipe</ActionButton>
      </Screen>
    );
  }

  if (mode === "custom") {
    return (
      <Screen>
        <ScreenHeader action={headerAction} title="Custom food" subtitle={fd(selectedDate)} titleAs="h1" topPadding="calc(env(safe-area-inset-top, 0px) + 24px)" />
        <SurfaceCard>
          <div style={{ display: "grid", gap: 12 }}>
            <Field label="Food name">
              <input value={customDraft.name} onChange={(event) => setCustomDraft((current) => ({ ...current, name: event.target.value }))} style={IS} />
            </Field>
            <Field label="Brand (optional)">
              <input value={customDraft.brand} onChange={(event) => setCustomDraft((current) => ({ ...current, brand: event.target.value }))} style={IS} />
            </Field>
            <Field label="Serving size (g)">
              <input type="number" inputMode="decimal" value={customDraft.servingSize} onChange={(event) => setCustomDraft((current) => ({ ...current, servingSize: event.target.value }))} style={IS} />
            </Field>
          </div>
        </SurfaceCard>
        <SurfaceCard>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            {[
              ["calories", "Calories"],
              ["protein", "Protein (g)"],
              ["carbs", "Carbs (g)"],
              ["fat", "Fat (g)"],
              ["sugar", "Sugar (g)"],
              ["fibre", "Fibre (g)"],
              ["salt", "Salt (g)"],
            ].map(([key, label]) => (
              <Field key={key} label={label}>
                <input type="number" inputMode="decimal" value={customDraft[key]} onChange={(event) => setCustomDraft((current) => ({ ...current, [key]: event.target.value }))} style={IS} />
              </Field>
            ))}
          </div>
        </SurfaceCard>
        <ActionButton onClick={saveCustomFood} disabled={!customDraft.name.trim() || Number(customDraft.servingSize) <= 0}>Save custom food</ActionButton>
      </Screen>
    );
  }

  if (mode === "quick") {
    return (
      <Screen>
        <ScreenHeader action={headerAction} title="Quick add" subtitle={fd(selectedDate)} titleAs="h1" topPadding="calc(env(safe-area-inset-top, 0px) + 24px)" />
        <SurfaceCard>
          <div style={{ display: "grid", gap: 12 }}>
            <Field label="Name (optional)">
              <input value={quickDraft.name} onChange={(event) => setQuickDraft((current) => ({ ...current, name: event.target.value }))} style={IS} />
            </Field>
            <Field label="Meal">
              <MealTabs value={quickDraft.mealType} onChange={(value) => setQuickDraft((current) => ({ ...current, mealType: value }))} />
            </Field>
          </div>
        </SurfaceCard>
        <SurfaceCard>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            {[
              ["calories", "Calories"],
              ["protein", "Protein (g)"],
              ["carbs", "Carbs (g)"],
              ["fat", "Fat (g)"],
            ].map(([key, label]) => (
              <Field key={key} label={label}>
                <input type="number" inputMode="decimal" value={quickDraft[key]} onChange={(event) => setQuickDraft((current) => ({ ...current, [key]: event.target.value }))} style={IS} />
              </Field>
            ))}
          </div>
        </SurfaceCard>
        <ActionButton onClick={addQuickLog} disabled={!quickDraft.calories && !quickDraft.protein && !quickDraft.carbs && !quickDraft.fat}>Add entry</ActionButton>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader action={headerAction} title="Nutrition" subtitle={`${Math.round(totals.calories).toLocaleString()} / ${targets.calorieTarget ? targets.calorieTarget.toLocaleString() : "-"} kcal`} titleAs="h1" topPadding="calc(env(safe-area-inset-top, 0px) + 24px)" trailing={onOpenProfile && <Avatar profile={app.profile} size={40} radius={13} fontSize={15} onClick={onOpenProfile} />} />
      <DateSwitcher selectedDate={selectedDate} onChange={setSelectedDate} />
      <SummaryCard totals={totals} targets={targets} />
      <WeeklyCard summary={weeklySummary} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "14px 0" }}>
        <ActionButton compact onClick={() => setMode("search")}>Add food</ActionButton>
        <ActionButton compact tone="secondary" onClick={openQuickAdd}>Quick add</ActionButton>
      </div>
      <ActionButton compact tone="secondary" onClick={copyYesterday} disabled={!logs.some((entry) => entry.date === shiftDate(selectedDate, -1))} style={{ marginBottom: 14 }}>
        Copy yesterday
      </ActionButton>

      {saveMealDraft && (
        <SurfaceCard style={{ borderColor: "rgba(61,220,151,0.3)", background: "rgba(61,220,151,0.07)" }}>
          <Field label="Meal name">
            <input value={saveMealDraft.name} onChange={(event) => setSaveMealDraft((current) => ({ ...current, name: event.target.value }))} style={IS} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
            <ActionButton compact onClick={confirmSaveMeal} color={colors.success}>Save meal</ActionButton>
            <ActionButton compact tone="secondary" onClick={() => setSaveMealDraft(null)}>Cancel</ActionButton>
          </div>
        </SurfaceCard>
      )}

      <p style={sectionLabelStyle}>Meals</p>
      {MEAL_TYPES.map((meal) => (
        <MealSection
          key={meal.id}
          meal={meal}
          entries={dateLogs.filter((entry) => entry.mealType === meal.id)}
          onDelete={deleteLog}
          onSaveMeal={saveMealFromType}
        />
      ))}
    </Screen>
  );
}

const sectionLabelStyle = {
  ...typeScale.overline,
  color: colors.textMuted,
  textTransform: "uppercase",
  margin: "18px 0 10px",
};
