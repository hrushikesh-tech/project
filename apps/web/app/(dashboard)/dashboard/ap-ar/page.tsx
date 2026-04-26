"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";

import { AppDataTable } from "@/components/data-table/app-data-table";
import { ModuleHomeHero } from "@/components/module-home/module-home-hero";
import { getAparOverview, getInvoices, type InvoiceRow } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";

import { Button } from "@amdox/ui";

const columns: ColumnDef<InvoiceRow>[] = [
  { accessorKey: "invoiceNumber", header: "Invoice" },
  { accessorKey: "counterparty", header: "Counterparty" },
  { accessorKey: "type", header: "Type" },
  { accessorKey: "status", header: "Status" },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => row.original.amount.toLocaleString("en-IN"),
  },
  { accessorKey: "dueDate", header: "Due" },
];

export default function AparPage() {
  const { data: session } = useSession();
  const accessToken = session?.accessToken;

  const aparOverview = useQuery({
    queryKey: queryKeys.aparOverview,
    queryFn: () => getAparOverview({ accessToken }),
  });

  const invoices = useQuery({
    queryKey: queryKeys.invoices,
    queryFn: () => getInvoices({ accessToken }),
  });

  return (
    <section className="page-stack">
      <ModuleHomeHero
        eyebrow="AP / AR"
        title="Invoice review, due dates, and collections"
        description="Track the payable and receivable queue with the same dense table behavior used by finance, then move into the detailed invoice workspace when something needs action."
        badge="Shared operational surface"
      />

      <section className="grid-cards">
        {(aparOverview.data?.metrics ?? []).map((metric) => (
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
          <div className="eyebrow">Invoice workspace</div>
          <h2 style={{ marginBottom: "0.35rem" }}>Approval and collection follow-through</h2>
          <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
            Review aging-sensitive invoices without leaving the shell.
          </p>
        </div>
        <Link href="/dashboard/ap-ar/invoices">
          <Button type="button">Open invoices</Button>
        </Link>
      </section>

      <AppDataTable
        title="Invoice queue"
        description="Sort the queue by due date, type, amount, or status before drilling into detailed work."
        columns={columns}
        data={invoices.data ?? []}
        isLoading={invoices.isLoading}
        error={invoices.isError ? "Invoice data could not be loaded." : null}
        onRetry={() => void invoices.refetch()}
        searchPlaceholder="Search invoices"
      />
    </section>
  );
}
