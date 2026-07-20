import { describe, expect, it } from "vitest";
import {
  createEmptySet,
  createWorkoutSnapshot,
  getDefaultWorkoutPresets,
  getWorkoutById,
  normalizeWorkoutPreset,
  normalizeWorkoutPresetList,
} from "../src/workouts.js";

describe("workout presets", () => {
  it("ships default presets", () => {
    const presets = getDefaultWorkoutPresets();
    expect(presets.length).toBeGreaterThan(0);
    expect(presets[0].id).toBeTruthy();
  });

  it("normalizes a custom preset with sane fallbacks", () => {
    const preset = normalizeWorkoutPreset({
      title: "Leg Day",
      performance: [{ name: "Squat", sets: 5 }],
      source: "custom",
    });
    expect(preset.title).toBe("Leg Day");
    expect(preset.performance[0].sets).toBe(5);
    expect(preset.performance[0].name).toBe("Squat");
    expect(preset.performance[0].reps).toBe("10");
  });

  it("normalizes malformed entries in a list to safe defaults", () => {
    const list = normalizeWorkoutPresetList(["junk", { title: "Ok", performance: [{ name: "Row" }] }]);
    expect(list).toHaveLength(2);
    expect(list.every((preset) => preset && typeof preset.title === "string")).toBe(true);
    expect(normalizeWorkoutPresetList("not-an-array")).toEqual([]);
  });

  it("resolves workouts by id, including custom presets", () => {
    const custom = normalizeWorkoutPreset({ id: "custom-abc", title: "Custom", performance: [{ name: "Curl" }], source: "custom" });
    const found = getWorkoutById("custom-abc", [custom]);
    expect(found?.title).toBe("Custom");
  });

  it("snapshots a workout so history survives preset edits", () => {
    const preset = normalizeWorkoutPreset({ title: "Push", performance: [{ name: "Bench", sets: 3 }] });
    const snapshot = createWorkoutSnapshot(preset);
    expect(snapshot.title).toBe("Push");
    expect(snapshot.performance).toHaveLength(1);
    // Mutating the preset afterwards must not affect the snapshot.
    preset.performance[0].name = "Changed";
    expect(snapshot.performance[0].name).toBe("Bench");
  });

  it("creates empty sets matching the exercise shape", () => {
    const set = createEmptySet({ name: "Bench", sets: 3, reps: "5" });
    expect(set).toBeTruthy();
    expect(typeof set).toBe("object");
  });
});
