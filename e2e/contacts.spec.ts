import { expect, pick, row, test, unique } from "./fixtures";

test("add, find, sort and edit a contact, and the change is kept", async ({ page, api }) => {
  const org = await api.org({ name: unique("Harbor Co") });
  const name = unique("Maria Lopez");
  await page.goto("/contacts");
  await page.getByRole("button", { name: "New contact" }).click();
  const form = page.getByRole("dialog", { name: "New contact" });
  await form.getByLabel("Name").fill(name);
  await pick(page, form, /^Organization/, org.name);
  await form.getByLabel(/Job title/).fill("Finance Manager");
  await form.getByLabel(/Email/).fill("maria@harbor.example.com");
  await form.getByLabel("Status").selectOption("qualified");
  await form.getByRole("button", { name: "Add contact" }).click();
  await expect(page.getByText("Contact saved", { exact: true })).toBeVisible();

  const search = page.getByRole("searchbox", { name: "Search Contacts" });
  await search.fill(name.toLowerCase());
  await expect(row(page, name)).toContainText(org.name);
  await expect(row(page, name)).toContainText("Qualified");

  // Sort by organization
  await search.fill("");
  await page.getByRole("button", { name: "Organization" }).click();
  await expect(page.getByRole("columnheader", { name: "Organization" })).toHaveAttribute("aria-sort", "ascending");

  // Edit
  await search.fill(name);
  await page.getByRole("button", { name: `Edit ${name}` }).click();
  const edit = page.getByRole("dialog", { name: "Edit contact" });
  await edit.getByLabel("Status").selectOption("customer");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(row(page, name)).toContainText("Customer");

  await page.reload();
  await page.getByRole("searchbox", { name: "Search Contacts" }).fill(name);
  await expect(row(page, name)).toContainText("Customer");
});

test("an organization is required for a contact", async ({ page }) => {
  await page.goto("/contacts");
  await page.getByRole("button", { name: "New contact" }).click();
  const form = page.getByRole("dialog", { name: "New contact" });
  await form.getByLabel("Name").fill("No Org Person");
  await form.getByRole("button", { name: "Add contact" }).click();
  await expect(form.getByText("Pick an organization.")).toBeVisible();
});

test("deleting a contact says their activities go too", async ({ page, api }) => {
  const contact = await api.contact({ name: unique("Leaving Person") });
  await api.activity({ contact_id: contact.id });
  await api.activity({ contact_id: contact.id, type: "call" });

  await page.goto("/contacts");
  await page.getByRole("searchbox", { name: "Search Contacts" }).fill(contact.name);
  await page.getByRole("button", { name: `Delete ${contact.name}` }).click();
  const dialog = page.getByRole("dialog", { name: "Delete contact" });
  await expect(dialog).toContainText(`${contact.name} will be deleted, along with 2 activities.`);
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText(`Nothing matches "${contact.name}".`)).toBeVisible();
});

test("a contact on a deal can't be deleted until the deal has another contact", async ({ page, api }) => {
  const org = await api.org();
  const contact = await api.contact({ name: unique("Busy Person"), organization_id: org.id });
  const other = await api.contact({ name: unique("Stand In"), organization_id: org.id });
  const deal = await api.deal({ name: unique("Blocking deal"), contact_id: contact.id, organization_id: org.id });

  await page.goto("/contacts");
  await page.getByRole("searchbox", { name: "Search Contacts" }).fill(contact.name);
  await page.getByRole("button", { name: `Delete ${contact.name}` }).click();
  const dialog = page.getByRole("dialog", { name: "Delete contact" });
  await expect(dialog).toContainText(
    `${contact.name} is the main contact on 1 deal. Give each deal another contact before deleting ${contact.name}.`,
  );
  await expect(dialog.getByRole("button", { name: "Delete" })).toBeDisabled();

  // Follow the link to the deal and give it another contact
  await dialog.getByRole("link", { name: deal.name }).click();
  await expect(page.getByRole("heading", { level: 1, name: deal.name })).toBeVisible();
  await page.getByRole("button", { name: "Edit" }).click();
  const edit = page.getByRole("dialog", { name: "Edit deal" });
  await pick(page, edit, /^Main contact/, other.name);
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("link", { name: other.name })).toBeVisible();

  await page.goto("/contacts");
  await page.getByRole("searchbox", { name: "Search Contacts" }).fill(contact.name);
  await page.getByRole("button", { name: `Delete ${contact.name}` }).click();
  const again = page.getByRole("dialog", { name: "Delete contact" });
  await expect(again).toContainText(`${contact.name} will be deleted.`);
  await again.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText(`Nothing matches "${contact.name}".`)).toBeVisible();
});

test("the status tabs filter the table and combine with search", async ({ page, api }) => {
  const prefix = unique("Tabby");
  const org = await api.org();
  await api.contact({ name: `${prefix} Lead`, status: "lead", organization_id: org.id });
  await api.contact({ name: `${prefix} Customer`, status: "customer", organization_id: org.id });
  await api.contact({ name: `${prefix} Qualified`, status: "qualified", organization_id: org.id });

  await page.goto("/contacts");
  const tabs = page.getByRole("tablist", { name: "Filter by status" });
  const all = await page.getByRole("tab", { name: /All/ }).textContent();
  const leads = await page.getByRole("tab", { name: /Leads/ }).textContent();
  expect(Number(all!.replace(/\D/g, ""))).toBeGreaterThan(Number(leads!.replace(/\D/g, "")));

  await page.getByRole("searchbox", { name: "Search Contacts" }).fill(prefix);
  await expect(page.locator("tbody tr")).toHaveCount(3);

  await tabs.getByRole("tab", { name: /Customers/ }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(row(page, `${prefix} Customer`)).toBeVisible();

  await tabs.getByRole("tab", { name: /Leads/ }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(row(page, `${prefix} Lead`)).toBeVisible();

  // Without the search, the Leads tab shows only leads
  await page.getByRole("searchbox", { name: "Search Contacts" }).fill("");
  const statuses = await page.locator("tbody tr td:nth-child(6)").allTextContents();
  expect(new Set(statuses)).toEqual(new Set(["Lead"]));

  await tabs.getByRole("tab", { name: /All/ }).click();
  await page.getByRole("searchbox", { name: "Search Contacts" }).fill(prefix);
  await expect(page.locator("tbody tr")).toHaveCount(3);
});
