import { expect, test, unique, type Api } from "./fixtures";
import type { Page } from "@playwright/test";

async function logActivity(
  page: Page,
  { type, description, when, followUp }: { type: "Note" | "Call" | "Email"; description: string; when: string; followUp?: string },
) {
  await page.getByRole("button", { name: "Log activity" }).click();
  const form = page.getByRole("dialog", { name: "Log activity" });
  await form.getByRole("radio", { name: type }).click();
  await form.getByLabel("Description").fill(description);
  await form.getByLabel("When it happened").fill(when);
  if (followUp) await form.getByLabel(/Follow-up date/).fill(followUp);
  await form.getByRole("button", { name: "Log activity" }).click();
  await expect(form).toBeHidden();
}

function timeline(page: Page) {
  return page.getByRole("list", { name: "Timeline" }).getByRole("listitem");
}

async function newDeal(api: Api) {
  const contact = await api.contact({ name: unique("Timeline Person") });
  const deal = await api.deal({ name: unique("Timeline deal"), contact_id: contact.id });
  return { contact, deal };
}

test("activities logged on a contact appear in the timeline, newest first", async ({ page, api }) => {
  const contact = await api.contact({ name: unique("Grace Whitfield") });
  await page.goto(`/contacts/${contact.id}`);
  await expect(page.getByText("Nothing logged yet.")).toBeVisible();

  await logActivity(page, { type: "Note", description: "Prefers email", when: "2026-01-10T09:00" });
  await logActivity(page, { type: "Email", description: "Sent the case study", when: "2026-01-12T14:00", followUp: "2030-02-01" });
  await logActivity(page, { type: "Call", description: "Intro call", when: "2026-01-11T10:30" });

  await expect(timeline(page)).toHaveCount(3);
  await expect(timeline(page).nth(0)).toContainText("Sent the case study");
  await expect(timeline(page).nth(0)).toContainText("Jan 12, 2026, 2:00 PM");
  await expect(timeline(page).nth(0)).toContainText("Follow up Feb 1");
  await expect(timeline(page).nth(1)).toContainText("Intro call");
  await expect(timeline(page).nth(2)).toContainText("Prefers email");

  // Kept after a refresh
  await page.reload();
  await expect(timeline(page)).toHaveCount(3);
});

test("activities on a deal, and its stage changes, appear in its timeline and its contact's", async ({ page, api }) => {
  const { contact, deal } = await newDeal(api);
  await page.goto(`/deals/${deal.id}`);
  await logActivity(page, { type: "Call", description: "Discussed pricing", when: "2026-01-05T11:00", followUp: "2030-01-20" });

  // Move the stage with the stage control
  await page.getByRole("group", { name: "Stage" }).getByRole("button", { name: "Qualified" }).click();
  await expect(page.getByText(`${deal.name} moved to Qualified.`, { exact: true })).toBeVisible();
  await expect(timeline(page).nth(0)).toContainText("Moved from New to Qualified");
  await expect(timeline(page).nth(1)).toContainText("Discussed pricing");
  await expect(page.getByText("25%")).toBeVisible();

  // The contact's timeline shows both, labelled with the deal
  await page.getByRole("link", { name: contact.name }).click();
  await expect(timeline(page)).toHaveCount(2);
  await expect(timeline(page).nth(0)).toContainText("Moved from New to Qualified");
  await expect(timeline(page).nth(0).getByRole("link", { name: deal.name })).toBeVisible();
  await expect(timeline(page).nth(1).getByRole("link", { name: deal.name })).toBeVisible();
});

function shiftDay(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** The follow-up group on the dashboard, opened up to show every item. */
async function followUps(page: Page, group: "Overdue" | "Next 7 days") {
  const region = page.getByRole("group", { name: group });
  await expect(region.getByRole("listitem").first()).toBeVisible();
  const more = region.getByRole("button", { name: /^Show all/ });
  if (await more.isVisible()) await more.click();
  return region;
}

test("a follow-up shows on the dashboard as coming up or overdue until it's marked done", async ({ page, api }) => {
  const today = (await api.get<{ today: string }>("/health")).today;
  const contact = await api.contact({ name: unique("Follow Up Person") });
  const soon = unique("Call back next week");
  const late = unique("Chase the signature");

  await page.goto(`/contacts/${contact.id}`);
  await logActivity(page, { type: "Call", description: soon, when: `${today}T09:00`, followUp: shiftDay(today, 3) });
  await logActivity(page, { type: "Email", description: late, when: `${shiftDay(today, -5)}T09:00`, followUp: shiftDay(today, -2) });
  await expect(timeline(page).filter({ hasText: late })).toContainText("Overdue:");

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Dashboard" }).click();
  const comingUp = await followUps(page, "Next 7 days");
  await expect(comingUp.getByRole("listitem").filter({ hasText: soon })).toContainText(contact.name);
  const overdue = await followUps(page, "Overdue");
  await expect(overdue.getByRole("listitem").filter({ hasText: late })).toBeVisible();

  // Mark the overdue one done from the dashboard; it leaves the list
  await overdue.getByRole("checkbox", { name: `Mark as done: ${late}` }).click();
  await expect(page.getByText("Follow-up marked as done", { exact: true })).toBeVisible();
  await expect(page.getByText(late)).toHaveCount(0);

  // The timeline shows it as done
  await page.goto(`/contacts/${contact.id}`);
  await expect(timeline(page).filter({ hasText: late }).getByRole("button", { name: "Done" })).toBeVisible();
});

test("an activity can be edited, marked done and deleted", async ({ page, api }) => {
  const contact = await api.contact();
  await api.activity({ contact_id: contact.id, type: "call", description: "Call back about terms", follow_up_date: "2030-03-03" });
  await page.goto(`/contacts/${contact.id}`);

  const item = timeline(page).first();
  await item.hover();
  await item.getByRole("button", { name: "Edit call" }).click();
  const form = page.getByRole("dialog", { name: "Edit activity" });
  await form.getByLabel("Description").fill("Call back about contract terms");
  await form.getByRole("button", { name: "Save changes" }).click();
  await expect(item).toContainText("Call back about contract terms");

  // The follow-up chip marks it done, and back again
  await item.getByRole("button", { name: "Follow up Mar 3" }).click();
  await expect(item.getByRole("button", { name: "Done" })).toBeVisible();
  await item.getByRole("button", { name: "Done" }).click();
  await expect(item.getByRole("button", { name: "Follow up Mar 3" })).toBeVisible();

  await item.hover();
  await item.getByRole("button", { name: "Delete call" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete activity" });
  await expect(dialog).toContainText("This activity will be deleted.");
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Nothing logged yet.")).toBeVisible();
});
