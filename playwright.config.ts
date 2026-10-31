import { defineConfig } from "@playwright/test"
import type { BrowserTestOptions } from "./tests/browser/env"

export default defineConfig<BrowserTestOptions>({
  testDir: "./tests/browser",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "violentmonkey",
      use: { manager: "violentmonkey" },
    },
    {
      name: "tampermonkey",
      use: { manager: "tampermonkey" },
    },
  ],
})
