import { defineConfig } from "@playwright/test";

// End-to-end journeys against the production build in local-only mode (no
// Firebase env), so they exercise onboarding, workouts, drafts and backups
// without external services.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4173",
    viewport: { width: 430, height: 900 },
    // A fake camera, so camera screens (ball test, auto shots) can open.
    permissions: ["camera"],
    launchOptions: {
      args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
      // Sandboxed environments can point at a pre-installed Chromium instead of
      // downloading one (e.g. PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium).
      ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}),
    },
  },
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
