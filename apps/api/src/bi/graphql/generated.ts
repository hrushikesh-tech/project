
/*
 * -------------------------------------------------------
 * THIS FILE WAS AUTOMATICALLY GENERATED (DO NOT MODIFY)
 * -------------------------------------------------------
 */

/* tslint:disable */
/* eslint-disable */

export enum BiMetricKey {
    demand_forecast_accuracy = "demand_forecast_accuracy",
    expense_by_category = "expense_by_category",
    headcount_by_department = "headcount_by_department",
    inventory_value_by_warehouse = "inventory_value_by_warehouse",
    leave_utilisation_by_type = "leave_utilisation_by_type",
    po_approval_cycle_time = "po_approval_cycle_time",
    project_budget_vs_actual = "project_budget_vs_actual",
    revenue_by_month = "revenue_by_month"
}

export class BiMetricFiltersInput {
    asOfDate?: Nullable<string>;
    departmentId?: Nullable<string>;
    endDate?: Nullable<string>;
    legalEntityId?: Nullable<string>;
    productId?: Nullable<string>;
    projectStatus?: Nullable<string>;
    startDate?: Nullable<string>;
    topN?: Nullable<number>;
    warehouseId?: Nullable<string>;
}

export class BiDashboard {
    defaultFilters?: Nullable<JSON>;
    description?: Nullable<string>;
    id: string;
    isPublic: boolean;
    layout?: Nullable<JSON>;
    ownerId: string;
    title: string;
    widgets: BiWidget[];
}

export class BiDashboardData {
    dashboardId: string;
    generatedAt: string;
    widgets: BiDashboardMetricData[];
}

export class BiDashboardMetricData {
    result: BiMetricResult;
    widget: BiWidget;
}

export class BiMetricPoint {
    key: string;
    label: string;
    metadata?: Nullable<JSON>;
    secondaryValue?: Nullable<number>;
    value: number;
}

export class BiMetricResult {
    generatedAt: string;
    metricKey: BiMetricKey;
    points: BiMetricPoint[];
    summary: BiMetricSummary;
}

export class BiMetricSummary {
    label: string;
    unit?: Nullable<string>;
    value: number;
}

export class BiWidget {
    config?: Nullable<JSON>;
    id: string;
    metric?: BiMetricResult;
    metricKey: BiMetricKey;
    position?: Nullable<JSON>;
    refreshEnabled: boolean;
    sortOrder: number;
    title: string;
    type: string;
}

export abstract class IQuery {
    abstract biDashboard(id: string): BiDashboard | Promise<BiDashboard>;

    abstract biDashboardData(filters?: Nullable<BiMetricFiltersInput>, id: string): BiDashboardData | Promise<BiDashboardData>;

    abstract biDashboards(): BiDashboard[] | Promise<BiDashboard[]>;

    abstract biMetric(filters?: Nullable<BiMetricFiltersInput>, metricKey: BiMetricKey): BiMetricResult | Promise<BiMetricResult>;
}

export type JSON = any;
type Nullable<T> = T | null;
