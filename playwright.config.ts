import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The end-to-end tests run their own servers on their own ports, with a database
// in the system temp folder, so they never touch your data.
const API_PORT = "8010";
const WEB_PORT = "5180";
export const E2E_DB_PATH = join(tmpdir(), "accountable-e2e", "accountable.db");

const env = {
  ACCOUNTABLE_DB_PATH: E2E_DB_PATH,
  ACCOUNTABLE_API_PORT: API_PORT,
  ACCOUNTABLE_WEB_PORT: WEB_PORT,
};

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    channel: "chrome",
    headless: true,
    viewport: { width: 1440, height: 900 },
    timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: `uv run uvicorn backend.app.main:app --host 127.0.0.1 --port ${API_PORT} --log-level warning`,
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      env,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `node ../node_modules/vite/bin/vite.js`,
      cwd: "frontend",
      url: `http://localhost:${WEB_PORT}/`,
      env,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
