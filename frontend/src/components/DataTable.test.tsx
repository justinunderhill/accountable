import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { renderWithApp } from "../test/render";
import { DataTable, columnHelper, type TableColumn } from "./DataTable";

interface Row {
  id: number;
  name: string;
  city: string;
  amount: number;
}

const col = columnHelper<Row>();
const columns: TableColumn<Row>[] = [
  col.accessor("name", { header: "Name" }),
  col.accessor("city", { header: "City" }),
  col.accessor("amount", { header: "Amount", meta: { numeric: true }, enableGlobalFilter: false }),
];

// 120 rows in a fixed "default" order that isn't alphabetical.
const CITIES = ["Boston", "Austin", "Chicago"];
const ROWS: Row[] = Array.from({ length: 120 }, (_, i) => ({
  id: i + 1,
  name: `Company ${String((i * 37) % 120).padStart(3, "0")}`,
  city: CITIES[i % 3],
  amount: i * 10,
}));

function names() {
  const table = screen.getByRole("table");
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0].textContent);
}

/** A table whose data changes the way a save refreshes it: a new array each time. */
function Refreshing() {
  const [rows, setRows] = useState(ROWS);
  const [filter, setFilter] = useState("a");
  return (
    <>
      <button type="button" onClick={() => setRows((r) => r.map((x, i) => (i === 60 ? { ...x, city: "Edited" } : { ...x })))}>
        Edit a row
      </button>
      <button type="button" onClick={() => setRows((r) => r.slice(0, r.length - 30))}>
        Delete 30 rows
      </button>
      <button type="button" onClick={() => setFilter((f) => f + "a")}>
        Change filter
      </button>
      <DataTable
        data={rows}
        columns={columns}
        filterKey={filter}
        label="Companies"
        rowHref={(r) => `/companies/${r.id}`}
        rowName={(r) => r.name}
        emptyLine="None"
      />
    </>
  );
}

function renderTable(rows = ROWS) {
  renderWithApp(
    <DataTable
      data={rows}
      columns={columns}
      label="Companies"
      rowHref={(r) => `/companies/${r.id}`}
      rowName={(r) => r.name}
      emptyLine="Nothing here yet. Add your first company."
    />,
  );
}

describe("DataTable", () => {
  it("shows 50 rows to a page with a count", async () => {
    const user = userEvent.setup();
    renderTable();
    expect(names()).toHaveLength(50);
    expect(screen.getByText("1–50 of 120")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("51–100 of 120")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("101–120 of 120")).toBeInTheDocument();
    expect(names()).toHaveLength(20);
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("searches across the shown text columns, ignoring case", async () => {
    const user = userEvent.setup();
    renderTable();
    const search = screen.getByRole("searchbox", { name: "Search Companies" });

    await user.type(search, "AUSTIN");
    expect(screen.getByText("1–40 of 40")).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "company 007");
    expect(names()).toEqual(["Company 007"]);

    await user.clear(search);
    await user.type(search, "nowhere");
    expect(screen.getByText('Nothing matches "nowhere".')).toBeInTheDocument();
  });

  it("goes back to the first page when searching", async () => {
    const user = userEvent.setup();
    renderTable();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await user.type(screen.getByRole("searchbox"), "boston");
    expect(screen.getByText("1–40 of 40")).toBeInTheDocument();
  });

  it("cycles a heading through ascending, descending and the default order", async () => {
    const user = userEvent.setup();
    renderTable();
    const original = names();
    const heading = screen.getByRole("button", { name: "Name" });

    await user.click(heading);
    expect(names()[0]).toBe("Company 000");
    expect(screen.getByRole("columnheader", { name: /Name/ })).toHaveAttribute("aria-sort", "ascending");

    await user.click(heading);
    expect(names()[0]).toBe("Company 119");
    expect(screen.getByRole("columnheader", { name: /Name/ })).toHaveAttribute("aria-sort", "descending");

    await user.click(heading);
    expect(names()).toEqual(original);
    expect(screen.getByRole("columnheader", { name: /Name/ })).not.toHaveAttribute("aria-sort");
  });

  it("sorts numbers as numbers, smallest first", async () => {
    const user = userEvent.setup();
    renderTable();
    await user.click(screen.getByRole("button", { name: "Amount" }));
    const first = within(screen.getAllByRole("row")[1]).getAllByRole("cell")[2];
    expect(first).toHaveTextContent("0");
    await user.click(screen.getByRole("button", { name: "Amount" }));
    const top = within(screen.getAllByRole("row")[1]).getAllByRole("cell")[2];
    expect(top).toHaveTextContent("1190");
  });

  it("stays on the same page when the data is refreshed after a save", async () => {
    const user = userEvent.setup();
    renderWithApp(<Refreshing />);
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("51–100 of 120")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit a row" }));
    expect(screen.getByText("51–100 of 120")).toBeInTheDocument();
    expect(screen.getByText("Edited")).toBeInTheDocument();
  });

  it("moves to the last page that has rows when rows go away", async () => {
    const user = userEvent.setup();
    renderWithApp(<Refreshing />);
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("101–120 of 120")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete 30 rows" }));
    expect(screen.getByText("51–90 of 90")).toBeInTheDocument();
  });

  it("goes back to the first page when a filter outside the table changes, or the sort changes", async () => {
    const user = userEvent.setup();
    renderWithApp(<Refreshing />);
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await user.click(screen.getByRole("button", { name: "Change filter" }));
    expect(screen.getByText("1–50 of 120")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await user.click(screen.getByRole("button", { name: "Name" }));
    expect(screen.getByText("1–50 of 120")).toBeInTheDocument();
  });

  it("finds rows by the text a column shows when it's empty", async () => {
    const user = userEvent.setup();
    const rows = ROWS.slice(0, 5).map((r, i) => ({ ...r, city: i < 2 ? "" : r.city }));
    const withEmpty: TableColumn<Row>[] = [
      col.accessor("name", { header: "Name" }),
      col.accessor((r) => r.city || undefined, { id: "city", header: "City", meta: { emptyText: "No city" } }),
    ];
    renderWithApp(
      <DataTable
        data={rows}
        columns={withEmpty}
        label="Companies"
        rowHref={(r) => `/companies/${r.id}`}
        rowName={(r) => r.name}
        emptyLine="None"
      />,
    );
    await user.type(screen.getByRole("searchbox"), "NO CITY");
    expect(screen.getByText("1–2 of 2")).toBeInTheDocument();
  });

  it("has an empty state", () => {
    renderTable([]);
    expect(screen.getByText("Nothing here yet. Add your first company.")).toBeInTheDocument();
  });
});
