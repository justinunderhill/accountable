import { ChevronLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useContact } from "../api/queries";
import type { ContactDetail } from "../api/types";
import { ConfirmDelete } from "../components/ConfirmDelete";
import { ActivityForm } from "../components/forms/ActivityForm";
import { ContactForm } from "../components/forms/ContactForm";
import { DealForm } from "../components/forms/DealForm";
import { Timeline } from "../components/Timeline";
import { LateBadge, StageBadge, StatusBadge } from "../components/ui/Badge";
import { PageState } from "../components/ui/PageState";
import { Panel } from "../components/ui/Panel";
import { formatMoney } from "../lib/format";

export function ContactPage() {
  const id = Number(useParams().id);
  const contact = useContact(id);
  return (
    <main className="main">
      <Link className="crumb" to="/contacts">
        <ChevronLeft size={15} aria-hidden="true" />
        Contacts
      </Link>
      <PageState query={contact} noun="contact" backTo={{ href: "/contacts", label: "All contacts" }}>
        {(c) => <ContactView contact={c} />}
      </PageState>
    </main>
  );
}

function ContactView({ contact }: { contact: ContactDetail }) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [logging, setLogging] = useState(false);
  const [addingDeal, setAddingDeal] = useState(false);

  return (
    <div className="record">
      <section className="panel record-head">
        <div className="record-title-row">
          <div>
            <div className="record-title">
              <h1 className="page-title">{contact.name}</h1>
              <StatusBadge status={contact.status} />
            </div>
            <p className="record-sub">
              {contact.job_title ?? "No job title"}
              {" at "}
              {contact.organization ? (
                <Link to={`/organizations/${contact.organization.id}`}>{contact.organization.name}</Link>
              ) : (
                <span className="none">No organization</span>
              )}
            </p>
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
            <dt>Email</dt>
            <dd>{contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : <span className="none">None</span>}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd className="num">{contact.phone ?? <span className="none">None</span>}</dd>
          </div>
          <div>
            <dt>Organization</dt>
            <dd>
              {contact.organization ? (
                <Link to={`/organizations/${contact.organization.id}`}>{contact.organization.name}</Link>
              ) : (
                <span className="none">No organization</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <div className="record-grid">
        <Panel
          title={`Deals (${contact.deals.length})`}
          sub="Where this person is the main contact"
          action={
            <button type="button" className="btn btn-sm" onClick={() => setAddingDeal(true)}>
              <Plus size={15} aria-hidden="true" />
              New deal
            </button>
          }
        >
          {contact.deals.length === 0 ? (
            <p className="empty-line small-empty">No deals yet.</p>
          ) : (
            <ul className="link-list" aria-label="Deals">
              {contact.deals.map((d) => (
                <li key={d.id}>
                  <div>
                    <Link className="link-list-name" to={`/deals/${d.id}`}>
                      {d.name}
                    </Link>
                    <div className="link-list-badges">
                      <StageBadge stage={d.stage} />
                      {d.late && <LateBadge />}
                    </div>
                  </div>
                  <span className="num link-list-value">{formatMoney(d.value_cents)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Timeline"
          sub="Newest first, including this person's deals"
          action={
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setLogging(true)}>
              <Plus size={15} aria-hidden="true" />
              Log activity
            </button>
          }
        >
          <Timeline entries={contact.timeline} showDeal emptyLine="Nothing logged yet." />
        </Panel>
      </div>

      <ContactForm open={editing} onOpenChange={setEditing} contact={contact} />
      <ActivityForm open={logging} onOpenChange={setLogging} target={{ contact_id: contact.id }} />
      <DealForm
        open={addingDeal}
        onOpenChange={setAddingDeal}
        defaults={{ contact_id: contact.id, organization_id: contact.organization_id ?? undefined }}
      />
      <ConfirmDelete
        kind="contact"
        id={contact.id}
        open={deleting}
        onOpenChange={setDeleting}
        onDeleted={() => navigate("/contacts")}
      />
    </div>
  );
}
