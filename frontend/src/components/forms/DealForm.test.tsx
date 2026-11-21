import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeApi, renderWithApp } from "../../test/render";
import { DealForm, type DealDefaults } from "./DealForm";

const CONTACTS = [
  { id: 1, name: "Maria Lopez", organization_id: 10, organization_name: "Acme Corp", status: "lead" },
  { id: 2, name: "Tom Okafor", organization_id: null, organization_name: null, status: "customer" },
];
const ORGANIZATIONS = [
  { id: 10, name: "Acme Corp", industry: "Retail" },
  { id: 11, name: "Beta Freight", industry: "Logistics" },
];

function setup(defaults?: DealDefaults, saveResponse: (body: unknown) => unknown = (body) => [201, body]) {
  const calls = fakeApi({
    "GET /api/health": () => ({ status: "ok", today: "2026-11-21" }),
    "GET /api/contacts": () => CONTACTS,
    "GET /api/organizations": () => ORGANIZATIONS,
    "POST /api/deals": saveResponse,
  });
  renderWithApp(<DealForm open onOpenChange={() => {}} defaults={defaults} />);
  return calls;
}

async function pick(user: ReturnType<typeof userEvent.setup>, field: string, search: string, option: string) {
  await user.click(screen.getByRole("combobox", { name: new RegExp(`^${field}`) }));
  await user.type(screen.getByPlaceholderText(/^Search/), search);
  await user.click(await screen.findByRole("option", { name: new RegExp(option) }));
}

describe("DealForm", () => {
  it("fills in the organization from the contact, which can then be changed", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByRole("dialog", { name: "New deal" });

    await pick(user, "Main contact", "maria", "Maria Lopez");
    expect(screen.getByRole("combobox", { name: "Main contact" })).toHaveTextContent("Maria Lopez");
    expect(screen.getByRole("combobox", { name: /Organization/ })).toHaveTextContent("Acme Corp");

    await pick(user, "Organization", "beta", "Beta Freight");
    expect(screen.getByRole("combobox", { name: /Organization/ })).toHaveTextContent("Beta Freight");

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByRole("combobox", { name: /Organization/ })).toHaveTextContent("No organization");
  });

  it("clears the organization for a contact who has none", async () => {
    const user = userEvent.setup();
    setup({ organization_id: 10 });
    await screen.findByRole("dialog");
    await pick(user, "Main contact", "tom", "Tom Okafor");
    expect(screen.getByRole("combobox", { name: /Organization/ })).toHaveTextContent("No organization");
  });

  it("resets the probability when the stage changes", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByRole("dialog");
    const probability = screen.getByLabelText("Probability");
    expect(probability).toHaveValue("10");
    await user.clear(probability);
    await user.type(probability, "33");
    await user.selectOptions(screen.getByLabelText("Stage"), "proposal");
    expect(probability).toHaveValue("50");
  });

  it("fills in today's date for Won or Lost, which can then be changed", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByRole("dialog");
    const close = screen.getByLabelText("Close date");
    expect(close).toHaveValue("2026-12-21");

    await user.selectOptions(screen.getByLabelText("Stage"), "won");
    expect(close).toHaveValue("2026-11-21");
    expect(screen.getByLabelText("Probability")).toHaveValue("100");

    await user.selectOptions(screen.getByLabelText("Stage"), "lost");
    expect(screen.getByLabelText("Probability")).toHaveValue("0");
  });

  it("presets the stage when it opens from a column", async () => {
    setup({ stage: "negotiation" });
    await screen.findByRole("dialog");
    expect(screen.getByLabelText("Stage")).toHaveValue("negotiation");
    expect(screen.getByLabelText("Probability")).toHaveValue("75");
  });

  it("sends whole dollars as cents", async () => {
    const user = userEvent.setup();
    const calls = setup({ stage: "qualified" });
    await screen.findByRole("dialog");
    await user.type(screen.getByLabelText("Name"), "Website redesign");
    await pick(user, "Main contact", "maria", "Maria Lopez");
    await user.type(screen.getByLabelText("Value (USD)"), "12,500");
    await user.click(screen.getByRole("button", { name: "Add deal" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({
      name: "Website redesign",
      contact_id: 1,
      organization_id: 10,
      stage: "qualified",
      value_cents: 1_250_000,
      probability: 25,
      close_date: "2026-12-21",
    });
  });

  it("shows its own messages before sending anything", async () => {
    const user = userEvent.setup();
    const calls = setup();
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Add deal" }));
    expect(await screen.findByText("Enter a name.")).toBeInTheDocument();
    expect(screen.getByText("Pick a main contact.")).toBeInTheDocument();
    expect(screen.getByText("Enter a value in whole dollars.")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("shows the server's 422 messages next to their fields", async () => {
    const user = userEvent.setup();
    setup(undefined, () => [
      422,
      {
        detail: "Some fields need fixing.",
        errors: { value_cents: "Enter a value of $0 or more.", name: "That name is taken." },
      },
    ]);
    await screen.findByRole("dialog");
    await user.type(screen.getByLabelText("Name"), "Website redesign");
    await pick(user, "Main contact", "maria", "Maria Lopez");
    await user.type(screen.getByLabelText("Value (USD)"), "100");
    await user.click(screen.getByRole("button", { name: "Add deal" }));

    const value = await screen.findByText("Enter a value of $0 or more.");
    expect(value.closest(".field")).toContainElement(screen.getByLabelText("Value (USD)"));
    const name = screen.getByText("That name is taken.");
    expect(name.closest(".field")).toContainElement(screen.getByLabelText("Name"));
    expect(within(screen.getByRole("dialog")).getByLabelText("Name")).toHaveValue("Website redesign");
  });
});
