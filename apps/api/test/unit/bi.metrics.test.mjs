import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createBiHarness } from "../helpers/bi-test-store.mjs";

const require = createRequire(import.meta.url);
const { BiMetricsService } = require("../../dist/src/bi/metrics/bi-metrics.service.js");
const { BiRefreshService } = require("../../dist/src/bi/bi-refresh.service.js");
const { AccountType } = require("@amdox/db");

test("BI metrics aggregate revenue, inventory value, and project budget safely", async () => {
  const harness = createBiHarness();
  const service = new BiMetricsService(harness.prisma);
  const legalEntity = harness.insertLegalEntity({ code: "BI-FIN", baseCurrency: "INR" });
  const revenueAccount = harness.insertAccount({
    legalEntityId: legalEntity.id,
    code: "REV-100",
    name: "Consulting Revenue",
    type: AccountType.REVENUE,
  });
  const expenseAccount = harness.insertAccount({
    legalEntityId: legalEntity.id,
    code: "EXP-100",
    name: "Cloud Expense",
    type: AccountType.EXPENSE,
  });
  const period = harness.insertPeriod({
    legalEntityId: legalEntity.id,
    startDate: new Date("2026-04-01T00:00:00.000Z"),
    endDate: new Date("2026-04-30T00:00:00.000Z"),
  });

  harness.insertJournalEntry({
    legalEntityId: legalEntity.id,
    periodId: period.id,
    status: "POSTED",
    date: new Date("2026-04-10T00:00:00.000Z"),
    lines: [
      { accountId: revenueAccount.id, debit: 0n, credit: 250000n },
      { accountId: expenseAccount.id, debit: 90000n, credit: 0n },
    ],
  });

  const warehouse = harness.insertWarehouse({ code: "BI-WH", name: "BI Warehouse" });
  const product = harness.insertProduct({ sku: "BI-SKU", name: "BI Product" });
  harness.insertCostLayer({
    warehouseId: warehouse.id,
    productId: product.id,
    remainingQuantity: "4",
    unitCost: 1500n,
  });
  harness.insertProject({
    code: "BI-01",
    name: "BI Project",
    budget: 120000n,
    actualCost: 90000n,
  });

  const revenue = await service.getMetric("tenant-1", "revenue_by_month", {});
  const inventory = await service.getMetric("tenant-1", "inventory_value_by_warehouse", {});
  const projects = await service.getMetric("tenant-1", "project_budget_vs_actual", {});

  assert.equal(revenue.summary.value, 250000);
  assert.equal(revenue.points[0].key, "2026-04");
  assert.equal(inventory.summary.value, 6000);
  assert.equal(projects.points[0].secondaryValue, 120000);
});

test("BI metrics compute headcount, leave utilisation, po cycle time, and forecast accuracy", async () => {
  const harness = createBiHarness();
  const service = new BiMetricsService(harness.prisma);
  const department = harness.insertDepartment({ name: "Operations", code: "OPS" });
  const employee = harness.insertEmployee({
    departmentId: department.id,
    status: "ACTIVE",
    hireDate: new Date("2026-01-01T00:00:00.000Z"),
  });
  const leaveType = harness.insertLeaveType({ code: "AL", name: "Annual Leave" });
  harness.insertLeaveRequest({
    employeeId: employee.id,
    leaveTypeId: leaveType.id,
    startDate: new Date("2026-04-10T00:00:00.000Z"),
    endDate: new Date("2026-04-12T00:00:00.000Z"),
    status: "APPROVED",
  });

  const legalEntity = harness.insertLegalEntity({ code: "OPS", baseCurrency: "INR" });
  const vendor = harness.insertVendor({ legalEntityId: legalEntity.id });
  harness.insertPurchaseOrder({
    legalEntityId: legalEntity.id,
    vendorId: vendor.id,
    status: "APPROVED",
    submittedAt: new Date("2026-04-01T00:00:00.000Z"),
    approvedAt: new Date("2026-04-02T12:00:00.000Z"),
  });

  const forecastProduct = harness.insertProduct({ sku: "FC-A", name: "Forecast Product" });
  harness.insertForecastPrediction({
    productId: forecastProduct.id,
    forecastDate: new Date("2026-04-01T00:00:00.000Z"),
    predictedDemand: "10",
  });
  harness.insertInventoryMovement({
    productId: forecastProduct.id,
    quantity: "8",
    movementType: "ISSUE",
    movedAt: new Date("2026-04-01T00:00:00.000Z"),
  });

  const headcount = await service.getMetric("tenant-1", "headcount_by_department", {});
  const leave = await service.getMetric("tenant-1", "leave_utilisation_by_type", {
    startDate: "2026-04-01",
    endDate: "2026-04-30",
  });
  const poCycle = await service.getMetric("tenant-1", "po_approval_cycle_time", {});
  const accuracy = await service.getMetric("tenant-1", "demand_forecast_accuracy", {
    endDate: "2026-04-30",
  });

  assert.equal(headcount.summary.value, 1);
  assert.equal(leave.summary.value, 3);
  assert.equal(poCycle.summary.value, 36);
  assert.equal(accuracy.points[0].value, 75);
});

test("refresh service emits dashboard invalidation event shape", async () => {
  const service = new BiRefreshService();
  const stream = service.streamDashboard("dashboard-1", ["revenue_by_month"], ["widget-1"]);

  const event = await new Promise((resolve) => {
    const subscription = stream.subscribe((payload) => {
      subscription.unsubscribe();
      resolve(payload);
    });
    service.emitRefresh("dashboard-1", ["revenue_by_month"], ["widget-1"]);
  });

  assert.equal(event.type, "dashboard.refresh");
  assert.equal(event.data.dashboardId, "dashboard-1");
  assert.deepEqual(event.data.metricKeys, ["revenue_by_month"]);
  assert.deepEqual(event.data.widgetIds, ["widget-1"]);
});
