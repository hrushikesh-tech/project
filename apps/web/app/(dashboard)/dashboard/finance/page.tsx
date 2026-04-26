"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";

import { AppDataTable } from "@/components/data-table/app-data-table";
import { ModuleHomeHero } from "@/components/module-home/module-home-hero";
import { getFinanceOverview, getJournalEntries, type JournalEntryRow } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";

import { Button } from "@amdox/ui";

const columns: ColumnDef<JournalEntryRow>[] = [
  { accessorKey: "entryNumber", header: "Entry" },
  { accessorKey: "description", header: "Description" },
  { accessorKey: "period", header: "Period" },
  { accessorKey: "status", header: "Status" },
  {
    accessorKey: "debit",
    header: "Debit",
    cell: ({ row }) => row.original.debit.toLocaleString("en-IN"),
  },
  {
    accessorKey: "credit",
    header: "Credit",
    cell: ({ row }) => row.original.credit.toLocaleString("en-IN"),
  },
];

export default function FinancePage() {
  const { data: session } = useSession();
  const accessToken = session?.accessToken;

  const financeOverview = useQuery({
    queryKey: queryKeys.financeOverview,
    queryFn: () => getFinanceOverview({ accessToken }),
  });

  const journalEntries = useQuery({
    queryKey: queryKeys.journalEntries,
    queryFn: () => getJournalEntries({ accessToken }),
  });

  return (
    <section className="page-stack">
      <ModuleHomeHero
        eyebrow="Finance"
        title="Close-week operations and journal readiness"
        description="Keep journals, approvals, and FX-sensitive work inside one dense finance surface. The same shared table and form behavior carries across finance, AP/AR, and the people workflows that feed it."
        badge="UI-03 + UI-05 live"
      />

      <section className="grid-cards">
        {(financeOverview.data?.metrics ?? []).map((metric) => (
          <article key={metric.label} className="surface" style={{ padding: "1.25rem" }}>
            <div className="eyebrow">{metric.label}</div>
            <h3 style={{ margin: "0.4rem 0" }}>{metric.value}</h3>
            <p className="muted" style={{ margin: 0 }}>
              {metric.trend}
            </p>
          </article>
        ))}
      </section>

      <section className="surface" style={{ padding: "1.25rem", display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow">Journal workflow</div>
          <h2 style={{ marginBottom: "0.35rem" }}>Real-time balance and FX preview</h2>
          <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
            Build balanced journals with live debit and credit feedback before you post.
          </p>
        </div>
        <Link href="/dashboard/finance/journal-entry">
          <Button type="button">Open journal entry</Button>
        </Link>
      </section>

      <AppDataTable
        title="Journal queue"
        description="Sorting, search, pagination, export, and shell-standard state handling are shared here."
        columns={columns}
        data={journalEntries.data ?? []}
        isLoading={journalEntries.isLoading}
        error={journalEntries.isError ? "Finance data could not be loaded." : null}
        onRetry={() => void journalEntries.refetch()}
        searchPlaceholder="Search journal entries"
      />
    </section>
  );
}
