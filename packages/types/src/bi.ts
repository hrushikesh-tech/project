export const BI_METRIC_KEYS = [
  "revenue_by_month",
  "expense_by_category",
  "headcount_by_department",
  "inventory_value_by_warehouse",
  "po_approval_cycle_time",
  "leave_utilisation_by_type",
  "project_budget_vs_actual",
  "demand_forecast_accuracy",
] as const;

export type BiMetricKey = (typeof BI_METRIC_KEYS)[number];

export const BI_REPORT_FORMATS = ["PDF", "EXCEL"] as const;
export type BiReportFormat = (typeof BI_REPORT_FORMATS)[number];

export interface BiMetricFilters {
  startDate?: string;
  endDate?: string;
  asOfDate?: string;
  legalEntityId?: string;
  warehouseId?: string;
  departmentId?: string;
  productId?: string;
  projectStatus?: string;
  topN?: number;
}

export interface BiWidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BiWidgetConfig {
  filters?: BiMetricFilters;
  tableLimit?: number;
  breakdownKey?: string;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
}

export interface BiMetricPoint {
  key: string;
  label: string;
  value: number;
  secondaryValue?: number | null;
  metadata?: Record<string, unknown>;
}

export interface BiMetricResult {
  metricKey: BiMetricKey;
  generatedAt: string;
  summary: {
    value: number;
    label: string;
    unit?: string;
  };
  points: BiMetricPoint[];
}

export interface BiDashboardRefreshEvent {
  dashboardId: string;
  timestamp: string;
  widgetIds: string[];
  metricKeys: BiMetricKey[];
}

export class UnsupportedMetricKey extends Error {
  constructor(metricKey: string) {
    super(`Unsupported BI metric key: ${metricKey}`);
    this.name = "UnsupportedMetricKey";
  }
}

export class InvalidWidgetConfiguration extends Error {
  constructor(
    message = "Widget configuration is invalid for the selected BI metric.",
  ) {
    super(message);
    this.name = "InvalidWidgetConfiguration";
  }
}

export class DashboardAccessDenied extends Error {
  constructor(message = "Dashboard access is denied for the current user.") {
    super(message);
    this.name = "DashboardAccessDenied";
  }
}

export class ReportScheduleExecutionFailed extends Error {
  constructor(message = "Scheduled BI report execution failed.") {
    super(message);
    this.name = "ReportScheduleExecutionFailed";
  }
}
