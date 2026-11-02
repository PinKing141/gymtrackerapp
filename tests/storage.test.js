import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BACKUP_MAX_AGE_MS,
  DD,
  backupInfo,
  backupLoad,
  dbClear,
  dbLoad,
  dbReplace,
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

function sampleData(name, sessionCount = 1) {
  return withDefaults({
    ...DD(),
    sessions: Array.from({ length: sessionCount }, (_, index) => ({ id: index + 1, workoutId: "W1", date: "2026-07-20", sets: {} })),
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

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
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

describe("local backup snapshot", () => {
  const START = new Date("2026-11-02T09:00:00Z").getTime();
  const HOUR = 60 * 60 * 1000;
  const at = (ms) => vi.setSystemTime(new Date(ms));

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    at(START);
    setStorageScope("uidA");
  });

  it("routine saves leave the backup on an older snapshot", () => {
    dbSave(sampleData("First", 1));
    at(START + HOUR);
    dbSave(sampleData("Second", 2));
    dbSave(sampleData("Third", 3));

    expect(dbLoad().sessions).toHaveLength(3);
    expect(backupLoad().profile.firstName).toBe("First");
    expect(backupLoad().sessions).toHaveLength(1);
    expect(backupInfo()).toEqual({ takenAt: START, reason: "daily" });
  });

  it("rolls the previous main copy into the backup once the backup is a day old", () => {
    dbSave(sampleData("First", 1));
    at(START + HOUR);
    dbSave(sampleData("Second", 2));

    at(START + BACKUP_MAX_AGE_MS + HOUR);
    dbSave(sampleData("Third", 3));
    expect(backupLoad().profile.firstName).toBe("Second");
    expect(backupInfo()).toEqual({ takenAt: START + BACKUP_MAX_AGE_MS + HOUR, reason: "daily" });

    // The fresh snapshot then holds for another day.
    at(START + BACKUP_MAX_AGE_MS + 2 * HOUR);
    dbSave(sampleData("Fourth", 4));
    expect(backupLoad().profile.firstName).toBe("Second");
    expect(dbLoad().profile.firstName).toBe("Fourth");
  });

  it("an import parks the data it replaces in the backup", () => {
    dbSave(sampleData("Before", 1));
    at(START + HOUR);
    dbSave(sampleData("Edited", 2));

    at(START + 2 * HOUR);
    dbReplace(sampleData("Imported", 5), "import");

    expect(dbLoad().profile.firstName).toBe("Imported");
    expect(backupLoad().profile.firstName).toBe("Edited");
    expect(backupLoad().sessions).toHaveLength(2);
    expect(backupInfo()).toEqual({ takenAt: START + 2 * HOUR, reason: "import" });

    // The debounced save that follows an import must not overwrite that snapshot.
    dbSave(dbLoad());
    expect(backupLoad().profile.firstName).toBe("Edited");
  });

  it("restoring swaps the backup in, so a second restore undoes the first", () => {
    dbSave(sampleData("Before", 1));
    dbReplace(sampleData("Imported", 5), "import");

    const restored = dbRestoreBackup();
    expect(restored.profile.firstName).toBe("Before");
    expect(dbLoad().sessions).toHaveLength(1);
    expect(backupLoad().profile.firstName).toBe("Imported");
    expect(backupInfo().reason).toBe("restore");

    expect(dbRestoreBackup().profile.firstName).toBe("Imported");
    expect(dbLoad().sessions).toHaveLength(5);
  });

  it("falls back to the older snapshot when the main copy is corrupted", () => {
    dbSave(sampleData("First", 1));
    dbSave(sampleData("Second", 2));
    localStorage.setItem("orion-gym-v4:uidA", "{corrupted");

    const loaded = dbLoad();
    expect(loaded.profile.firstName).toBe("First");
    expect(JSON.parse(localStorage.getItem("orion-gym-v4:uidA")).profile.firstName).toBe("First");
  });

  it("never copies a corrupted main copy into the backup", () => {
    dbSave(sampleData("Good", 2));
    localStorage.setItem("orion-gym-v4:uidA", "{corrupted");

    at(START + BACKUP_MAX_AGE_MS + HOUR);
    dbSave(sampleData("Next", 3));
    expect(backupLoad().profile.firstName).toBe("Good");

    localStorage.setItem("orion-gym-v4:uidA", "{corrupted");
    dbReplace(sampleData("Imported", 4), "import");
    expect(backupLoad().profile.firstName).toBe("Good");
  });

  it("never replaces a backup holding training data with an empty copy", () => {
    dbSave(sampleData("Full", 3));
    dbSave(withDefaults({ ...DD(), profile: { firstName: "Empty", onboardingComplete: true } }));

    at(START + BACKUP_MAX_AGE_MS + HOUR);
    dbSave(withDefaults({ ...DD(), profile: { firstName: "Empty", onboardingComplete: true } }));
    dbReplace(sampleData("Imported", 1), "import");

    expect(backupLoad().profile.firstName).toBe("Full");
  });

  it("still saves the main copy when the backup can't be written", () => {
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
      if (String(key).includes("-backup")) throw new Error("QuotaExceededError");
      return setItem.call(this, key, value);
    });

    dbSave(sampleData("First", 1));
    dbReplace(sampleData("Imported", 2), "import");
    expect(dbLoad().profile.firstName).toBe("Imported");
  });

  it("keeps backups per account and clears the backup record with the data", () => {
    dbSave(sampleData("Favour", 1));
    setStorageScope("uidB");
    expect(backupLoad()).toBeNull();
    expect(backupInfo()).toBeNull();

    setStorageScope("uidA");
    expect(backupInfo()).not.toBeNull();
    dbClear();
    expect(backupLoad()).toBeNull();
    expect(backupInfo()).toBeNull();
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
