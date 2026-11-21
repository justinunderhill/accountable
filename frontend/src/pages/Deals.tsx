import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useDeals } from "../api/queries";
import type { Deal } from "../api/types";
import { ConfirmDelete } from "../components/ConfirmDelete";
import { DataTable, columnHelper, type TableColumn } from "../components/DataTable";
import { DealForm } from "../components/forms/DealForm";
import { LateBadge, StageBadge } from "../components/ui/Badge";
import { PageState } from "../components/ui/PageState";
import { formatDate, formatMoney } from "../lib/format";
import { STAGE_KEYS, stageName, type Stage } from "../lib/stages";

const col = columnHelper<Deal>();

export const dealColumns = {
  name: col.accessor("name", {
    header: "Name",
    cell: (info) => (
      <Link className="row-link" to={`/deals/${info.row.original.id}`}>
        {info.getValue()}
      </Link>
    ),
  }),
  organization: col.accessor((d) => d.organization_name ?? undefined, {
    id: "organization",
    header: "Organization",
    sortUndefined: "last",
    meta: { emptyText: "No organization" },
    cell: (info) => {
      const d = info.row.original;
      return d.organization_id ? (
        <Link to={`/organizations/${d.organization_id}`}>{d.organization_name}</Link>
      ) : (
        <span className="none">No organization</span>
      );
    },
  }),
  contact: col.accessor("contact_name", {
    header: "Contact",
    cell: (info) => <Link to={`/contacts/${info.row.original.contact_id}`}>{info.getValue()}</Link>,
  }),
  stage: col.accessor("stage", {
    header: "Stage",
    sortFn: (a: { original: Deal }, b: { original: Deal }) =>
      STAGE_KEYS.indexOf(a.original.stage) - STAGE_KEYS.indexOf(b.original.stage),
    cell: (info) => <StageBadge stage={info.getValue()} />,
  }),
  value: col.accessor("value_cents", {
    header: "Value (USD)",
    meta: { numeric: true },
    enableGlobalFilter: false,
    cell: (info) => formatMoney(info.getValue()),
  }),
  probability: col.accessor("probability", {
    header: "Probability",
    meta: { numeric: true },
    enableGlobalFilter: false,
    cell: (info) => (
      <span title={info.row.original.probability_by_hand ? "Set by hand" : undefined}>
        {info.getValue()}%{info.row.original.probability_by_hand ? "*" : ""}
      </span>
    ),
  }),
  expected: col.accessor("expected_cents", {
    header: "Expected (USD)",
    meta: { numeric: true },
    enableGlobalFilter: false,
    cell: (info) => formatMoney(info.getValue()),
  }),
  closeDate: col.accessor("close_date", {
    header: "Close date",
    meta: { numeric: true },
    enableGlobalFilter: false,
    cell: (info) => {
      const d = info.row.original;
      return (
        <span className="date-late">
          {d.late && <LateBadge />}
          <span className={`date-cell${d.late ? " late" : ""}`}>{formatDate(info.getValue())}</span>
        </span>
      );
    },
  }),
};

const columns: TableColumn<Deal>[] = [
  dealColumns.name,
  dealColumns.organization,
  dealColumns.contact,
  dealColumns.stage,
  dealColumns.value,
  dealColumns.probability,
  dealColumns.expected,
  dealColumns.closeDate,
];

export function Deals() {
  const deals = useDeals();
  // The board's Won and Lost columns link here, filtered to that stage.
  const [params] = useSearchParams();
  const param = params.get("stage");
  const stage = STAGE_KEYS.includes(param as Stage) ? (param as Stage) : null;
  const data = deals.data;
  const shown = useMemo(() => (stage ? data?.filter((d) => d.stage === stage) : data) ?? [], [data, stage]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [deleting, setDeleting] = useState<Deal | null>(null);

  const addButton = (
    <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
      <Plus size={16} aria-hidden="true" />
      New deal
    </button>
  );

  return (
    <main className="main">
      <div className="page-top">
        <div>
          <h1 className="page-title">Deals</h1>
          <p className="page-sub">Every deal, soonest close date first. A * marks a probability set by hand.</p>
        </div>
        {addButton}
      </div>
      <PageState query={deals}>
        {() => (
          <section className="panel panel-flush">
            <DataTable
              data={shown}
              filterKey={stage ?? ""}
              toolbar={
                stage && (
                  <p className="filter-note">
                    Showing {stageName(stage).toLowerCase()} deals only. <Link to="/deals">Show every deal</Link>
                  </p>
                )
              }
              columns={columns}
              label="Deals"
              searchPlaceholder="Search deals"
              rowHref={(d) => `/deals/${d.id}`}
              rowName={(d) => d.name}
              onEdit={setEditing}
              onDelete={setDeleting}
              emptyLine="Nothing here yet. Add your first deal."
              emptyAction={addButton}
            />
          </section>
        )}
      </PageState>
      <DealForm open={adding} onOpenChange={setAdding} />
      <DealForm open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} deal={editing ?? undefined} />
      {deleting && <ConfirmDelete kind="deal" id={deleting.id} open onOpenChange={(o) => !o && setDeleting(null)} />}
    </main>
  );
}
