import { expect, test } from "./fixtures";

test("the app opens on the dashboard, and every section shows sample data", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveClass(/active/);
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  await expect(page.getByText(/^Good (morning|afternoon|evening)\. Here's where sales stand on/)).toBeVisible();
  await expect(page.getByTestId("kpi-open")).not.toHaveText("$0");
  await expect(page.getByTestId("kpi-won")).not.toHaveText("$0");
  await expect(page.getByRole("region", { name: "Recent activity" }).getByRole("listitem")).toHaveCount(10);
  await expect(page.getByRole("group", { name: "Overdue" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Next 7 days" })).toBeVisible();

  await nav.getByRole("link", { name: "Pipeline" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Pipeline" })).toBeVisible();
  for (const stage of ["New", "Qualified", "Proposal", "Negotiation", "Won", "Lost"]) {
    await expect(page.getByRole("region", { name: `${stage} column` }).locator("[data-deal-id]").first()).toBeVisible();
  }

  for (const [label, title, count] of [
    ["Deals", "Deals", /^1–50 of \d+$/],
    ["Contacts", "Contacts", /^1–50 of \d+$/],
    ["Orgs", "Organizations", /^1–\d+ of \d+$/],
  ] as const) {
    await nav.getByRole("link", { name: label }).click();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByText(count)).toBeVisible();
  }

  // Every page can be refreshed or bookmarked
  await page.goto("/contacts");
  await expect(page.getByRole("heading", { level: 1, name: "Contacts" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: "Organizations" })).toBeVisible();
});

test("an unknown address shows a page that leads back", async ({ page }) => {
  await page.goto("/nowhere");
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  await page.getByRole("link", { name: "Go to the dashboard" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
});
