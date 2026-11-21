import type { Stage } from "../lib/stages";

export type { Stage };
export type Status = "lead" | "qualified" | "customer";
export type ActivityType = "note" | "call" | "email";

export interface Link {
  id: number;
  name: string;
}

export interface Organization {
  id: number;
  name: string;
  website: string | null;
  industry: string | null;
  notes: string | null;
  contact_count: number;
  open_deal_count: number;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  organization_id: number | null;
  organization_name: string | null;
  status: Status;
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: number;
  name: string;
  organization_id: number | null;
  organization_name: string | null;
  contact_id: number;
  contact_name: string;
  stage: Stage;
  value_cents: number;
  probability: number;
  probability_by_hand: boolean;
  expected_cents: number;
  close_date: string;
  late: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: number;
  type: ActivityType;
  description: string;
  occurred_at: string;
  follow_up_date: string | null;
  done: boolean;
  contact_id: number | null;
  deal_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface TimelineEntry {
  kind: "activity" | "stage_change";
  id: number;
  at: string;
  type: ActivityType | null;
  description: string | null;
  follow_up_date: string | null;
  done: boolean | null;
  contact_id: number | null;
  deal_id: number | null;
  from_stage: Stage | null;
  to_stage: Stage | null;
  contact: Link | null;
  deal: Link | null;
  organization: Link | null;
}

export interface OrganizationDetail extends Organization {
  contacts: Contact[];
  deals: Deal[];
  open_pipeline_cents: number;
  won_cents: number;
}

export interface ContactDetail extends Contact {
  organization: Link | null;
  deals: Deal[];
  timeline: TimelineEntry[];
}

export interface DealDetail extends Deal {
  timeline: TimelineEntry[];
}

export interface OrganizationImpact {
  name: string;
  contact_count: number;
  deal_count: number;
}

export interface ContactImpact {
  name: string;
  deals: Link[];
  activity_count: number;
}

export interface DealImpact {
  name: string;
  activity_count: number;
  stage_change_count: number;
}

export interface PipelineColumn {
  stage: Stage;
  count: number;
  total_cents: number;
  expected_cents: number;
  deals: Deal[];
}

export interface PipelineTotals {
  open_cents: number;
  expected_cents: number;
  open_count: number;
}

export interface Pipeline {
  columns: PipelineColumn[];
  totals: PipelineTotals;
}

export interface FollowUp {
  id: number;
  type: ActivityType;
  description: string;
  occurred_at: string;
  follow_up_date: string;
  contact: Link | null;
  deal: Link | null;
}

export interface Dashboard {
  today: string;
  figures: {
    open_pipeline_cents: number;
    open_count: number;
    expected_cents: number;
    won_12m_cents: number;
    won_12m_count: number;
    won_this_month_cents: number;
    won_this_month_count: number;
    overdue_count: number;
    coming_up_count: number;
  };
  months: { month: string; revenue_cents: number; deals: number }[];
  funnel: { stage: Stage; value_cents: number; count: number; percent_of_new: number }[];
  open_by_stage: { stage: Stage; value_cents: number; count: number }[];
  follow_ups: { overdue: FollowUp[]; coming_up: FollowUp[] };
  recent: TimelineEntry[];
}

// Request bodies

export interface OrganizationInput {
  name: string;
  website: string | null;
  industry: string | null;
  notes: string | null;
}

export interface ContactInput {
  name: string;
  organization_id: number;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  status: Status;
}

export interface DealInput {
  name: string;
  contact_id: number;
  organization_id: number | null;
  stage: Stage;
  value_cents: number;
  probability: number;
  close_date: string;
}

export interface ActivityInput {
  type: ActivityType;
  description: string;
  occurred_at: string;
  follow_up_date: string | null;
  done?: boolean;
  contact_id?: number | null;
  deal_id?: number | null;
}
