import type { Locator, Page } from "@playwright/test";
import { dragTo, expect, pick, row, test, unique } from "./fixtures";

const column = (page: Page, name: string) => page.getByRole("region", { name: `${name} column` });
const card = (page: Page, id: number) => page.locator(`[data-deal-id="${id}"]`);
const money = (text: string | null) => Number((text ?? "").replace(/[^0-9]/g, ""));

async function center(locator: Locator) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Drag a card onto the top of a column's list. */
async function dragToColumn(page: Page, from: Locator, to: Locator) {
  const list = to.locator(".col-list");
  const box = (await list.boundingBox())!;
  await dragTo(page, await center(from), { x: box.x + box.width / 2, y: box.y + 12 });
}

async function today(page: Page): Promise<string> {
  const response = await page.request.get("/api/health");
  return (await response.json()).today;
}

function shortDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function longDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

test("dragging a deal to another column changes its stage and probability, on the board and in the deals table", async ({
  page,
  api,
}) => {
  const deal = await api.deal({ name: unique("Drag me across"), stage: "new" });
  await page.goto("/pipeline");
  await expect(column(page, "New").locator(card(page, deal.id))).toBeVisible();

  await dragToColumn(page, card(page, deal.id), column(page, "Qualified"));
  await expect(column(page, "Qualified").locator(card(page, deal.id))).toContainText("25%");
  await expect(page.getByText(`${deal.name} moved to Qualified.`, { exact: true })).toBeVisible();

  await page.goto("/deals");
  await page.getByRole("searchbox", { name: "Search Deals" }).fill(deal.name);
  await expect(row(page, deal.name)).toContainText("Qualified");
  await expect(row(page, deal.name)).toContainText("25%");
});

test("a card dragged within its column stays where it was dropped after a refresh", async ({ page, api }) => {
  // Each new deal goes to the top, so the column starts c, b, a.
  const a = await api.deal({ name: unique("Order A"), stage: "negotiation" });
  const b = await api.deal({ name: unique("Order B"), stage: "negotiation" });
  const c = await api.deal({ name: unique("Order C"), stage: "negotiation" });
  await page.goto("/pipeline");
  const ours = () =>
    column(page, "Negotiation")
      .locator("[data-deal-id]")
      .evaluateAll((els, ids) => els.map((e) => Number(e.getAttribute("data-deal-id"))).filter((id) => ids.includes(id)), [
        a.id,
        b.id,
        c.id,
      ]);
  expect(await ours()).toEqual([c.id, b.id, a.id]);

  // Drop the top card just below the third one.
  const target = (await card(page, a.id).boundingBox())!;
  await dragTo(page, await center(card(page, c.id)), { x: target.x + target.width / 2, y: target.y + target.height - 6 });
  await expect.poll(ours).toEqual([b.id, a.id, c.id]);

  await page.waitForLoadState("networkidle");
  await page.reload();
  await expect.poll(ours).toEqual([b.id, a.id, c.id]);
});

test("board and column totals change as soon as the card drops, before the server answers", async ({ page, api }) => {
  const deal = await api.deal({ name: unique("Totals mover"), stage: "new", value_cents: 1_234_000 });
  await page.goto("/pipeline");
  const boardOpen = page.getByTestId("board-open");
  const boardExpected = page.getByTestId("board-expected");
  const newTotal = column(page, "New").getByTestId("column-total");
  const proposalTotal = column(page, "Proposal").getByTestId("column-total");
  const proposalExpected = column(page, "Proposal").getByTestId("column-expected");

  const before = {
    open: money(await boardOpen.textContent()),
    expected: money(await boardExpected.textContent()),
    newTotal: money(await newTotal.textContent()),
    proposalTotal: money(await proposalTotal.textContent()),
    proposalExpected: money(await proposalExpected.textContent()),
  };

  // Hold the server's answer back, so only the optimistic update can explain the new figures.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/deals/*/move", async (route) => {
    await held;
    await route.continue();
  });

  await dragToColumn(page, card(page, deal.id), column(page, "Proposal"));
  await expect(column(page, "Proposal").locator(card(page, deal.id))).toBeVisible();
  await expect.poll(async () => money(await newTotal.textContent())).toBe(before.newTotal - 12_340);
  expect(money(await proposalTotal.textContent())).toBe(before.proposalTotal + 12_340);
  expect(money(await proposalExpected.textContent())).toBe(before.proposalExpected + 6_170);
  // Same open total; expected revenue goes from 10% to 50% of the value.
  expect(money(await boardOpen.textContent())).toBe(before.open);
  expect(money(await boardExpected.textContent())).toBe(before.expected - 1_234 + 6_170);

  release();
  await page.waitForLoadState("networkidle");
  await page.unroute("**/api/deals/*/move");
});

