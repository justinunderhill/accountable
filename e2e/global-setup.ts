import { execFileSync } from "node:child_process";
import { E2E_DB_PATH } from "../playwright.config";

// Reset the test database to the sample data before the run.
export default function globalSetup() {
  execFileSync("uv", ["run", "python", "-m", "backend.app.seed"], {
    env: { ...process.env, ACCOUNTABLE_DB_PATH: E2E_DB_PATH },
    stdio: "inherit",
  });
}
