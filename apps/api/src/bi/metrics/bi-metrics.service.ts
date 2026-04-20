import { Injectable } from "@nestjs/common";
import {
  AccountType,
  JournalEntryStatus as DbJournalEntryStatus,
  Prisma,
} from "@amdox/db";
import {
  BI_METRIC_KEYS,
  BiMetricFilters,
  BiMetricKey,
  BiMetricResult,
  EmployeeStatus,
  InventoryMovementType,
  UnsupportedMetricKey,
} from "@amdox/types";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class BiMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetric(
    tenantId: string,
    metricKey: string,
    filters: BiMetricFilters,
  ): Promise<BiMetricResult> {
    if (!BI_METRIC_KEYS.includes(metricKey as BiMetricKey)) {
      throw new UnsupportedMetricKey(metricKey);
    }

    switch (metricKey as BiMetricKey) {
      case "revenue_by_month":
        return this.revenueByMonth(tenantId, filters);
      case "expense_by_category":
        return this.expenseByCategory(tenantId, filters);
      case "headcount_by_department":
        return this.headcountByDepartment(tenantId, filters);
      case "inventory_value_by_warehouse":
        return this.inventoryValueByWarehouse(tenantId, filters);
      case "po_approval_cycle_time":
        return this.poApprovalCycleTime(tenantId, filters);
      case "leave_utilisation_by_type":
        return this.leaveUtilisationByType(tenantId, filters);
      case "project_budget_vs_actual":
        return this.projectBudgetVsActual(tenantId, filters);
      case "demand_forecast_accuracy":
        return this.demandForecastAccuracy(tenantId, filters);
      default:
        throw new UnsupportedMetricKey(metricKey);
    }
  }

  private async revenueByMonth(
    tenantId: string,
    filters: BiMetricFilters,
  ): Promise<BiMetricResult> {
    const db = this.prisma.forTenant(tenantId);
    const lines = await db.journalLine.findMany({
      where: {
        deletedAt: null,
        account: { type: AccountType.REVENUE },
        journalEntry: {
          deletedAt: null,
          status: DbJournalEntryStatus.POSTED,
          legalEntityId: filters.legalEntityId,
          ...(filters.startDate || filters.endDate
            ? {
                date: {
                  gte: filters.startDate
                    ? new Date(filters.startDate)
                    : undefined,
                  lte: filters.endDate ? new Date(filters.endDate) : undefined,
                },
              }
            : {}),
        },
      },
      include: {
        journalEntry: true,
      },
      orderBy: [{ journalEntry: { date: "asc" } }],
    });

    const buckets = new Map<string, number>();
    for (const line of lines) {
      const month = line.journalEntry.date.toISOString().slice(0, 7);
      buckets.set(
        month,
        (buckets.get(month) ?? 0) + Number(line.credit - line.debit),
      );
    }

    const points = [...buckets.entries()].map(([key, value]) => ({
      key,
      label: key,
      value,
    }));

    return {
      metricKey: "revenue_by_month",
      generatedAt: new Date().toISOString(),
      summary: {
        value: points.reduce((sum, point) => sum + point.value, 0),
        label: "Total revenue",
        unit: "minor",
      },
      points,
    };
  }

  private async expenseByCategory(
    tenantId: string,
    filters: BiMetricFilters,
  ): Promise<BiMetricResult> {
    const db = this.prisma.forTenant(tenantId);
    const lines = await db.journalLine.findMany({
      where: {
        deletedAt: null,
        account: { type: AccountType.EXPENSE },
        journalEntry: {
          deletedAt: null,
          status: DbJournalEntryStatus.POSTED,
          legalEntityId: filters.legalEntityId,
          ...(filters.startDate || filters.endDate
            ? {
                date: {
                  gte: filters.startDate
                    ? new Date(filters.startDate)
                    : undefined,
                  lte: filters.endDate ? new Date(filters.endDate) : undefined,
                },
              }
            : {}),
        },
      },
      include: {
        account: true,
      },
      orderBy: [{ account: { code: "asc" } }],
    });

    const buckets = new Map<string, number>();
    for (const line of lines) {
      const key = line.account.code;
      buckets.set(
        key,
        (buckets.get(key) ?? 0) + Number(line.debit - line.credit),
      );
    }

    const points = [...buckets.entries()].map(([key, value]) => ({
      key,
      label:
        lines.find((line) => line.account.code === key)?.account.name ?? key,
      value,
    }));

    return {
      metricKey: "expense_by_category",
      generatedAt: new Date().toISOString(),
      summary: {
        value: points.reduce((sum, point) => sum + point.value, 0),
        label: "Total expense",
        unit: "minor",
      },
      points,
    };
  }

  private async headcountByDepartment(
    tenantId: string,
    filters: BiMetricFilters,
  ): Promise<BiMetricResult> {
    const db = this.prisma.forTenant(tenantId);
    const asOf = filters.asOfDate ? new Date(filters.asOfDate) : new Date();
    const employees = await db.employee.findMany({
      where: {
        deletedAt: null,
        departmentId: filters.departmentId,
      },
      include: {
        department: true,
      },
      orderBy: [{ departmentId: "asc" }],
    });

    const buckets = new Map<string, number>();
    for (const employee of employees) {
      const activeRoster =
        employee.hireDate <= asOf &&
        employee.status !== EmployeeStatus.TERMINATED &&
        (!employee.terminationDate || employee.terminationDate > asOf);
      if (!activeRoster) continue;
      const key = employee.department?.name ?? "Unassigned";
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }

    const points = [...buckets.entries()].map(([key, value]) => ({
      key,
      label: key,
      value,
    }));

    return {
      metricKey: "headcount_by_department",
      generatedAt: new Date().toISOString(),
      summary: {
        value: points.reduce((sum, point) => sum + point.value, 0),
        label: "Active headcount",
        unit: "employees",
      },
      points,
    };
  }

  private async inventoryValueByWarehouse(
    tenantId: string,
    filters: BiMetricFilters,
  ): Promise<BiMetricResult> {
    const db = this.prisma.forTenant(tenantId);
    const layers = await db.costLayer.findMany({
      where: {
        deletedAt: null,
        warehouseId: filters.warehouseId,
        remainingQuantity: {
          gt: new Prisma.Decimal("0"),
        },
      },
      include: {
        warehouse: true,
      },
      orderBy: [{ warehouseId: "asc" }, { receivedAt: "asc" }],
    });

    const buckets = new Map<string, number>();
    for (const layer of layers) {
      const key = layer.warehouse.name;
      const value = new Prisma.Decimal(String(layer.remainingQuantity))
        .mul(new Prisma.Decimal(layer.unitCost.toString()))
        .toNumber();
      buckets.set(key, (buckets.get(key) ?? 0) + value);
    }

    const points = [...buckets.entries()].map(([key, value]) => ({
      key,
      label: key,
      value,
    }));

    return {
      metricKey: "inventory_value_by_warehouse",
      generatedAt: new Date().toISOString(),
      summary: {
        value: points.reduce((sum, point) => sum + point.value, 0),
        label: "Inventory value",
        unit: "minor",
      },
      points,
    };
  }

  private async poApprovalCycleTime(
    tenantId: string,
    filters: BiMetricFilters,
  ): Promise<BiMetricResult> {
    const db = this.prisma.forTenant(tenantId);
    const approvals = await db.purchaseOrder.findMany({
      where: {
        deletedAt: null,
        status: "APPROVED",
        legalEntityId: filters.legalEntityId,
        submittedAt: { not: null },
        approvedAt: {
          not: null,
          gte: filters.startDate ? new Date(filters.startDate) : undefined,
          lte: filters.endDate ? new Date(filters.endDate) : undefined,
        },
      },
      orderBy: [{ approvedAt: "asc" }],
    });

    const buckets = new Map<string, { totalHours: number; count: number }>();
    for (const po of approvals) {
      if (!po.submittedAt || !po.approvedAt) continue;
      const month = po.approvedAt.toISOString().slice(0, 7);
      const elapsedHours =
        (po.approvedAt.getTime() - po.submittedAt.getTime()) / (1000 * 60 * 60);
      const current = buckets.get(month) ?? { totalHours: 0, count: 0 };
      current.totalHours += elapsedHours;
      current.count += 1;
      buckets.set(month, current);
    }

    const points = [...buckets.entries()].map(([key, value]) => ({
      key,
      label: key,
      value: Number((value.totalHours / value.count).toFixed(2)),
      secondaryValue: value.count,
    }));

    return {
      metricKey: "po_approval_cycle_time",
      generatedAt: new Date().toISOString(),
      summary: {
        value:
          points.length === 0
            ? 0
            : Number(
                (
                  points.reduce((sum, point) => sum + point.value, 0) /
                  points.length
                ).toFixed(2),
              ),
        label: "Average approval cycle",
        unit: "hours",
      },
      points,
    };
  }

  private async leaveUtilisationByType(
    tenantId: string,
    filters: BiMetricFilters,
  ): Promise<BiMetricResult> {
    const db = this.prisma.forTenant(tenantId);
    const start = filters.startDate
      ? new Date(filters.startDate)
      : new Date("1970-01-01T00:00:00.000Z");
    const end = filters.endDate ? new Date(filters.endDate) : new Date();

    const requests = await db.leaveRequest.findMany({
      where: {
        deletedAt: null,
        status: "APPROVED",
        startDate: { lte: end },
        endDate: { gte: start },
        ...(filters.departmentId
          ? {
              employee: {
                departmentId: filters.departmentId,
              },
            }
          : {}),
      },
      include: {
        leaveType: true,
      },
      orderBy: [{ startDate: "asc" }],
    });

    const buckets = new Map<string, number>();
    for (const request of requests) {
      const effectiveStart =
        request.startDate > start ? request.startDate : start;
      const effectiveEnd = request.endDate < end ? request.endDate : end;
      const days =
        Math.floor(
          (effectiveEnd.getTime() - effectiveStart.getTime()) /
            (1000 * 60 * 60 * 24),
        ) + 1;
      const key = request.leaveType.code;
      buckets.set(key, (buckets.get(key) ?? 0) + Math.max(days, 0));
    }

    const points = [...buckets.entries()].map(([key, value]) => ({
      key,
      label:
        requests.find((request) => request.leaveType.code === key)?.leaveType
          .name ?? key,
      value,
    }));

    return {
      metricKey: "leave_utilisation_by_type",
      generatedAt: new Date().toISOString(),
      summary: {
        value: points.reduce((sum, point) => sum + point.value, 0),
        label: "Approved leave days",
        unit: "days",
      },
      points,
    };
  }

  private async projectBudgetVsActual(
    tenantId: string,
    filters: BiMetricFilters,
  ): Promise<BiMetricResult> {
    const db = this.prisma.forTenant(tenantId);
    const projects = await db.project.findMany({
      where: {
        deletedAt: null,
        status: filters.projectStatus,
      },
      orderBy: [{ code: "asc" }],
    });

    const points = projects.map((project) => ({
      key: project.code,
      label: project.name,
      value: Number(project.actualCost),
      secondaryValue: Number(project.budget),
      metadata: {
        varianceMinor: Number(project.actualCost - project.budget),
        status: project.status,
      },
    }));

    return {
      metricKey: "project_budget_vs_actual",
      generatedAt: new Date().toISOString(),
      summary: {
        value: points.reduce((sum, point) => sum + point.value, 0),
        label: "Actual project cost",
        unit: "minor",
      },
      points,
    };
  }

  private async demandForecastAccuracy(
    tenantId: string,
    filters: BiMetricFilters,
  ): Promise<BiMetricResult> {
    const db = this.prisma.forTenant(tenantId);
    const cutoff = filters.endDate ? new Date(filters.endDate) : new Date();

    const predictions = await db.forecastPrediction.findMany({
      where: {
        deletedAt: null,
        productId: filters.productId,
        forecastDate: {
          gte: filters.startDate ? new Date(filters.startDate) : undefined,
          lte: cutoff,
        },
      },
      include: {
        product: true,
      },
      orderBy: [{ forecastDate: "asc" }],
    });

    const movements = await db.inventoryMovement.findMany({
      where: {
        deletedAt: null,
        productId: filters.productId,
        movementType: InventoryMovementType.ISSUE,
        movedAt: {
          gte: filters.startDate ? new Date(filters.startDate) : undefined,
          lte: cutoff,
        },
      },
      orderBy: [{ movedAt: "asc" }],
    });

    const actuals = new Map<string, number>();
    for (const movement of movements) {
      const key = `${movement.productId}:${movement.movedAt.toISOString().slice(0, 10)}`;
      actuals.set(key, (actuals.get(key) ?? 0) + Number(movement.quantity));
    }

    const accuracyByProduct = new Map<
      string,
      { total: number; count: number; label: string }
    >();
    for (const prediction of predictions) {
      if (prediction.forecastDate > new Date()) {
        continue;
      }
      const key = `${prediction.productId}:${prediction.forecastDate.toISOString().slice(0, 10)}`;
      const actual = actuals.get(key) ?? 0;
      const denominator =
        actual === 0 ? Math.max(Number(prediction.predictedDemand), 1) : actual;
      const accuracy =
        100 -
        (Math.abs(Number(prediction.predictedDemand) - actual) / denominator) *
          100;
      const bucket = accuracyByProduct.get(prediction.productId) ?? {
        total: 0,
        count: 0,
        label: prediction.product.name,
      };
      bucket.total += Math.max(0, accuracy);
      bucket.count += 1;
      accuracyByProduct.set(prediction.productId, bucket);
    }

    const points = [...accuracyByProduct.entries()].map(([key, value]) => ({
      key,
      label: value.label,
      value: Number((value.total / value.count).toFixed(2)),
      secondaryValue: value.count,
    }));

    return {
      metricKey: "demand_forecast_accuracy",
      generatedAt: new Date().toISOString(),
      summary: {
        value:
          points.length === 0
            ? 0
            : Number(
                (
                  points.reduce((sum, point) => sum + point.value, 0) /
                  points.length
                ).toFixed(2),
              ),
        label: "Forecast accuracy",
        unit: "percent",
      },
      points,
    };
  }
}
