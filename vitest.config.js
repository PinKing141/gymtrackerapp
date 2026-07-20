import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.js"],
    include: ["tests/**/*.test.{js,jsx}"],
    // Playwright specs live in e2e/ and run via `npm run test:e2e`.
    exclude: ["e2e/**", "node_modules/**"],
  },
});
