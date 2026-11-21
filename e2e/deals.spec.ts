import { expect, pick, row, test, unique } from "./fixtures";

test("add, find, sort and edit a deal, and the change is kept", async ({ page, api }) => {
  const org = await api.org({ name: unique("Kestrel Co") });
  const contact = await api.contact({ name: unique("Tom Okafor"), organization_id: org.id });
  const name = unique("Shop floor dashboards");

  await page.goto("/deals");
  await page.getByRole("button", { name: "New deal" }).click();
  const form = page.getByRole("dialog", { name: "New deal" });
  await form.getByLabel("Name").fill(name);
  await pick(page, form, /^Main contact/, contact.name);
  // Picking the contact fills in their organization
  await expect(form.getByRole("combobox", { name: /^Organization/ })).toHaveText(org.name);
  await form.getByLabel("Stage").selectOption("proposal");
  await expect(form.getByLabel("Probability")).toHaveValue("50");
  await form.getByLabel("Value (USD)").fill("32000");
  await form.getByLabel("Close date").fill("2030-03-01");
  await form.getByRole("button", { name: "Add deal" }).click();
  await expect(page.getByText("Deal saved", { exact: true })).toBeVisible();

  const search = page.getByRole("searchbox", { name: "Search Deals" });
  await search.fill(name);
  const created = row(page, name);
  await expect(created).toContainText(org.name);
  await expect(created).toContainText(contact.name);
  await expect(created).toContainText("Proposal");
  await expect(created).toContainText("$32,000");
  await expect(created).toContainText("$16,000");
  await expect(created).toContainText("Mar 1, 2030");

  // Sort by value, largest first on the second click
  await search.fill("");
  await page.getByRole("button", { name: "Value (USD)" }).click();
  await page.getByRole("button", { name: "Value (USD)" }).click();
  await expect(page.getByRole("columnheader", { name: "Value (USD)" })).toHaveAttribute("aria-sort", "descending");
  const values = await page.locator("tbody tr td:nth-child(5)").allTextContents();
  const numbers = values.map((v) => Number(v.replace(/\D/g, "")));
  expect(numbers).toEqual([...numbers].sort((a, b) => b - a));

  // Edit
  await search.fill(name);
  await page.getByRole("button", { name: `Edit ${name}` }).click();
  const edit = page.getByRole("dialog", { name: "Edit deal" });
  await edit.getByLabel("Value (USD)").fill("40000");
  await edit.getByLabel("Probability").fill("60");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(row(page, name)).toContainText("$40,000");
  await expect(row(page, name)).toContainText("60%*");

  await page.reload();
  await page.getByRole("searchbox", { name: "Search Deals" }).fill(name);
  await expect(row(page, name)).toContainText("$40,000");
  await expect(row(page, name)).toContainText("$24,000");
});

test("a late deal stands out in the table", async ({ page, api }) => {
  const deal = await api.deal({ name: unique("Overdue rollout"), close_date: "2024-01-10", stage: "proposal" });
  await page.goto("/deals");
  await page.getByRole("searchbox", { name: "Search Deals" }).fill(deal.name);
  await expect(row(page, deal.name)).toContainText("Late");
});

test("deleting a deal says its activities and stage history go too", async ({ page, api }) => {
  const deal = await api.deal({ name: unique("Short lived") });
  await api.activity({ deal_id: deal.id });
  await api.move(deal.id, "qualified");

  await page.goto("/deals");
  await page.getByRole("searchbox", { name: "Search Deals" }).fill(deal.name);
  await page.getByRole("button", { name: `Delete ${deal.name}` }).click();
  const dialog = page.getByRole("dialog", { name: "Delete deal" });
  await expect(dialog).toContainText(`${deal.name}, its 1 activity and its stage history will be deleted.`);
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Deal deleted", { exact: true })).toBeVisible();
  await expect(page.getByText(`Nothing matches "${deal.name}".`)).toBeVisible();
});

test("deleting from the deal's own page goes back to the deals", async ({ page, api }) => {
  const deal = await api.deal({ name: unique("Page delete") });
  await page.goto(`/deals/${deal.id}`);
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("dialog", { name: "Delete deal" }).getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/deals$/);
  await expect(page.getByRole("heading", { level: 1, name: "Deals" })).toBeVisible();
});
