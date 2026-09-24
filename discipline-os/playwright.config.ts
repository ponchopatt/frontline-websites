import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Local Supabase must be running (npx supabase start). The app is built and served on 3100.
const chromium = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: true,
  workers: 3,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100",
    ...devices["iPhone 14"],
    browserName: "chromium",
    timezoneId: "Australia/Sydney",
    launchOptions: existsSync(chromium) ? { executablePath: chromium } : {},
    trace: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run start -- -p 3100 -H 127.0.0.1",
        url: "http://127.0.0.1:3100/login",
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
