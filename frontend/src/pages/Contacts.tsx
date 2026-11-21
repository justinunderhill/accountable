import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useContacts } from "../api/queries";
import type { Contact, Status } from "../api/types";
import { ConfirmDelete } from "../components/ConfirmDelete";
import { DataTable, columnHelper, type TableColumn } from "../components/DataTable";
import { ContactForm } from "../components/forms/ContactForm";
import { StatusBadge } from "../components/ui/Badge";
import { PageState } from "../components/ui/PageState";

const col = columnHelper<Contact>();
const none = (text: string) => <span className="none">{text}</span>;
const STATUS_ORDER: Record<Status, number> = { lead: 0, qualified: 1, customer: 2 };

const columns: TableColumn<Contact>[] = [
  col.accessor("name", {
    header: "Name",
    cell: (info) => (
      <Link className="row-link" to={`/contacts/${info.row.original.id}`}>
        {info.getValue()}
      </Link>
    ),
  }),
  col.accessor((c) => c.organization_name ?? undefined, {
    id: "organization",
    header: "Organization",
    sortUndefined: "last",
    meta: { emptyText: "No organization" },
    cell: (info) => {
      const c = info.row.original;
      return c.organization_id ? (
        <Link to={`/organizations/${c.organization_id}`}>{c.organization_name}</Link>
      ) : (
        none("No organization")
      );
    },
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
    cell: (info) => {
      const email = info.getValue();
      return email ? <a href={`mailto:${email}`}>{email}</a> : "";
    },
  }),
  col.accessor((c) => c.phone ?? undefined, {
    id: "phone",
    header: "Phone",
    sortUndefined: "last",
    cell: (info) => <span className="num phone">{info.getValue() ?? ""}</span>,
  }),
  col.accessor("status", {
    header: "Status",
    sortFn: (a: { original: Contact }, b: { original: Contact }) =>
      STATUS_ORDER[a.original.status] - STATUS_ORDER[b.original.status],
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
];

const TABS: { value: Status | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "lead", label: "Leads" },
  { value: "qualified", label: "Qualified" },
  { value: "customer", label: "Customers" },
];

export function Contacts() {
  const contacts = useContacts();
  const [tab, setTab] = useState<Status | "all">("all");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState<Contact | null>(null);

  const all = contacts.data;
  const counts = useMemo(() => {
    const result: Record<string, number> = { all: all?.length ?? 0, lead: 0, qualified: 0, customer: 0 };
    for (const c of all ?? []) result[c.status] += 1;
    return result;
  }, [all]);
  const shown = useMemo(() => (tab === "all" ? all : all?.filter((c) => c.status === tab)) ?? [], [all, tab]);

  const addButton = (
    <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
      <Plus size={16} aria-hidden="true" />
      New contact
    </button>
  );

  const tabs = (
    <div className="tabs" role="tablist" aria-label="Filter by status">
      {TABS.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          className="tab"
          aria-selected={tab === t.value}
          data-state={tab === t.value ? "active" : "inactive"}
          onClick={() => setTab(t.value)}
        >
          {t.label}
          <span className="tab-count">{counts[t.value]}</span>
        </button>
      ))}
    </div>
  );

  return (
    <main className="main">
      <div className="page-top">
        <div>
          <h1 className="page-title">Contacts</h1>
          <p className="page-sub">The people you deal with, from leads to customers.</p>
        </div>
        {addButton}
      </div>
      <PageState query={contacts}>
        {() => (
          <section className="panel panel-flush">
            <DataTable
              data={shown}
              filterKey={tab}
              columns={columns}
              label="Contacts"
              searchPlaceholder="Search contacts"
              toolbar={tabs}
              rowHref={(c) => `/contacts/${c.id}`}
              rowName={(c) => c.name}
              onEdit={setEditing}
              onDelete={setDeleting}
              emptyLine={
                tab === "all" ? "Nothing here yet. Add your first contact." : "No contacts with this status yet."
              }
              emptyAction={tab === "all" ? addButton : undefined}
            />
          </section>
        )}
      </PageState>
      <ContactForm open={adding} onOpenChange={setAdding} />
      <ContactForm open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} contact={editing ?? undefined} />
      {deleting && (
        <ConfirmDelete kind="contact" id={deleting.id} open onOpenChange={(o) => !o && setDeleting(null)} />
      )}
    </main>
  );
}