test("dragging to Won gives today's close date and drops the deal out of the open totals", async ({ page, api }) => {
  const deal = await api.deal({ name: unique("Signed today"), stage: "negotiation", value_cents: 2_000_000, close_date: "2031-06-30" });
  const day = await today(page);
  await page.goto("/pipeline");
  const openBefore = money(await page.getByTestId("board-open").textContent());
  const countBefore = money(await page.getByTestId("board-count").textContent());

  await dragToColumn(page, card(page, deal.id), column(page, "Won"));
  const won = column(page, "Won").locator(card(page, deal.id));
  await expect(won).toContainText(shortDate(day));
  await expect(won).toContainText("100%");
  await expect(page.getByText(`${deal.name} marked as won. Close date set to ${longDate(day)}.`, { exact: true })).toBeVisible();
  expect(money(await page.getByTestId("board-open").textContent())).toBe(openBefore - 20_000);
  expect(money(await page.getByTestId("board-count").textContent())).toBe(countBefore - 1);

  await page.waitForLoadState("networkidle");
  await page.reload();
  await expect(column(page, "Won").locator(card(page, deal.id))).toContainText(shortDate(day));
});

test("a deal added from a column starts in that column", async ({ page, api }) => {
  const contact = await api.contact({ name: unique("Column Contact") });
  const name = unique("From the column");
  await page.goto("/pipeline");
  await page.getByRole("button", { name: "Add a deal in Proposal" }).click();
  const form = page.getByRole("dialog", { name: "New deal" });
  await expect(form.getByLabel("Stage")).toHaveValue("proposal");
  await expect(form.getByLabel("Probability")).toHaveValue("50");
  await form.getByLabel("Name").fill(name);
  await pick(page, form, /^Main contact/, contact.name);
  await form.getByLabel("Value (USD)").fill("15000");
  await form.getByRole("button", { name: "Add deal" }).click();
  await expect(column(page, "Proposal").locator(".card").first()).toContainText(name);
});

test("late cards show Late", async ({ page, api }) => {
  const late = await api.deal({ name: unique("Running late"), stage: "proposal", close_date: "2024-02-02" });
  const onTime = await api.deal({ name: unique("On time"), stage: "proposal", close_date: "2031-02-02" });
  await page.goto("/pipeline");
  await expect(card(page, late.id)).toContainText("Late");
  await expect(card(page, onTime.id)).not.toContainText("Late");
});

test("a card can be moved with the keyboard, and Enter opens the deal", async ({ page, api }) => {
  const deal = await api.deal({ name: unique("Keyboard mover"), stage: "new" });
  await page.goto("/pipeline");
  await card(page, deal.id).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  await expect(column(page, "Qualified").locator(card(page, deal.id))).toBeVisible();
  await page.waitForLoadState("networkidle");

  await card(page, deal.id).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: deal.name })).toBeVisible();
  await expect(page.getByRole("group", { name: "Stage" }).getByRole("button", { name: "Qualified" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("clicking a card opens the deal", async ({ page, api }) => {
  const deal = await api.deal({ name: unique("Click me"), stage: "qualified" });
  await page.goto("/pipeline");
  await card(page, deal.id).click();
  await expect(page).toHaveURL(new RegExp(`/deals/${deal.id}$`));
});
