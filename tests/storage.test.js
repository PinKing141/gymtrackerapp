import { describe, expect, it, beforeEach } from "vitest";
import {
  DD,
  backupLoad,
  dbClear,
  dbLoad,
  dbRestoreBackup,
  dbSave,
  draftClear,
  draftLoad,
  draftSave,
  hasAnyUserData,
  isValidData,
  legacyDataClear,
  legacyImportCandidate,
  setStorageScope,
  withDefaults,
} from "../src/storage.js";

function sampleData(name) {
  return withDefaults({
    ...DD(),
    sessions: [{ id: 1, workoutId: "W1", date: "2026-07-20", sets: {} }],
    profile: { firstName: name, onboardingComplete: true },
  });
}

function sampleDraft(note) {
  return {
    workoutId: "W1",
    session: { workoutId: "W1", sets: {}, notes: note },
  };
}

beforeEach(() => {
  setStorageScope(null);
});

describe("per-account main data scoping", () => {
  it("stores app data under a per-uid key, isolated between accounts", () => {
    setStorageScope("uidA");
    dbSave(sampleData("Favour"));

    expect(localStorage.getItem("orion-gym-v4:uidA")).toBeTruthy();
    expect(localStorage.getItem("orion-gym-v4")).toBeNull();

    setStorageScope("uidB");
    const other = dbLoad();
    expect(other.sessions).toHaveLength(0);
    expect(other.profile.firstName).toBeFalsy();

    setStorageScope("uidA");
    expect(dbLoad().profile.firstName).toBe("Favour");
  });

  it("clears only the active account's data", () => {
    setStorageScope("uidA");
    dbSave(sampleData("Favour"));
    setStorageScope("uidB");
    dbSave(sampleData("Sam"));

    dbClear();
    expect(dbLoad().sessions).toHaveLength(0);

    setStorageScope("uidA");
    expect(dbLoad().profile.firstName).toBe("Favour");
  });

  it("restores from the scoped backup when the main copy is corrupted", () => {
    setStorageScope("uidA");
    dbSave(sampleData("Favour"));
    localStorage.setItem("orion-gym-v4:uidA", "{corrupted");

    const restored = dbLoad();
    expect(restored.profile.firstName).toBe("Favour");
  });

  it("supports explicit backup preview and restore", () => {
    setStorageScope("uidA");
    dbSave(sampleData("Favour"));

    expect(backupLoad()?.profile?.firstName).toBe("Favour");
    localStorage.removeItem("orion-gym-v4:uidA");
    expect(dbRestoreBackup()?.profile?.firstName).toBe("Favour");
    expect(dbLoad().profile.firstName).toBe("Favour");
  });
});

describe("per-account workout drafts", () => {
  it("stores drafts under a per-uid key, isolated between accounts", () => {
    setStorageScope("uidA");
    draftSave(sampleDraft("A's session"));

    expect(localStorage.getItem("orion-gym-v4-draft:uidA")).toBeTruthy();
    expect(localStorage.getItem("orion-gym-v4-draft")).toBeNull();

    setStorageScope("uidB");
    expect(draftLoad()).toBeNull();

    draftClear();
    setStorageScope("uidA");
    expect(draftLoad()?.session?.notes).toBe("A's session");
  });

  it("uses the device-level key in local-only mode (no scope)", () => {
    draftSave(sampleDraft("device session"));
    expect(localStorage.getItem("orion-gym-v4-draft")).toBeTruthy();
    expect(draftLoad()?.session?.notes).toBe("device session");
  });

  it("rejects malformed draft payloads", () => {
    expect(draftSave({ nonsense: true })).toBeNull();
    expect(draftLoad()).toBeNull();
  });
});

describe("legacy (pre-scoping) device data", () => {
  it("is never returned by scoped loads, but is offered for explicit import", () => {
    localStorage.setItem("orion-gym-v4", JSON.stringify(sampleData("OldFavour")));

    setStorageScope("uidNew");
    expect(dbLoad().profile.firstName).toBeFalsy();

    const candidate = legacyImportCandidate();
    expect(candidate?.profile?.firstName).toBe("OldFavour");
  });

  it("ignores empty legacy defaults (nothing worth importing)", () => {
    localStorage.setItem("orion-gym-v4", JSON.stringify(DD()));
    expect(legacyImportCandidate()).toBeNull();
  });

  it("can be cleared after import", () => {
    localStorage.setItem("orion-gym-v4", JSON.stringify(sampleData("OldFavour")));
    legacyDataClear();
    expect(legacyImportCandidate()).toBeNull();
  });
});

describe("data validation", () => {
  it("accepts default data and rejects junk", () => {
    expect(isValidData(DD())).toBe(true);
    expect(isValidData(null)).toBeFalsy();
    expect(isValidData({ sessions: "nope" })).toBeFalsy();
  });

  it("detects whether an account has any real user data", () => {
    expect(hasAnyUserData(DD())).toBe(false);
    expect(hasAnyUserData(sampleData("Favour"))).toBe(true);
  });
});
