import { describe, expect, it } from "vitest";
import { addRecentSearch, removeRecentSearch } from "../src/services/nutrition/searchHistory.js";

describe("nutrition search history", () => {
  it("adds a new term to the front", () => {
    expect(addRecentSearch(["rice"], "chicken")).toEqual(["chicken", "rice"]);
  });

  it("de-duplicates case-insensitively and moves the term to the front", () => {
    expect(addRecentSearch(["Chicken", "rice"], "chicken")).toEqual(["chicken", "rice"]);
  });

  it("ignores blank or single-character terms", () => {
    expect(addRecentSearch(["rice"], "")).toEqual(["rice"]);
    expect(addRecentSearch(["rice"], "a")).toEqual(["rice"]);
    expect(addRecentSearch(["rice"], "  ")).toEqual(["rice"]);
  });

  it("caps the list at 8 entries", () => {
    const full = ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8"];
    expect(addRecentSearch(full, "new")).toEqual(["new", "a1", "a2", "a3", "a4", "a5", "a6", "a7"]);
  });

  it("removes a term regardless of case", () => {
    expect(removeRecentSearch(["Chicken", "rice"], "chicken")).toEqual(["rice"]);
  });

  it("tolerates a missing list", () => {
    expect(addRecentSearch(undefined, "chicken")).toEqual(["chicken"]);
    expect(removeRecentSearch(undefined, "chicken")).toEqual([]);
  });
});
