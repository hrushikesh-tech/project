"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";

import { AppDataTable } from "@/components/data-table/app-data-table";
import { getInvoices, type InvoiceRow } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";

const columns: ColumnDef<InvoiceRow>[] = [
  { accessorKey: "invoiceNumber", header: "Invoice" },
  { accessorKey: "counterparty", header: "Counterparty" },
  { accessorKey: "type", header: "Type" },
  { accessorKey: "status", header: "Status" },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => `INR ${row.original.amount.toLocaleString("en-IN")}`,
  },
  { accessorKey: "dueDate", header: "Due date" },
];

export default function InvoicesPage() {
  const { data: session } = useSession();
  const invoices = useQuery({
    queryKey: queryKeys.invoices,
    queryFn: () => getInvoices({ accessToken: session?.accessToken }),
  });

  return (
    <AppDataTable
      title="Invoices"
      description="This dense AP/AR view keeps the review queue, due dates, and cash-impacting work inside a single searchable table."
      columns={columns}
      data={invoices.data ?? []}
      isLoading={invoices.isLoading}
      error={invoices.isError ? "Invoices could not be loaded." : null}
      onRetry={() => void invoices.refetch()}
      searchPlaceholder="Search invoice number, counterparty, or status"
    />
  );
}
