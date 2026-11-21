import type { ReactNode } from "react";
import type { Status } from "../../api/types";
import { stageInfo, type Stage } from "../../lib/stages";

export function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function StageBadge({ stage }: { stage: Stage }) {
  const info = stageInfo(stage);
  return <span className={`badge ${info.badge}`}>{info.name}</span>;
}

const STATUS: Record<Status, { label: string; tone: string }> = {
  lead: { label: "Lead", tone: "cerulean" },
  qualified: { label: "Qualified", tone: "marigold" },
  customer: { label: "Customer", tone: "green" },
};

export const STATUS_LABELS = Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, v.label])) as Record<
  Status,
  string
>;

export function StatusBadge({ status }: { status: Status }) {
  return <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>;
}

export function LateBadge() {
  return <Badge tone="raspberry">Late</Badge>;
}

export function StageDot({ stage }: { stage: Stage }) {
  return (
    <span
      className={`dot${stage === "lost" ? " dot-lost" : ""}`}
      style={{ background: stageInfo(stage).color }}
      aria-hidden="true"
    />
  );
}
