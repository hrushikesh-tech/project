import type { ReactNode } from "react";

type DataTableShellProps = {
  title: string;
  description?: string;
  searchPlaceholder?: string;
  columns: string[];
  rows: Array<Array<ReactNode>>;
  actions?: ReactNode;
};

export function DataTableShell({
  title,
  description,
  searchPlaceholder = "Search...",
  columns,
  rows,
  actions,
}: DataTableShellProps) {
  return (
    <section
      aria-label={title}
      style={{
        borderRadius: "24px",
        border: "1px solid rgba(15,23,42,0.08)",
        background: "rgba(255,255,255,0.84)",
        boxShadow: "0 24px 48px rgba(15,23,42,0.08)",
        padding: "1.25rem",
        display: "grid",
        gap: "1rem",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <div style={{ display: "grid", gap: "0.35rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem", color: "#0f172a" }}>{title}</h2>
          {description ? (
            <p style={{ margin: 0, color: "#64748b", lineHeight: 1.55 }}>{description}</p>
          ) : null}
        </div>
        {actions ? <div>{actions}</div> : null}
      </header>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "0.75rem",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          aria-label={`${title} search`}
          defaultValue=""
          placeholder={searchPlaceholder}
          style={{
            width: "min(100%, 320px)",
            borderRadius: "999px",
            border: "1px solid rgba(15,23,42,0.12)",
            padding: "0.75rem 1rem",
            background: "#fff",
          }}
        />
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", color: "#64748b" }}>
          <span>Sort</span>
          <span>Filter</span>
          <span>Export</span>
          <span>Pagination</span>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "540px" }}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  style={{
                    textAlign: "left",
                    fontSize: "0.82rem",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "#475569",
                    padding: "0.8rem 0.6rem",
                    borderBottom: "1px solid rgba(15,23,42,0.08)",
                  }}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${title}-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${title}-${rowIndex}-${cellIndex}`}
                    style={{
                      padding: "0.9rem 0.6rem",
                      color: "#0f172a",
                      borderBottom: "1px solid rgba(15,23,42,0.06)",
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "0.75rem",
          flexWrap: "wrap",
          color: "#64748b",
          fontSize: "0.9rem",
        }}
      >
        <span>Loading, empty, and error slots attach here in later module plans.</span>
        <span>Rows shown: {rows.length}</span>
      </footer>
    </section>
  );
}
