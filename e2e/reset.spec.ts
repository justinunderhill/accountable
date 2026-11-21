import { execFileSync } from "node:child_process";
import { E2E_DB_PATH } from "../playwright.config";
import { expect, row, test, unique } from "./fixtures";

test("running the seed brings back the sample data", async ({ page, api }) => {
  const org = await api.org({ name: unique("Made before reset") });
  await page.goto("/organizations");
  await page.getByRole("searchbox", { name: "Search Organizations" }).fill(org.name);
  await expect(row(page, org.name)).toBeVisible();

  // The same command as `npm run seed`, pointed at the test database, while the app keeps running.
  execFileSync("uv", ["run", "python", "-m", "backend.app.seed"], {
    env: { ...process.env, ACCOUNTABLE_DB_PATH: E2E_DB_PATH },
    stdio: "pipe",
  });

  await page.reload();
  await page.getByRole("searchbox", { name: "Search Organizations" }).fill(org.name);
  await expect(page.getByText(`Nothing matches "${org.name}".`)).toBeVisible();
  await page.getByRole("searchbox", { name: "Search Organizations" }).fill("");
  await expect(page.getByText("1–25 of 25")).toBeVisible();
  await expect(row(page, "Cobalt Bank")).toBeVisible();
});
