import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

vi.mock("../src/firebase.js", () => ({
  firebaseConfigured: true,
  auth: {},
  db: {},
}));

vi.mock("../src/services/firebaseAuth.js", () => ({
  consumeRecentSignup: vi.fn(() => false),
  deleteCurrentUser: vi.fn(() => Promise.resolve()),
  reauthenticateUser: vi.fn(() => Promise.resolve()),
  signOutUser: vi.fn(() => Promise.resolve()),
  waitForPendingRedirect: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("../src/services/firestoreSync.js", () => ({
  loadUserAppData: vi.fn(() => Promise.resolve(null)),
  saveUserAppData: vi.fn(() => Promise.resolve(true)),
  deleteUserAppData: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("../src/services/push.js", () => ({
  enablePush: vi.fn(() => Promise.resolve()),
  isPushConfigured: () => false,
}));

vi.mock("../src/services/sound.js", () => ({
  haptic: vi.fn(),
  playCue: vi.fn(),
  unlockAudio: vi.fn(),
}));

import { useAppState } from "../src/hooks/useAppState.js";
import { consumeRecentSignup } from "../src/services/firebaseAuth.js";
import { deleteUserAppData, loadUserAppData, saveUserAppData } from "../src/services/firestoreSync.js";
import { deleteCurrentUser } from "../src/services/firebaseAuth.js";
import { DD, setStorageScope, withDefaults } from "../src/storage.js";

const USER_A = { uid: "uidA", email: "a@example.com" };
const USER_B = { uid: "uidB", email: "b@example.com" };

function appData({ name, savedAt = Date.now(), sessions = [] }) {
  return withDefaults({
    ...DD(),
    sessions,
    profile: { firstName: name, name, onboardingComplete: true },
    meta: { lastSavedAt: savedAt, dataVersion: 7, lastSyncedAt: null },
  });
}

function seedAccount(uid, data) {
  localStorage.setItem(`orion-gym-v4:${uid}`, JSON.stringify(data));
}

async function renderBooted(user) {
  const hook = renderHook((props) => useAppState(props), { initialProps: user });
  await waitFor(() => expect(hook.result.current.booted).toBe(true));
  return hook;
}

beforeEach(() => {
  vi.clearAllMocks();
  setStorageScope(null);
  loadUserAppData.mockImplementation(() => Promise.resolve(null));
  consumeRecentSignup.mockImplementation(() => false);
});

describe("returning account boot", () => {
  it("boots from the account's own scoped cache and pushes it to the cloud", async () => {
    seedAccount("uidA", appData({ name: "Favour", sessions: [{ id: 1, workoutId: "W1", date: "2026-07-20", sets: {} }] }));

    const { result } = await renderBooted(USER_A);

    expect(result.current.app.profile.firstName).toBe("Favour");
    await waitFor(() => expect(saveUserAppData).toHaveBeenCalledWith("uidA", expect.objectContaining({
      profile: expect.objectContaining({ firstName: "Favour" }),
    })));
  });

  it("prefers the cloud copy when it is newer than the local cache", async () => {
    seedAccount("uidA", appData({ name: "LocalOld", savedAt: 1000 }));
    loadUserAppData.mockImplementation(() => Promise.resolve({
      appData: appData({ name: "CloudNew", savedAt: 2000 }),
    }));

    const { result } = await renderBooted(USER_A);

    // Local-first boot: the app is immediately usable with the local cache,
    // then reconciles with the cloud copy behind the scenes once it arrives.
    expect(result.current.app.profile.firstName).toBe("LocalOld");
    await waitFor(() => expect(result.current.app.profile.firstName).toBe("CloudNew"));
    // The winning copy is also written back to the scoped local cache.
    await waitFor(() => expect(JSON.parse(localStorage.getItem("orion-gym-v4:uidA")).profile.firstName).toBe("CloudNew"));
  });

  it("prefers the local cache when it is newer than the cloud copy", async () => {
    seedAccount("uidA", appData({ name: "LocalNew", savedAt: 2000 }));
    loadUserAppData.mockImplementation(() => Promise.resolve({
      appData: appData({ name: "CloudOld", savedAt: 1000 }),
    }));

    const { result } = await renderBooted(USER_A);

    expect(result.current.app.profile.firstName).toBe("LocalNew");
    await waitFor(() => expect(saveUserAppData).toHaveBeenCalledWith("uidA", expect.objectContaining({
      profile: expect.objectContaining({ firstName: "LocalNew" }),
    })));
  });
});

describe("fresh signups", () => {
  it("boots blank without a cloud read and offers legacy data as an explicit import", async () => {
    localStorage.setItem("orion-gym-v4", JSON.stringify(appData({ name: "OldFavour" })));
    consumeRecentSignup.mockImplementation((uid) => uid === "uidNew");

    const { result } = await renderBooted({ uid: "uidNew", email: "new@example.com" });

    // Local-first boot: booted flips true immediately, and the fresh-signup
    // check (which decides the legacy prompt) resolves shortly after.
    await waitFor(() => expect(result.current.legacyPrompt).toBeTruthy());
    expect(loadUserAppData).not.toHaveBeenCalled();
    expect(result.current.app.profile.onboardingComplete).toBeFalsy();
    expect(result.current.legacyPrompt?.name).toBe("OldFavour");
  });

  it("adopts legacy data only on explicit import, then clears the legacy copy", async () => {
    localStorage.setItem("orion-gym-v4", JSON.stringify(appData({ name: "OldFavour" })));
    consumeRecentSignup.mockImplementation((uid) => uid === "uidNew");

    const { result } = await renderBooted({ uid: "uidNew", email: "new@example.com" });
    await waitFor(() => expect(result.current.legacyPrompt).toBeTruthy());
    act(() => result.current.actions.importLegacyData());

    expect(result.current.app.profile.firstName).toBe("OldFavour");
    expect(result.current.legacyPrompt).toBeNull();
    expect(localStorage.getItem("orion-gym-v4")).toBeNull();
  });

  it("starting fresh dismisses the prompt without touching the legacy copy", async () => {
    localStorage.setItem("orion-gym-v4", JSON.stringify(appData({ name: "OldFavour" })));
    consumeRecentSignup.mockImplementation((uid) => uid === "uidNew");

    const { result } = await renderBooted({ uid: "uidNew", email: "new@example.com" });
    await waitFor(() => expect(result.current.legacyPrompt).toBeTruthy());
    act(() => result.current.actions.dismissLegacyData());

    expect(result.current.legacyPrompt).toBeNull();
    expect(result.current.app.profile.firstName).toBeFalsy();
    expect(localStorage.getItem("orion-gym-v4")).not.toBeNull();
  });
});

describe("account switching", () => {
  it("never shows one account's data or drafts to another, and restores them on return", async () => {
    const hook = await renderBooted(USER_A);

    // Account A builds a preset and starts a workout.
    act(() => hook.result.current.actions.saveWorkoutPreset({ title: "Row Day", performance: [{ name: "Row", sets: 3 }] }));
    const presetId = hook.result.current.app.workoutPresets[0].id;
    act(() => hook.result.current.actions.startWorkout(presetId));

    expect(hook.result.current.session).toBeTruthy();
    expect(hook.result.current.view).toBe("log");

    // The unfinished workout autosaves under A's scoped draft key.
    await waitFor(() => expect(localStorage.getItem("orion-gym-v4-draft:uidA")).toBeTruthy());

    // A signs out mid-workout: in-memory session state is wiped.
    hook.rerender(null);
    expect(hook.result.current.session).toBeNull();
    expect(hook.result.current.workoutId).toBeNull();
    expect(hook.result.current.view).toBe("home");

    // B signs in on the same device: no session, no draft, no presets from A.
    hook.rerender(USER_B);
    await waitFor(() => expect(hook.result.current.booted).toBe(true));
    expect(hook.result.current.session).toBeNull();
    expect(hook.result.current.app.workoutPresets).toHaveLength(0);
    expect(hook.result.current.app.profile.firstName).toBeFalsy();

    // A returns: their unfinished workout is restored from their own draft.
    hook.rerender(null);
    hook.rerender(USER_A);
    await waitFor(() => expect(hook.result.current.booted).toBe(true));
    expect(hook.result.current.session).toBeTruthy();
    expect(hook.result.current.view).toBe("log");
    expect(hook.result.current.sessionNotice).toMatch(/draft restored/i);
    expect(hook.result.current.app.workoutPresets[0].title).toBe("Row Day");
  });
});

describe("account deletion", () => {
  it("deletes cloud data, local scoped data, then the auth user", async () => {
    seedAccount("uidA", appData({ name: "Favour" }));
    const { result } = await renderBooted(USER_A);

    await act(() => result.current.actions.deleteAccountEverywhere("password123"));

    expect(deleteUserAppData).toHaveBeenCalledWith("uidA");
    expect(deleteCurrentUser).toHaveBeenCalled();
    expect(localStorage.getItem("orion-gym-v4:uidA")).toBeNull();
    expect(localStorage.getItem("orion-gym-v4-draft:uidA")).toBeNull();
  });
});
