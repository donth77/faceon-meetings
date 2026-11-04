import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

import {
  ADMIN_EMAIL,
  assertTestDatabase,
  BASE_URL,
  E2E_PORT,
} from "./tests/e2e/support/env";

// The tests create users: refuse a production database before anything starts.
assertTestDatabase();

const CI = Boolean(process.env.CI);
const fixture = (name: string) => path.resolve("tests/fixtures", name);

/**
 * Browser tests (tests/e2e) against a production build: `pnpm build` first, then
 * `pnpm test:e2e` starts it. Chromium runs everything on every push; tests tagged
 * @nightly (heavier: Firefox, noise suppression) run in the nightly workflow.
 */
export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : 3,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: CI
    ? [["github"], ["list"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL: BASE_URL,
    locale: "en-US",
    timezoneId: "America/New_York",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      grepInvert: /@nightly/,
      use: {
        ...devices["Desktop Chrome"],
        permissions: ["camera", "microphone"],
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            `--use-file-for-fake-video-capture=${fixture("cam.y4m")}`,
            `--use-file-for-fake-audio-capture=${fixture("mic.wav")}`,
            "--autoplay-policy=no-user-gesture-required",
            // WebGL2 for backgrounds, in software where there's no GPU.
            "--enable-unsafe-swiftshader",
          ],
        },
      },
    },
    {
      name: "nightly-chromium",
      grep: /@nightly/,
      grepInvert: /@firefox/,
      use: {
        ...devices["Desktop Chrome"],
        permissions: ["camera", "microphone"],
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            `--use-file-for-fake-video-capture=${fixture("cam.y4m")}`,
            `--use-file-for-fake-audio-capture=${fixture("mic.wav")}`,
            "--autoplay-policy=no-user-gesture-required",
            "--enable-unsafe-swiftshader",
          ],
        },
      },
    },
    {
      name: "nightly-firefox",
      grep: /@firefox/,
      use: {
        ...devices["Desktop Firefox"],
        launchOptions: {
          firefoxUserPrefs: {
            "media.navigator.streams.fake": true,
            "media.navigator.permission.disabled": true,
          },
        },
      },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm start --port ${E2E_PORT}`,
        url: BASE_URL,
        reuseExistingServer: !CI,
        timeout: 120_000,
        env: {
          BETTER_AUTH_URL: BASE_URL,
          BETTER_AUTH_TRUSTED_ORIGINS: BASE_URL,
          // The tests' meetings shouldn't wait on other meetings in a shared dev database.
          MAX_CONCURRENT_MEETINGS:
            process.env.MAX_CONCURRENT_MEETINGS ?? "1000",
          // No email, OAuth apps or approved hosts, as in CI: the tests behave the same on
          // every machine, and nothing they do reaches a real inbox or account. (Blank
          // counts as unset.) The one admin is the test admin (support/env.ts), whose
          // account a test makes when it needs one.
          RESEND_API_KEY: "",
          GOOGLE_CLIENT_ID: "",
          GOOGLE_CLIENT_SECRET: "",
          GITHUB_CLIENT_ID: "",
          GITHUB_CLIENT_SECRET: "",
          ADMIN_EMAILS: ADMIN_EMAIL,
          HOST_ALLOWLIST: "",
        },
      },
});
