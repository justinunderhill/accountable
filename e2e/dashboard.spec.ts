import type { Page } from "@playwright/test";
import { expect, test, unique, type Api } from "./fixtures";

interface Deal {
  stage: string;
  value_cents: number;
  expected_cents: number;
  close_date: string;
}

const money = (text: string | null) => Number((text ?? "").replace(/[^0-9]/g, ""));
const dollars = (cents: number) => Math.round(cents / 100);
const OPEN = ["new", "qualified", "proposal", "negotiation"];

async function today(api: Api): Promise<string> {
  return (await api.get<{ today: string }>("/health")).today;
}

function lastTwelveMonths(day: string): Set<string> {
  const [y, m] = day.split("-").map(Number);
  const months = new Set<string>();
  for (let back = 0; back < 12; back++) {
    const d = new Date(y, m - 1 - back, 1);
    months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

async function figures(page: Page) {
  return {
    open: money(await page.getByTestId("kpi-open").textContent()),
    expected: money(await page.getByTestId("kpi-expected").textContent()),
    won: money(await page.getByTestId("kpi-won").textContent()),
    wonMonth: money(await page.getByTestId("kpi-won-month").textContent()),
    comingUp: Number(await page.getByTestId("coming-up-count").textContent()),
    overdue: Number(await page.getByTestId("overdue-count").textContent()),
  };
}

test("the figures match the deals", async ({ page, api }) => {
  const deals = await api.get<Deal[]>("/deals");
  const day = await today(api);
  const open = deals.filter((d) => OPEN.includes(d.stage));
  const months = lastTwelveMonths(day);
  const won = deals.filter((d) => d.stage === "won" && months.has(d.close_date.slice(0, 7)));
  const thisMonth = won.filter((d) => d.close_date.slice(0, 7) === day.slice(0, 7));

  await page.goto("/");
  const shown = await figures(page);
  expect(shown.open).toBe(dollars(open.reduce((s, d) => s + d.value_cents, 0)));
  expect(shown.expected).toBe(dollars(open.reduce((s, d) => s + d.expected_cents, 0)));
  expect(shown.won).toBe(dollars(won.reduce((s, d) => s + d.value_cents, 0)));
  expect(shown.wonMonth).toBe(dollars(thisMonth.reduce((s, d) => s + d.value_cents, 0)));
  await expect(page.getByText(`${open.length} open deals across four stages`)).toBeVisible();
  await expect(page.getByTestId("kpi-won-count")).toHaveText(`${won.length} deals`);

  // The board says the same
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Pipeline" }).click();
  await expect(page.getByTestId("board-open")).toHaveText(`$${shown.open.toLocaleString("en-US")}`);
  await expect(page.getByTestId("board-expected")).toHaveText(`$${shown.expected.toLocaleString("en-US")}`);
});

test("marking a deal won and adding a follow-up change the dashboard", async ({ page, api }) => {
  const day = await today(api);
  const contact = await api.contact({ name: unique("Dash Contact") });
  const deal = await api.deal({ name: unique("Dash win"), contact_id: contact.id, stage: "negotiation", value_cents: 4_200_000 });

  await page.goto("/");
  const before = await figures(page);

  // Win the deal from its page
  await page.goto(`/deals/${deal.id}`);
  await page.getByRole("group", { name: "Stage" }).getByRole("button", { name: "Won" }).click();
  await expect(page.getByText(/marked as won/).first()).toBeVisible();

  // Add a follow-up due in two days on the contact
  await page.goto(`/contacts/${contact.id}`);
  await page.getByRole("button", { name: "Log activity" }).click();
  const form = page.getByRole("dialog", { name: "Log activity" });
  const [y, m, d] = day.split("-").map(Number);
  const due = new Date(y, m - 1, d + 2);
  const dueIso = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
  await form.getByLabel("Description").fill("Send the signed order form");
  await form.getByLabel(/Follow-up date/).fill(dueIso);
  await form.getByRole("button", { name: "Log activity" }).click();
  await expect(form).toBeHidden();

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Dashboard" }).click();
  await expect.poll(async () => (await figures(page)).won).toBe(before.won + 42_000);
  const after = await figures(page);
  expect(after.wonMonth).toBe(before.wonMonth + 42_000);
  expect(after.open).toBe(before.open - 42_000);
  expect(after.expected).toBe(before.expected - 31_500);
  expect(after.comingUp).toBe(before.comingUp + 1);
  await expect(page.getByRole("region", { name: "Recent activity" })).toContainText("Moved from Negotiation to Won");
});

test("the line chart, bar chart, funnel and stage bar are all there, with tooltips on hover", async ({ page }) => {
  await page.goto("/");
  const tooltip = page.locator(".tt");

  await page.getByTestId("revenue-chart").locator(".recharts-surface").hover({ position: { x: 300, y: 120 } });
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText(/\$[\d,]+/);
  await expect(tooltip).toContainText(/deals? won/);

  await page.getByTestId("deals-chart").locator(".recharts-surface").hover({ position: { x: 150, y: 150 } });
  await expect(tooltip).toContainText(/\d+ deals? won/);

  const funnel = page.getByTestId("funnel-chart");
  for (const stage of ["New", "Qualified", "Proposal", "Negotiation", "Won"]) {
    await expect(funnel).toContainText(stage);
  }
  await funnel.locator(".recharts-bar-rectangle").first().hover();
  await expect(tooltip).toContainText("Reached New");
  await expect(tooltip).toContainText("100% of New");

  const stageBar = page.getByRole("region", { name: "Open pipeline by stage" });
  for (const stage of ["New", "Qualified", "Proposal", "Negotiation"]) {
    await expect(stageBar.getByRole("listitem").filter({ hasText: stage })).toBeVisible();
  }
  await page.getByTestId("stage-bar").locator(".recharts-bar-rectangle").first().hover();
  await expect(tooltip).toContainText("of open value");
});
