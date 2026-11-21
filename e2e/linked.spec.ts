import { expect, test, unique } from "./fixtures";

test("each record's page shows its linked records, and the links go to the right pages", async ({ page, api }) => {
  const org = await api.org({ name: unique("Linked Org"), industry: "Healthcare" });
  const contact = await api.contact({ name: unique("Priya Natarajan"), organization_id: org.id });
  const colleague = await api.contact({ name: unique("Colleague"), organization_id: org.id });
  const deal = await api.deal({ name: unique("Clinic platform"), contact_id: contact.id, organization_id: org.id });

  // Organization page: its contacts and deals
  await page.goto(`/organizations/${org.id}`);
  await expect(page.getByRole("heading", { level: 1, name: org.name })).toBeVisible();
  const contacts = page.getByRole("table", { name: `Contacts at ${org.name}` });
  await expect(contacts.getByRole("link", { name: contact.name })).toBeVisible();
  await expect(contacts.getByRole("link", { name: colleague.name })).toBeVisible();
  const deals = page.getByRole("table", { name: `Deals with ${org.name}` });
  await expect(deals.getByRole("link", { name: deal.name })).toBeVisible();

  // Contact page: their organization and deals
  await contacts.getByRole("link", { name: contact.name }).click();
  await expect(page).toHaveURL(new RegExp(`/contacts/${contact.id}$`));
  await expect(page.getByRole("heading", { level: 1, name: contact.name })).toBeVisible();
  await expect(page.getByRole("list", { name: "Deals" }).getByRole("link", { name: deal.name })).toBeVisible();

  // Deal page: its organization and main contact
  await page.getByRole("list", { name: "Deals" }).getByRole("link", { name: deal.name }).click();
  await expect(page).toHaveURL(new RegExp(`/deals/${deal.id}$`));
  await expect(page.getByRole("heading", { level: 1, name: deal.name })).toBeVisible();
  await page.getByRole("link", { name: contact.name }).click();
  await expect(page).toHaveURL(new RegExp(`/contacts/${contact.id}$`));

  await page.getByRole("link", { name: org.name }).first().click();
  await expect(page).toHaveURL(new RegExp(`/organizations/${org.id}$`));

  // Browser back works
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/contacts/${contact.id}$`));
});

test("a new contact from an organization's page has the organization filled in", async ({ page, api }) => {
  const org = await api.org({ name: unique("Prefill Org") });
  await page.goto(`/organizations/${org.id}`);
  await page.getByRole("button", { name: "New contact" }).click();
  const form = page.getByRole("dialog", { name: "New contact" });
  await expect(form.getByRole("combobox", { name: /^Organization/ })).toHaveText(org.name);
  const name = unique("Prefilled Person");
  await form.getByLabel("Name").fill(name);
  await form.getByRole("button", { name: "Add contact" }).click();
  await expect(page.getByRole("table", { name: `Contacts at ${org.name}` }).getByRole("link", { name })).toBeVisible();
});
