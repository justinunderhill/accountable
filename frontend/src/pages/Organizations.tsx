import { Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useOrganizations } from "../api/queries";
import type { Organization } from "../api/types";
import { ConfirmDelete } from "../components/ConfirmDelete";
import { DataTable, columnHelper, type TableColumn } from "../components/DataTable";
import { OrganizationForm } from "../components/forms/OrganizationForm";
import { PageState } from "../components/ui/PageState";

const col = columnHelper<Organization>();
const columns: TableColumn<Organization>[] = [
  col.accessor("name", {
    header: "Name",
    cell: (info) => (
      <Link className="row-link" to={`/organizations/${info.row.original.id}`}>
        {info.getValue()}
      </Link>
    ),
  }),
  col.accessor((o) => o.industry ?? undefined, {
    id: "industry",
    header: "Industry",
    sortUndefined: "last",
    meta: { emptyText: "None" },
    cell: (info) => info.getValue() ?? <span className="none">None</span>,
  }),
  col.accessor((o) => o.website ?? undefined, {
    id: "website",
    header: "Website",
    sortUndefined: "last",
    meta: { emptyText: "None" },
    cell: (info) => {
      const url = info.getValue();
      return url ? (
        <a href={url} target="_blank" rel="noreferrer">
          {url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
        </a>
      ) : (
        <span className="none">None</span>
      );
    },
  }),
  col.accessor("contact_count", { header: "Contacts", meta: { numeric: true }, enableGlobalFilter: false }),
  col.accessor("open_deal_count", { header: "Open deals", meta: { numeric: true }, enableGlobalFilter: false }),
];

export function Organizations() {
  const organizations = useOrganizations();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [deleting, setDeleting] = useState<Organization | null>(null);

  const addButton = (
    <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
      <Plus size={16} aria-hidden="true" />
      New organization
    </button>
  );

  return (
    <main className="main">
      <div className="page-top">
        <div>
          <h1 className="page-title">Organizations</h1>
          <p className="page-sub">The companies you do business with.</p>
        </div>
        {addButton}
      </div>
      <PageState query={organizations}>
        {(data) => (
          <section className="panel panel-flush">
            <DataTable
              data={data}
              columns={columns}
              label="Organizations"
              searchPlaceholder="Search organizations"
              rowHref={(o) => `/organizations/${o.id}`}
              rowName={(o) => o.name}
              onEdit={setEditing}
              onDelete={setDeleting}
              emptyLine="Nothing here yet. Add your first organization."
              emptyAction={addButton}
            />
          </section>
        )}
      </PageState>
      <OrganizationForm open={adding} onOpenChange={setAdding} />
      <OrganizationForm
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        organization={editing ?? undefined}
      />
      {deleting && (
        <ConfirmDelete
          kind="organization"
          id={deleting.id}
          open
          onOpenChange={(open) => !open && setDeleting(null)}
        />
      )}
    </main>
  );
}
