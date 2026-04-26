"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";

import { AppDataTable } from "@/components/data-table/app-data-table";
import { ModuleHomeHero } from "@/components/module-home/module-home-hero";
import { getEmployees, getHrOverview, type EmployeeRow } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";

import { Button } from "@amdox/ui";

const columns: ColumnDef<EmployeeRow>[] = [
  { accessorKey: "employeeCode", header: "Code" },
  { accessorKey: "name", header: "Employee" },
  { accessorKey: "department", header: "Department" },
  { accessorKey: "status", header: "Status" },
  { accessorKey: "manager", header: "Manager" },
];

export default function HrPage() {
  const { data: session } = useSession();
  const accessToken = session?.accessToken;

  const hrOverview = useQuery({
    queryKey: queryKeys.hrOverview,
    queryFn: () => getHrOverview({ accessToken }),
  });

  const employees = useQuery({
    queryKey: queryKeys.employees,
    queryFn: () => getEmployees({ accessToken }),
  });

  return (
    <section className="page-stack">
      <ModuleHomeHero
        eyebrow="HR"
        title="People operations with the same dense ERP rhythm"
        description="Employees, leave-sensitive work, and lifecycle monitoring stay in the unified shell with the same filter, sort, pagination, and validation patterns used by finance."
        badge="Shared table + form layer"
      />

      <section className="grid-cards">
        {(hrOverview.data?.metrics ?? []).map((metric) => (
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
          <div className="eyebrow">Employee workspace</div>
          <h2 style={{ marginBottom: "0.35rem" }}>Roster, lifecycle, and leave context</h2>
          <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
            Inspect the roster with the same keyboard-friendly table behavior used across the ERP shell.
          </p>
        </div>
        <Link href="/dashboard/hr/employees">
          <Button type="button">Open employees</Button>
        </Link>
      </section>

      <AppDataTable
        title="Employee roster"
        description="Cross-team people operations without leaving the shared shell."
        columns={columns}
        data={employees.data ?? []}
        isLoading={employees.isLoading}
        error={employees.isError ? "Employee data could not be loaded." : null}
        onRetry={() => void employees.refetch()}
        searchPlaceholder="Search employees"
      />
    </section>
  );
}
