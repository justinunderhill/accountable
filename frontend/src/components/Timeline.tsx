import { ArrowRight, Check, FileText, Mail, Pencil, Phone, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { ApiError } from "../api/client";
import { useSaveActivity, useToday } from "../api/queries";
import type { ActivityType, TimelineEntry } from "../api/types";
import { followUpState } from "../lib/dates";
import { formatDateTime, formatShortDate } from "../lib/format";
import { stageInfo, stageName } from "../lib/stages";
import { ConfirmDelete } from "./ConfirmDelete";
import { ActivityForm } from "./forms/ActivityForm";
import { useToast } from "./ui/Toast";

export const TYPE_ICONS: Record<ActivityType, typeof FileText> = { note: FileText, call: Phone, email: Mail };
export const TYPE_LABELS: Record<ActivityType, string> = { note: "Note", call: "Call", email: "Email" };

interface TimelineProps {
  entries: TimelineEntry[];
  /** Label entries that came from a deal with the deal's name, as on a contact's page. */
  showDeal?: boolean;
  emptyLine: string;
}

export function Timeline({ entries, showDeal, emptyLine }: TimelineProps) {
  const [editing, setEditing] = useState<TimelineEntry | null>(null);
  const [deleting, setDeleting] = useState<TimelineEntry | null>(null);

  if (entries.length === 0) {
    return <p className="empty-line timeline-empty">{emptyLine}</p>;
  }
  return (
    <>
      <ol className="timeline" aria-label="Timeline">
        {entries.map((entry) =>
          entry.kind === "stage_change" ? (
            <StageEntry key={`s${entry.id}`} entry={entry} showDeal={showDeal} />
          ) : (
            <ActivityEntry
              key={`a${entry.id}`}
              entry={entry}
              showDeal={showDeal}
              onEdit={() => setEditing(entry)}
              onDelete={() => setDeleting(entry)}
            />
          ),
        )}
      </ol>
      <ActivityForm open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} activity={editing ?? undefined} />
      {deleting && (
        <ConfirmDelete kind="activity" id={deleting.id} open onOpenChange={(o) => !o && setDeleting(null)} />
      )}
    </>
  );
}

function DealLabel({ entry, showDeal }: { entry: TimelineEntry; showDeal?: boolean }) {
  if (!showDeal || !entry.deal) return null;
  return (
    <Link className="tl-deal" to={`/deals/${entry.deal.id}`}>
      {entry.deal.name}
    </Link>
  );
}

function StageEntry({ entry, showDeal }: { entry: TimelineEntry; showDeal?: boolean }) {
  const to = entry.to_stage!;
  return (
    <li className="tl-item tl-stage">
      <span className="tl-icon tl-icon-stage" style={{ ["--c" as string]: stageInfo(to).color }} aria-hidden="true">
        <ArrowRight size={14} />
      </span>
      <div className="tl-body">
        <p className="tl-text">
          Moved from {stageName(entry.from_stage!)} to <strong>{stageName(to)}</strong>
        </p>
        <p className="tl-meta">
          <DealLabel entry={entry} showDeal={showDeal} />
          <time dateTime={entry.at}>{formatDateTime(entry.at)}</time>
        </p>
      </div>
    </li>
  );
}

function ActivityEntry({
  entry,
  showDeal,
  onEdit,
  onDelete,
}: {
  entry: TimelineEntry;
  showDeal?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const type = entry.type!;
  const Icon = TYPE_ICONS[type];
  return (
    <li className="tl-item">
      <span className={`tl-icon tl-icon-${type}`} aria-hidden="true">
        <Icon size={15} />
      </span>
      <div className="tl-body">
        <p className="tl-text">
          <span className="sr-only">{TYPE_LABELS[type]}: </span>
          {entry.description}
        </p>
        <p className="tl-meta">
          <DealLabel entry={entry} showDeal={showDeal} />
          <time dateTime={entry.at}>{formatDateTime(entry.at)}</time>
          {entry.follow_up_date && <FollowUpChip entry={entry} />}
        </p>
      </div>
      <div className="tl-actions">
        <button type="button" className="icon-btn" aria-label={`Edit ${TYPE_LABELS[type].toLowerCase()}`} onClick={onEdit}>
          <Pencil size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-btn danger"
          aria-label={`Delete ${TYPE_LABELS[type].toLowerCase()}`}
          onClick={onDelete}
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

/** "Follow up Nov 24", "Overdue: Nov 18" or "Done". Clicking marks it done, or not done. */
export function FollowUpChip({ entry }: { entry: TimelineEntry }) {
  const today = useToday();
  const save = useSaveActivity();
  const toast = useToast();
  const date = entry.follow_up_date!;
  const state = today ? followUpState(date, Boolean(entry.done), today) : "later";
  const label =
    state === "done" ? "Done" : state === "overdue" ? `Overdue: ${formatShortDate(date)}` : `Follow up ${formatShortDate(date)}`;

  const toggle = async () => {
    try {
      await save.mutateAsync({ id: entry.id, input: { done: !entry.done } });
      toast.success(entry.done ? "Follow-up marked as not done" : "Follow-up marked as done");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "That didn't save. Please try again.");
    }
  };

  return (
    <button
      type="button"
      className={`chip chip-${state}`}
      onClick={toggle}
      disabled={save.isPending}
      aria-pressed={Boolean(entry.done)}
      title={entry.done ? "Mark as not done" : "Mark as done"}
    >
      {state === "done" && <Check size={13} aria-hidden="true" />}
      {label}
    </button>
  );
}
