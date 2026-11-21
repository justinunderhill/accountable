import {
  columnFilteringFeature,
  constructFilterFn,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef,
  type PaginationState,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Pencil, Search, Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";

export const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text, basic: sortFn_basic },
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString },
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TableColumn<T extends RowData> = ColumnDef<typeof features, T, any>;

export function columnHelper<T extends RowData>() {
  return createColumnHelper<typeof features, T>();
}

export interface ColumnMeta {
  /** Numbers and money are right-aligned in JetBrains Mono. */
  numeric?: boolean;
  /** What the column shows when it has no value, such as "No organization", so search finds it too. */
  emptyText?: string;
}

export const PAGE_SIZE = 50;

interface DataTableProps<T extends { id: number }> {
  data: T[];
  columns: TableColumn<T>[];
  /** The record's page, opened by clicking its row. */
  rowHref: (row: T) => string;
  /** The record's name, for the edit and delete buttons' labels. */
  rowName: (row: T) => string;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  searchPlaceholder?: string;
  /** Shown when there are no records at all. */
  emptyLine: string;
  emptyAction?: ReactNode;
  /** Controls above the table, beside the search box. */
  toolbar?: ReactNode;
  /** A small table inside a record page: no search, no paging. */
  compact?: boolean;
  label: string;
  /** Changing this, for example on picking another status tab, goes back to the first page. */
  filterKey?: string;
}

const EMPTY_SORT: SortingState = [];

export function DataTable<T extends { id: number }>({
  data,
  columns,
  rowHref,
  rowName,
  onEdit,
  onDelete,
  searchPlaceholder = "Search",
  emptyLine,
  emptyAction,
  toolbar,
  compact,
  label,
  filterKey = "",
}: DataTableProps<T>) {
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>(EMPTY_SORT);
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: compact ? 10_000 : PAGE_SIZE,
  });

  // A new filter outside the table starts again from the first page.
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }

  // Search the text each column shows, ignoring case, including its text for an empty value.
  const searchFn = useMemo(() => {
    const emptyText = new Map(
      columns.map((c) => {
        const def = c as { id?: string; accessorKey?: string; meta?: ColumnMeta };
        return [def.id ?? def.accessorKey ?? "", def.meta?.emptyText ?? ""];
      }),
    );
    return constructFilterFn({
      filter: (value: unknown, search: string, _row: unknown, columnId: string) => {
        const text = value === null || value === undefined || value === "" ? emptyText.get(columnId) ?? "" : String(value);
        return text.toLowerCase().includes(search);
      },
      resolveFilterValue: (search: unknown) => String(search).toLowerCase(),
      autoRemove: (search: unknown) => !search,
    });
  }, [columns]);

  const table = useTable({
    features,
    columns,
    data,
    getRowId: (row) => String(row.id),
    state: { sorting, globalFilter, pagination },
    // A new sort order starts from the first page.
    onSortingChange: (updater) => {
      setSorting(updater);
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    },
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    // Saving a record refreshes the data; stay on the page you were on.
    autoResetPageIndex: false,
    globalFilterFn: searchFn,
    getColumnCanGlobalFilter: () => true,
    // Each heading cycles ascending, descending, then back to the default order.
    enableSortingRemoval: true,
    sortDescFirst: false,
    enableMultiSort: false,
  });

  const total = table.getFilteredRowModel().rows.length;
  // If rows went away, such as after a delete on the last page, show the last page that has rows.
  const lastPage = Math.max(0, Math.ceil(total / pagination.pageSize) - 1);
  if (pagination.pageIndex > lastPage) setPagination((p) => ({ ...p, pageIndex: lastPage }));
  const rows = table.getRowModel().rows;
  const first = total === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const last = Math.min(total, (pagination.pageIndex + 1) * pagination.pageSize);
  const hasActions = Boolean(onEdit || onDelete);

  const search = (value: string) => {
    setGlobalFilter(value);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  return (
    <div className={`dt${compact ? " dt-compact" : ""}`}>
      {(!compact || toolbar) && (
        <div className="dt-toolbar">
          {toolbar}
          {!compact && (
            <label className="dt-search">
              <Search size={16} aria-hidden="true" />
              <span className="sr-only">Search {label}</span>
              <input
                type="search"
                placeholder={searchPlaceholder}
                value={globalFilter}
                onChange={(e) => search(e.target.value)}
              />
            </label>
          )}
        </div>
      )}
      {data.length === 0 ? (
        <div className="dt-empty">
          <p className="empty-line">{emptyLine}</p>
          {emptyAction}
        </div>
      ) : total === 0 ? (
        <div className="dt-empty">
          <p className="empty-line">Nothing matches "{globalFilter}".</p>
          <button type="button" className="btn btn-sm" onClick={() => search("")}>
            Clear search
          </button>
        </div>
      ) : (
        <div className="dt-scroll">
          <table className="dt-table" aria-label={label}>
            <thead>
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => {
                    const column = header.column;
                    const meta = (column.columnDef.meta ?? {}) as ColumnMeta;
                    const sorted = column.getIsSorted();
                    const canSort = column.getCanSort();
                    return (
                      <th
                        key={header.id}
                        className={meta.numeric ? "num-col" : undefined}
                        aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                      >
                        {canSort ? (
                          <button type="button" className="dt-sort" onClick={column.getToggleSortingHandler()}>
                            <table.FlexRender header={header} />
                            {sorted === "asc" && <ArrowUp size={14} aria-hidden="true" />}
                            {sorted === "desc" && <ArrowDown size={14} aria-hidden="true" />}
                          </button>
                        ) : (
                          <table.FlexRender header={header} />
                        )}
                      </th>
                    );
                  })}
                  {hasActions && (
                    <th className="dt-actions-col">
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              ))}
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="dt-row"
                  onClick={(e) => {
                    // Links and buttons inside the row do their own thing.
                    if ((e.target as HTMLElement).closest("a, button")) return;
                    navigate(rowHref(row.original));
                  }}
                >
                  {row.getAllCells().map((cell) => {
                    const meta = (cell.column.columnDef.meta ?? {}) as ColumnMeta;
                    return (
                      <td key={cell.id} className={meta.numeric ? "num-col num" : undefined}>
                        <table.FlexRender cell={cell} />
                      </td>
                    );
                  })}
                  {hasActions && (
                    <td className="dt-actions">
                      {onEdit && (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Edit ${rowName(row.original)}`}
                          title="Edit"
                          onClick={() => onEdit(row.original)}
                        >
                          <Pencil size={15} aria-hidden="true" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          className="icon-btn danger"
                          aria-label={`Delete ${rowName(row.original)}`}
                          title="Delete"
                          onClick={() => onDelete(row.original)}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!compact && total > 0 && (
        <div className="dt-foot">
          <span className="dt-count num" aria-live="polite">
            {first.toLocaleString("en-US")}–{last.toLocaleString("en-US")} of {total.toLocaleString("en-US")}
          </span>
          <div className="dt-pages">
            <button
              type="button"
              className="icon-btn"
              aria-label="Previous page"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Next page"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
