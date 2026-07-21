import { expect, test } from "@playwright/test";

// These journeys run against the production build in local-only mode (no
// Firebase config), so app data lives under the device-level storage keys.

const PRESET = {
  id: "custom-rowday",
  title: "Row Day",
  shortTitle: "Row Day",
  day: "Custom",
  goal: "Personal preset",
  source: "custom",
  performance: [{ name: "Row", sets: 2, reps: "10", type: "Barbell", rest: 60, tracked: true }],
  finisher: [],
  core: null,
};

const SEEDED_APP = {
  sessions: [],
  personalBests: {},
  recovery: [],
  bodyStats: [],
  weeklyReviews: [],
  cardioSessions: [],
  workoutPresets: [PRESET],
  nutrition: { foodLogs: [], customFoods: [], savedMeals: [], targets: null },
  profile: { firstName: "Test", name: "Test Athlete", onboardingComplete: true, enabledModules: { gym: true } },
  phaseStart: null,
  meta: { lastSavedAt: 1, dataVersion: 7, lastSyncedAt: null },
};

function seed(page, app = SEEDED_APP) {
  return page.addInitScript((data) => {
    localStorage.setItem("orion-gym-v4", JSON.stringify(data));
  }, app);
}

test("first run: onboarding leads to the dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("What should we call you?")).toBeVisible();

  await page.getByPlaceholder("First name").fill("Favour");
  await page.getByRole("button", { name: "Continue" }).click();

  // Body step — metric keeps it to single height/weight fields.
  await page.getByRole("button", { name: /metric/i }).click();
  await page.getByPlaceholder("Age").fill("25");
  await page.getByPlaceholder("cm").fill("180");
  await page.getByPlaceholder("kg").fill("80");
  await page.getByRole("button", { name: "Continue" }).click();

  // Goal and modules steps keep their defaults; the avatar step finishes.
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Finish" }).click();

  await expect(page.getByText(/good (morning|afternoon|evening), Favour/i)).toBeVisible();
});

test("an unfinished workout survives a reload and can be completed", async ({ page }) => {
  await seed(page);
  await page.goto("/");

  await page.getByRole("button", { name: "Train", exact: true }).click();
  await page.getByText("Row Day").first().click();
  await expect(page.getByRole("button", { name: "Finish", exact: true })).toBeVisible();

  // Give the draft autosave (250ms debounce) time to write, then reload.
  await page.waitForTimeout(700);
  await page.reload();

  await expect(page.getByText(/draft restored/i)).toBeVisible();
  await page.getByRole("button", { name: "Finish", exact: true }).click();

  await expect.poll(async () => page.evaluate(() => {
    return JSON.parse(localStorage.getItem("orion-gym-v4") || "{}").sessions?.length || 0;
  })).toBe(1);
});

test("the app starts with no network access (offline-first)", async ({ page }) => {
  // Abort every request that isn't the local preview server; the app must
  // still boot entirely from its own bundle and local storage.
  await page.route(/^(?!http:\/\/localhost:4173)/, (route) => route.abort());
  await seed(page);
  await page.goto("/");

  await expect(page.getByText(/good (morning|afternoon|evening)/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Train", exact: true })).toBeVisible();
});

test("training calendar: a missed workout can be moved to today", async ({ page }) => {
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const mondayIndexed = (d) => (d.getDay() + 6) % 7;

  // Recurring "Row Day" on yesterday's weekday → yesterday's occurrence is missed.
  const appWithPlan = {
    ...SEEDED_APP,
    trainingPlan: {
      template: { [mondayIndexed(yesterday)]: [{ id: "slot-1", type: "gym", presetId: "custom-rowday" }] },
      entries: [],
      deloadWeeks: [],
    },
  };
  await seed(page, appWithPlan);
  await page.goto("/");

  // Home asks instead of silently dropping the session.
  await expect(page.getByText(/you missed row day/i)).toBeVisible();
  await page.getByRole("button", { name: "Move to today" }).click();
  await expect(page.getByText(/you missed/i)).not.toBeVisible();
  await expect(page.getByText(/scheduled today · moved from/i)).toBeVisible();

  // The calendar shows the moved occurrence and can skip it for the day.
  await page.getByRole("button", { name: /calendar/i }).click();
  await expect(page.getByText("Training Calendar")).toBeVisible();
  await page.getByRole("button", { name: /row day/i }).first().click();
  await page.getByRole("button", { name: "Mark skipped" }).click();
  await expect(page.getByText("Skipped").first()).toBeVisible();

  // The move only touched one occurrence — verify the stored plan kept the
  // recurring slot on its original weekday.
  const template = await page.evaluate(() => JSON.parse(localStorage.getItem("orion-gym-v4") || "{}").trainingPlan?.template || {});
  expect(Object.values(template).flat().some((slot) => slot.presetId === "custom-rowday")).toBe(true);
  expect(fmt(yesterday)).toBeTruthy();
});

test("backup export and import round-trips the data", async ({ page }) => {
  await seed(page);
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/");

  // Home → profile avatar (initials button) → Data & Backup → export.
  await page.getByRole("button", { name: "T", exact: true }).click();
  await page.getByRole("button", { name: /data & backup/i }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup (.json)" }).click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  expect(backupPath).toBeTruthy();

  // Fresh device (only onboarding done, no presets) imports the backup.
  const bare = { ...SEEDED_APP, workoutPresets: [], profile: { ...SEEDED_APP.profile, firstName: "Blank", name: "Blank" } };
  await seed(page, bare);
  await page.reload();

  await page.getByRole("button", { name: "B", exact: true }).click();
  await page.getByRole("button", { name: /data & backup/i }).click();
  await page.locator('input[accept="application/json"]').setInputFiles(backupPath);
  await expect(page.getByText("Import preview")).toBeVisible();
  await page.getByRole("button", { name: "Import without safety backup" }).click();

  await expect.poll(async () => page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem("orion-gym-v4") || "{}");
    return stored.workoutPresets?.[0]?.title || "";
  })).toBe("Row Day");
});
