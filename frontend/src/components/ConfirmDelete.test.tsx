import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RecordKind } from "../api/queries";
import { fakeApi, renderWithApp } from "../test/render";
import { ConfirmDelete, impactSentence } from "./ConfirmDelete";

function open(kind: RecordKind, impact: unknown) {
  const paths: Record<RecordKind, string> = {
    organization: "organizations",
    contact: "contacts",
    deal: "deals",
    activity: "activities",
  };
  fakeApi({ [`GET /api/${paths[kind]}/7/delete-impact`]: () => impact });
  renderWithApp(<ConfirmDelete kind={kind} id={7} open onOpenChange={() => {}} />);
}

describe("ConfirmDelete", () => {
  it("says an organization's contacts and deals will be kept", async () => {
    open("organization", { name: "Acme Corp", contact_count: 4, deal_count: 3 });
    expect(
      await screen.findByText("Acme Corp will be deleted. Its 4 contacts and 3 deals will be kept, with no organization."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled();
  });

  it("says a contact goes with their activities", async () => {
    open("contact", { name: "Maria Lopez", deals: [], activity_count: 6 });
    expect(await screen.findByText("Maria Lopez will be deleted, along with 6 activities.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled();
  });

  it("blocks a contact who is the main contact on deals, and lists the deals", async () => {
    open("contact", {
      name: "Maria Lopez",
      deals: [
        { id: 3, name: "Annual support" },
        { id: 5, name: "Website redesign" },
      ],
      activity_count: 2,
    });
    expect(
      await screen.findByText(
        "Maria Lopez is the main contact on 2 deals. Give each deal another contact before deleting Maria Lopez.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Website redesign" })).toHaveAttribute("href", "/deals/5");
    expect(screen.getByRole("link", { name: "Annual support" })).toHaveAttribute("href", "/deals/3");
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  });

  it("says a deal goes with its activities and stage history", async () => {
    open("deal", { name: "Website redesign", activity_count: 5, stage_change_count: 2 });
    expect(
      await screen.findByText("Website redesign, its 5 activities and its stage history will be deleted."),
    ).toBeInTheDocument();
  });

  it("needs no lookup for an activity", async () => {
    fakeApi({});
    renderWithApp(<ConfirmDelete kind="activity" id={7} open onOpenChange={() => {}} />);
    expect(await screen.findByText("This activity will be deleted.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled();
  });
});

describe("impactSentence", () => {
  it("handles one and none", () => {
    expect(impactSentence("organization", { name: "Acme", contact_count: 1, deal_count: 0 })).toBe(
      "Acme will be deleted. Its 1 contact will be kept, with no organization.",
    );
    expect(impactSentence("organization", { name: "Acme", contact_count: 0, deal_count: 0 })).toBe(
      "Acme will be deleted. It has no contacts or deals.",
    );
    expect(impactSentence("contact", { name: "Maria Lopez", deals: [{ id: 1, name: "X" }], activity_count: 0 })).toBe(
      "Maria Lopez is the main contact on 1 deal. Give each deal another contact before deleting Maria Lopez.",
    );
    expect(impactSentence("contact", { name: "Maria Lopez", deals: [], activity_count: 1 })).toBe(
      "Maria Lopez will be deleted, along with 1 activity.",
    );
    expect(impactSentence("deal", { name: "X", activity_count: 0, stage_change_count: 0 })).toBe("X will be deleted.");
    expect(impactSentence("deal", { name: "X", activity_count: 1, stage_change_count: 0 })).toBe(
      "X and its 1 activity will be deleted.",
    );
  });
});
