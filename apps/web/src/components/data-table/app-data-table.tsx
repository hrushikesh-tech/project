"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { Download, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@amdox/ui";

type AppDataTableProps<TData, TValue> = {
  title: string;
  description?: string;
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyState?: string;
};

export function AppDataTable<TData, TValue>({
  title,
  description,
  columns,
  data,
  searchPlaceholder = "Search records...",
  isLoading = false,
  error = null,
  onRetry,
  emptyState = "No matching records found.",
}: AppDataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    columns,
    data,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const exportRows = useMemo(
    () =>
      table
        .getFilteredRowModel()
        .rows.map((row) => JSON.stringify(row.original))
        .join("\n"),
    [table],
  );

  function handleExport() {
    const blob = new Blob([exportRows], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.toLowerCase().replace(/\s+/g, "-")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="surface" style={{ padding: "1.25rem", display: "grid", gap: "1rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow">Operational table</div>
          <h2 style={{ marginBottom: "0.35rem" }}>{title}</h2>
          {description ? (
            <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
              {description}
            </p>
          ) : null}
        </div>
        <Button type="button" intent="ghost" onClick={handleExport}>
          <Download size={16} />
          Export
        </Button>
      </header>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "space-between" }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            borderRadius: "999px",
            border: "1px solid rgba(15,23,42,0.12)",
            background: "#fff",
            padding: "0.7rem 0.95rem",
            minWidth: "280px",
          }}
        >
          <Search size={16} />
          <input
            aria-label={`${title} search`}
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.currentTarget.value)}
            style={{ width: "100%", border: 0, outline: "none", background: "transparent" }}
          />
        </label>
        <div className="muted" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <span>Rows: {table.getFilteredRowModel().rows.length}</span>
          <span>
            Page {table.getState().pagination.pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
          </span>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "760px" }}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{
                      textAlign: "left",
                      padding: "0.8rem 0.65rem",
                      borderBottom: "1px solid rgba(15,23,42,0.08)",
                      fontSize: "0.8rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "#475569",
                    }}
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        style={{
                          all: "unset",
                          cursor: "pointer",
                          display: "inline-flex",
                          gap: "0.35rem",
                          alignItems: "center",
                        }}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === "asc"
                          ? "Up"
                          : header.column.getIsSorted() === "desc"
                            ? "Down"
                            : null}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: "1rem 0.65rem", color: "#64748b" }}>
                  Loading records...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: "1rem 0.65rem", color: "#b91c1c" }}>
                  <div style={{ display: "grid", gap: "0.75rem" }}>
                    <span>{error}</span>
                    {onRetry ? (
                      <div>
                        <Button type="button" intent="ghost" onClick={onRetry}>
                          Retry
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={{
                        padding: "0.85rem 0.65rem",
                        borderBottom: "1px solid rgba(15,23,42,0.06)",
                        color: "#0f172a",
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} style={{ padding: "1rem 0.65rem", color: "#64748b" }}>
                  {emptyState}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <footer style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Button
            type="button"
            intent="ghost"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            Previous
          </Button>
          <Button
            type="button"
            intent="ghost"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            Next
          </Button>
        </div>
        <span className="muted">Loading, error, empty, search, sort, pagination, and export are standardized here.</span>
      </footer>
    </section>
  );
}
