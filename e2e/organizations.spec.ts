import { expect, firstColumn, naturalCompare, row, test, unique } from "./fixtures";

test("add, find, sort and edit an organization, and the change is kept", async ({ page }) => {
  const name = unique("Acme Corp");
  await page.goto("/organizations");
  await page.getByRole("button", { name: "New organization" }).click();
  const form = page.getByRole("dialog", { name: "New organization" });
  await expect(form.getByLabel("Name")).toBeFocused();
  await form.getByLabel("Name").fill(name);
  await form.getByLabel(/Website/).fill("acme-e2e.example.com");
  await form.getByLabel(/Industry/).fill("Retail");
  await form.getByRole("button", { name: "Add organization" }).click();
  await expect(form).toBeHidden();
  await expect(page.getByText("Organization saved", { exact: true })).toBeVisible();

  // Find it by searching
  const search = page.getByRole("searchbox", { name: "Search Organizations" });
  await search.fill(name.toUpperCase());
  await expect(row(page, name)).toHaveCount(1);
  await expect(page.getByText("1–1 of 1")).toBeVisible();
  await expect(row(page, name).getByRole("link", { name: "acme-e2e.example.com" })).toHaveAttribute(
    "href",
    "https://acme-e2e.example.com",
  );

  // Sort by name, both ways
  await search.fill("");
  const table = page.getByRole("table", { name: "Organizations" });
  await page.getByRole("button", { name: "Name" }).click();
  await expect(page.getByRole("columnheader", { name: "Name" })).toHaveAttribute("aria-sort", "ascending");
  const ascending = await firstColumn(table);
  expect(ascending).toEqual([...ascending].sort(naturalCompare));
  await page.getByRole("button", { name: "Name" }).click();
  await expect(page.getByRole("columnheader", { name: "Name" })).toHaveAttribute("aria-sort", "descending");
  const descending = await firstColumn(table);
  expect(descending).toEqual([...descending].sort((a, b) => naturalCompare(b, a)));

  // Edit it from its row
  await search.fill(name);
  await page.getByRole("button", { name: `Edit ${name}` }).click();
  const edit = page.getByRole("dialog", { name: "Edit organization" });
  await edit.getByLabel(/Industry/).fill("Logistics");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(row(page, name)).toContainText("Logistics");

  // Still there after a refresh
  await page.reload();
  await page.getByRole("searchbox", { name: "Search Organizations" }).fill(name);
  await expect(row(page, name)).toContainText("Logistics");
});

test("a name is required, and the form keeps what was typed", async ({ page }) => {
  await page.goto("/organizations");
  await page.getByRole("button", { name: "New organization" }).click();
  const form = page.getByRole("dialog", { name: "New organization" });
  await form.getByLabel(/Industry/).fill("Finance");
  await form.getByRole("button", { name: "Add organization" }).click();
  await expect(form.getByText("Enter a name.")).toBeVisible();
  await expect(form.getByLabel(/Industry/)).toHaveValue("Finance");
  await page.keyboard.press("Escape");
  await expect(form).toBeHidden();
});

test("deleting an organization keeps its contacts and deals, with no organization", async ({ page, api }) => {
  const org = await api.org({ name: unique("Doomed Ltd") });
  const contact = await api.contact({ organization_id: org.id });
  const deal = await api.deal({ contact_id: contact.id, organization_id: org.id });

  await page.goto("/organizations");
  await page.getByRole("searchbox", { name: "Search Organizations" }).fill(org.name);
  await page.getByRole("button", { name: `Delete ${org.name}` }).click();
  const dialog = page.getByRole("dialog", { name: "Delete organization" });
  await expect(dialog).toContainText(
    `${org.name} will be deleted. Its 1 contact and 1 deal will be kept, with no organization.`,
  );
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Organization deleted", { exact: true })).toBeVisible();
  await expect(page.getByText(`Nothing matches "${org.name}".`)).toBeVisible();

  await page.goto("/contacts");
  await page.getByRole("searchbox", { name: "Search Contacts" }).fill(contact.name);
  await expect(row(page, contact.name)).toContainText("No organization");

  await page.goto("/deals");
  await page.getByRole("searchbox", { name: "Search Deals" }).fill(deal.name);
  await expect(row(page, deal.name)).toContainText("No organization");
});
