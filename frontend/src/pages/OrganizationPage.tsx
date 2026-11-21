import { ChevronLeft, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useOrganization } from "../api/queries";
import type { Contact, OrganizationDetail } from "../api/types";
import { ConfirmDelete } from "../components/ConfirmDelete";
import { DataTable, columnHelper, type TableColumn } from "../components/DataTable";
import { ContactForm } from "../components/forms/ContactForm";
import { DealForm } from "../components/forms/DealForm";
import { OrganizationForm } from "../components/forms/OrganizationForm";
import { StatusBadge } from "../components/ui/Badge";
import { PageState } from "../components/ui/PageState";
import { Panel } from "../components/ui/Panel";
import { formatCount, formatMoney } from "../lib/format";
import { dealColumns } from "./Deals";

const col = columnHelper<Contact>();
const contactColumns: TableColumn<Contact>[] = [
  col.accessor("name", {
    header: "Name",
    cell: (info) => (
      <Link className="row-link" to={`/contacts/${info.row.original.id}`}>
        {info.getValue()}
      </Link>
    ),
  }),
  col.accessor((c) => c.job_title ?? undefined, {
    id: "job_title",
    header: "Job title",
    sortUndefined: "last",
    cell: (info) => info.getValue() ?? "",
  }),
  col.accessor((c) => c.email ?? undefined, {
    id: "email",
    header: "Email",
    sortUndefined: "last",
    cell: (info) => (info.getValue() ? <a href={`mailto:${info.getValue()}`}>{info.getValue()}</a> : ""),
  }),
  col.accessor("status", { header: "Status", cell: (info) => <StatusBadge status={info.getValue()} /> }),
];

const orgDealColumns = [
  dealColumns.name,
  dealColumns.contact,
  dealColumns.stage,
  dealColumns.value,
  dealColumns.closeDate,
];

export function OrganizationPage() {
  const id = Number(useParams().id);
  const organization = useOrganization(id);
  return (
    <main className="main">
      <Link className="crumb" to="/organizations">
        <ChevronLeft size={15} aria-hidden="true" />
        Organizations
      </Link>
      <PageState query={organization} noun="organization" backTo={{ href: "/organizations", label: "All organizations" }}>
        {(org) => <OrganizationView org={org} />}
      </PageState>
    </main>
  );
}

function OrganizationView({ org }: { org: OrganizationDetail }) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [addingDeal, setAddingDeal] = useState(false);

  return (
    <div className="record">
      <section className="panel record-head">
        <div className="record-title-row">
          <div>
            <h1 className="page-title">{org.name}</h1>
            <p className="record-sub">{org.industry ?? "No industry set"}</p>
          </div>
          <div className="record-actions">
            <button type="button" className="btn" onClick={() => setEditing(true)}>
              <Pencil size={15} aria-hidden="true" />
              Edit
            </button>
            <button type="button" className="btn btn-quiet-danger" onClick={() => setDeleting(true)}>
              <Trash2 size={15} aria-hidden="true" />
              Delete
            </button>
          </div>
        </div>
        <dl className="record-meta">
          <div>
            <dt>Website</dt>
            <dd>
              {org.website ? (
                <a href={org.website} target="_blank" rel="noreferrer" className="ext-link">
                  {org.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
              ) : (
                <span className="none">None</span>
              )}
            </dd>
          </div>
          <div className="record-notes">
            <dt>Notes</dt>
            <dd>{org.notes ?? <span className="none">None</span>}</dd>
          </div>
        </dl>
      </section>

      <div className="tiles">
        <div className="panel tile">
          <div className="tile-label">Open pipeline</div>
          <div className="tile-value num">{formatMoney(org.open_pipeline_cents)}</div>
          <div className="tile-sub">{formatCount(org.open_deal_count, "open deal")}</div>
        </div>
        <div className="panel tile">
          <div className="tile-label">Revenue won, all time</div>
          <div className="tile-value num tile-won">{formatMoney(org.won_cents)}</div>
          <div className="tile-sub">{formatCount(org.deals.filter((d) => d.stage === "won").length, "deal")} won</div>
        </div>
      </div>

      <Panel
        flush
        title={`Contacts (${org.contacts.length})`}
        action={
          <button type="button" className="btn btn-sm" onClick={() => setAddingContact(true)}>
            <Plus size={15} aria-hidden="true" />
            New contact
          </button>
        }
      >
        <DataTable
          compact
          data={org.contacts}
          columns={contactColumns}
          label={`Contacts at ${org.name}`}
          rowHref={(c) => `/contacts/${c.id}`}
          rowName={(c) => c.name}
          emptyLine="No contacts here yet."
        />
      </Panel>

      <Panel
        flush
        title={`Deals (${org.deals.length})`}
        action={
          <button type="button" className="btn btn-sm" onClick={() => setAddingDeal(true)}>
            <Plus size={15} aria-hidden="true" />
            New deal
          </button>
        }
      >
        <DataTable
          compact
          data={org.deals}
          columns={orgDealColumns}
          label={`Deals with ${org.name}`}
          rowHref={(d) => `/deals/${d.id}`}
          rowName={(d) => d.name}
          emptyLine="No deals here yet."
        />
      </Panel>

      <OrganizationForm open={editing} onOpenChange={setEditing} organization={org} />
      <ContactForm open={addingContact} onOpenChange={setAddingContact} defaults={{ organization_id: org.id }} />
      <DealForm open={addingDeal} onOpenChange={setAddingDeal} defaults={{ organization_id: org.id }} />
      <ConfirmDelete
        kind="organization"
        id={org.id}
        open={deleting}
        onOpenChange={setDeleting}
        onDeleted={() => navigate("/organizations")}
      />
    </div>
  );
}
