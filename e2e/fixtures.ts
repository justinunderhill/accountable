import { test as base, expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";

// Statuses the app handles on purpose: validation errors and the blocked contact delete.
const expectedFailures = new Set([409, 422]);

/** Every test fails on a browser console error or a failed /api request. */
export const test = base.extend<{ failOnErrors: void; api: Api }>({
  failOnErrors: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") problems.push(`console error: ${message.text()}`);
      });
      page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
      page.on("response", (response) => {
        const url = response.url();
        if (url.includes("/api/") && response.status() >= 400 && !expectedFailures.has(response.status())) {
          problems.push(`failed request: ${response.request().method()} ${url} -> ${response.status()}`);
        }
      });
      page.on("requestfailed", (request) => {
        // A fetch cut short by leaving the page isn't a failure.
        if (request.url().includes("/api/") && !request.failure()?.errorText.includes("ERR_ABORTED")) {
          problems.push(`request failed: ${request.url()} (${request.failure()?.errorText})`);
        }
      });
      await use();
      expect(problems, problems.join("\n")).toEqual([]);
    },
    { auto: true },
  ],
  api: async ({ request }, use) => {
    await use(new Api(request));
  },
});

export { expect };

let counter = 0;
/** A name no other test or sample record uses. */
export function unique(prefix: string): string {
  counter += 1;
  return `${prefix} ${Date.now().toString(36)}${counter}`;
}

type Json = Record<string, unknown>;
interface Created {
  id: number;
  name: string;
  [key: string]: unknown;
}

/** Make records straight through the API, for tests that are about something else. */
export class Api {
  constructor(private request: APIRequestContext) {}

  async post(path: string, data: Json): Promise<Created> {
    const response = await this.request.post(`/api${path}`, { data });
    expect(response.status(), await response.text()).toBeLessThan(300);
    return response.json();
  }

  async get<T = Json>(path: string): Promise<T> {
    const response = await this.request.get(`/api${path}`);
    expect(response.ok()).toBe(true);
    return response.json();
  }

  org(fields: Json = {}) {
    return this.post("/organizations", { name: unique("Org"), ...fields });
  }

  async contact(fields: Json = {}) {
    const organization_id = fields.organization_id ?? (await this.org()).id;
    return this.post("/contacts", { name: unique("Contact"), organization_id, ...fields });
  }

  async deal(fields: Json = {}) {
    const contact_id = fields.contact_id ?? (await this.contact()).id;
    return this.post("/deals", {
      name: unique("Deal"),
      contact_id,
      value_cents: 1_000_000,
      close_date: "2030-01-15",
      ...fields,
    });
  }

  activity(fields: Json) {
    return this.post("/activities", {
      type: "note",
      description: unique("Activity"),
      occurred_at: "2026-01-05T09:00",
      ...fields,
    });
  }

  move(dealId: number, stage: string, index = 0) {
    return this.post(`/deals/${dealId}/move`, { stage, index });
  }
}

/** Pick an option from a searchable select by typing part of its label. */
export async function pick(page: Page, scope: Locator, field: RegExp | string, label: string) {
  await scope.getByRole("combobox", { name: field }).click();
  await page.locator(".select-pop").getByPlaceholder(/^Search/).fill(label);
  await page.getByRole("option", { name: new RegExp(escape(label)) }).first().click();
}

export function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The text of the first cell in each body row of a table. */
export async function firstColumn(table: Locator): Promise<string[]> {
  return table.locator("tbody tr").evaluateAll((rows) =>
    rows.map((row) => (row.querySelector("td")?.textContent ?? "").trim()),
  );
}

/** How the tables sort text: ignoring case, with runs of digits compared as numbers. */
export function naturalCompare(a: string, b: string): number {
  const chunks = (s: string) => s.toLowerCase().match(/\d+|\D+/g) ?? [];
  const x = chunks(a);
  const y = chunks(b);
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const [p, q] = [x[i], y[i]];
    const pNum = /^\d/.test(p);
    const qNum = /^\d/.test(q);
    if (pNum !== qNum) return pNum ? 1 : -1;
    if (pNum && Number(p) !== Number(q)) return Number(p) - Number(q);
    if (!pNum && p !== q) return p < q ? -1 : 1;
  }
  return x.length - y.length;
}

/** The table row that holds this text. */
export function row(page: Page, text: string): Locator {
  return page.locator("tbody tr").filter({ hasText: text });
}

/** Drag with small mouse steps, which dnd-kit's pointer sensor needs. */
export async function dragTo(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 6, from.y + 6, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 25 });
  await page.waitForTimeout(200);
  await page.mouse.move(to.x, to.y + 2, { steps: 2 });
  await page.waitForTimeout(100);
  await page.mouse.up();
}
