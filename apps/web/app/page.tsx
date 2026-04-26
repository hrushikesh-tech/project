import Link from "next/link";

import { Button, DataTableShell, FormField } from "@amdox/ui";

export default function Home() {
  return (
    <main className="page-shell" style={{ paddingBlock: "1.5rem 2rem" }}>
      <div className="page-stack">
        <section className="surface hero-surface">
          <div className="page-stack">
            <div className="pill">Phase 12 Wave 1</div>
            <div>
              <div className="eyebrow">Next.js 15 Baseline</div>
              <h1 style={{ marginBottom: "0.5rem", fontSize: "clamp(2.4rem, 5vw, 4rem)" }}>
                Amdox ERP frontend foundation
              </h1>
              <p className="muted" style={{ margin: 0, maxWidth: "58rem", lineHeight: 1.7 }}>
                The web app has been realigned to a proper App Router baseline with
                route-group seams, shared UI primitives, and provider composition
                ready for the rest of Phase 12.
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
              <Link href="/login" className="focus-ring">
                <Button size="md">Go to sign-in flow</Button>
              </Link>
              <Link href="/dashboard" className="focus-ring">
                <Button intent="secondary" size="md">
                  Preview dashboard shell
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="grid-cards">
          <DataTableShell
            title="Operational table baseline"
            description="Sorting, search, loading, empty, and action seams are now centralized in the UI package."
            searchPlaceholder="Search journals, invoices, employees..."
            columns={["Module", "Shared behavior", "Next wave"]}
            rows={[
              ["Finance", "Dense table shell, export slot, loading state", "Journal entry + reports"],
              ["HR", "Filter/search/pagination seam", "Employee and leave surfaces"],
              ["Projects", "Table foundation for task lists", "Gantt integration"],
            ]}
          />

          <div className="surface" style={{ padding: "1.25rem", display: "grid", gap: "1rem" }}>
            <div>
              <div className="eyebrow">Shared form field</div>
              <h2 style={{ marginBottom: "0.35rem" }}>Accessible form baseline</h2>
              <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
                Labels, help text, error text, and required indicators now live in
                the shared UI package so later flows stay consistent by default.
              </p>
            </div>
            <form style={{ display: "grid", gap: "1rem" }}>
              <FormField
                id="tenant-code"
                label="Tenant code"
                helpText="Used by the upcoming auth flow to route users into the correct ERP tenant."
                inputProps={{ placeholder: "acme-india" }}
              />
              <FormField
                id="workspace"
                label="Workspace"
                required
                error="Role-home routing arrives in Wave 2 once auth is connected."
                inputProps={{ placeholder: "finance-ops" }}
              />
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
