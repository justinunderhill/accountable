import { Link } from "react-router";
import { ApiError } from "../api/client";
import { useDeleteImpact, useDeleteRecord, type RecordKind } from "../api/queries";
import type { ContactImpact, DealImpact, OrganizationImpact } from "../api/types";
import { formatCount } from "../lib/format";
import { Dialog } from "./ui/Dialog";
import { useToast } from "./ui/Toast";

interface ConfirmDeleteProps {
  kind: RecordKind;
  id: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the record is gone, for example to leave its page. */
  onDeleted?: () => void;
}

const TITLES: Record<RecordKind, string> = {
  organization: "Delete organization",
  contact: "Delete contact",
  deal: "Delete deal",
  activity: "Delete activity",
};

const DONE: Record<RecordKind, string> = {
  organization: "Organization deleted",
  contact: "Contact deleted",
  deal: "Deal deleted",
  activity: "Activity deleted",
};

/** The sentence that says what a delete will do to the linked records. */
export function impactSentence(kind: RecordKind, impact: unknown): string {
  if (kind === "activity") return "This activity will be deleted.";
  if (kind === "organization") {
    const { name, contact_count, deal_count } = impact as OrganizationImpact;
    if (contact_count === 0 && deal_count === 0) return `${name} will be deleted. It has no contacts or deals.`;
    const kept = [contact_count && formatCount(contact_count, "contact"), deal_count && formatCount(deal_count, "deal")]
      .filter(Boolean)
      .join(" and ");
    return `${name} will be deleted. Its ${kept} will be kept, with no organization.`;
  }
  if (kind === "contact") {
    const { name, deals, activity_count } = impact as ContactImpact;
    if (deals.length > 0) {
      return `${name} is the main contact on ${formatCount(deals.length, "deal")}. Give each deal another contact before deleting ${name}.`;
    }
    if (activity_count === 0) return `${name} will be deleted.`;
    return `${name} will be deleted, along with ${formatCount(activity_count, "activity", "activities")}.`;
  }
  const { name, activity_count, stage_change_count } = impact as DealImpact;
  const parts = [];
  if (activity_count > 0) parts.push(`its ${formatCount(activity_count, "activity", "activities")}`);
  if (stage_change_count > 0) parts.push("its stage history");
  if (parts.length === 0) return `${name} will be deleted.`;
  if (parts.length === 1) return `${name} and ${parts[0]} will be deleted.`;
  return `${name}, ${parts[0]} and ${parts[1]} will be deleted.`;
}

export function ConfirmDelete({ kind, id, open, onOpenChange, onDeleted }: ConfirmDeleteProps) {
  const impact = useDeleteImpact(kind, id, open);
  const remove = useDeleteRecord();
  const toast = useToast();

  const blocking = kind === "contact" && impact.data ? (impact.data as ContactImpact).deals : [];
  const ready = kind === "activity" || impact.isSuccess;
  const blocked = blocking.length > 0;

  const confirm = async () => {
    try {
      await remove.mutateAsync({ kind, id });
      onOpenChange(false);
      toast.success(DONE[kind]);
      onDeleted?.();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The delete didn't work. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={TITLES[kind]}>
      <div className="confirm">
        {impact.isError ? (
          <p className="form-error" role="alert">
            {impact.error instanceof ApiError ? impact.error.message : "Couldn't check what this delete affects."}
          </p>
        ) : !ready ? (
          <p className="muted">Checking linked records...</p>
        ) : (
          <p className="confirm-text">{impactSentence(kind, impact.data)}</p>
        )}
        {blocked && (
          <ul className="confirm-deals">
            {blocking.map((deal) => (
              <li key={deal.id}>
                <Link to={`/deals/${deal.id}`} onClick={() => onOpenChange(false)}>
                  {deal.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {ready && !blocked && <p className="confirm-note">This can't be undone.</p>}
        <div className="dlg-actions">
          <button type="button" className="btn" onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={!ready || blocked || remove.isPending}
            onClick={confirm}
          >
            {remove.isPending ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
