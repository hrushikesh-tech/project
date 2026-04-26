"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";

import { AppDataTable } from "@/components/data-table/app-data-table";
import { getEmployees, type EmployeeRow } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";

const columns: ColumnDef<EmployeeRow>[] = [
  { accessorKey: "employeeCode", header: "Code" },
  { accessorKey: "name", header: "Employee" },
  { accessorKey: "department", header: "Department" },
  { accessorKey: "status", header: "Status" },
  { accessorKey: "manager", header: "Manager" },
];

export default function EmployeesPage() {
  const { data: session } = useSession();
  const employees = useQuery({
    queryKey: queryKeys.employees,
    queryFn: () => getEmployees({ accessToken: session?.accessToken }),
  });

  return (
    <AppDataTable
      title="Employees"
      description="This is the dense roster view for HR managers handling lifecycle, leave, and organization follow-through."
      columns={columns}
      data={employees.data ?? []}
      isLoading={employees.isLoading}
      error={employees.isError ? "Employees could not be loaded." : null}
      onRetry={() => void employees.refetch()}
      searchPlaceholder="Search employees, departments, or managers"
    />
  );
}
