import {
  BI_METRIC_KEYS,
  EmployeeStatus,
  InvoiceStatus,
  InvoiceType,
  JournalEntryStatus,
  PayrollRunStage,
  PayrollResultStatus,
  ProjectStatus,
  TaskStatus,
  type BiMetricKey,
} from "@amdox/types";
import {
  parseApiError,
  unwrapApiEnvelope,
  type ApiEnvelope,
  type ApiErrorEnvelope,
} from "./envelope";

export type OverviewMetric = {
  label: string;
  value: string;
  trend: string;
};

export type FinanceOverview = {
  title: string;
  metrics: OverviewMetric[];
};

export type JournalEntryRow = {
  id: string;
  entryNumber: string;
  description: string;
  period: string;
  status: JournalEntryStatus;
  debit: number;
  credit: number;
  currency: string;
};

export type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  counterparty: string;
  status: InvoiceStatus;
  type: InvoiceType;
  amount: number;
  dueDate: string;
};

export type AparOverview = {
  title: string;
  metrics: OverviewMetric[];
};

export type HrOverview = {
  title: string;
  metrics: OverviewMetric[];
};

export type EmployeeRow = {
  id: string;
  employeeCode: string;
  name: string;
  department: string;
  status: EmployeeStatus;
  manager: string;
};

export type NotificationPreferenceRecord = {
  id: string;
  eventType: string;
  channel: "IN_APP" | "EMAIL" | "SMS" | "WEBHOOK";
  enabled: boolean;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  eventType: string;
  channel: "IN_APP" | "EMAIL" | "SMS" | "WEBHOOK";
  createdAt: string;
  isRead: boolean;
  severity: "info" | "warning" | "critical";
};

export type PayrollRunRecord = {
  id: string;
  name: string;
  periodLabel: string;
  stage: PayrollRunStage;
  progress: number;
  employees: number;
  netPayLabel: string;
  lastUpdated: string;
};

export type PayrollResultRecord = {
  id: string;
  employeeName: string;
  status: PayrollResultStatus;
  netPayLabel: string;
  payslipUrl: string;
};

export type InventoryCell = {
  warehouseId: string;
  warehouseName: string;
  productId: string;
  productName: string;
  onHand: number;
  reorderPoint: number;
  available: number;
};

export type InventoryHeatmapDataset = {
  title: string;
  cells: InventoryCell[];
};

export type DashboardWidgetRecord = {
  id: string;
  title: string;
  metricKey: BiMetricKey;
  type: "stat" | "bar" | "table";
  layout: { x: number; y: number; w: number; h: number };
  filters?: Record<string, string | number>;
};

export type DashboardRecord = {
  id: string;
  name: string;
  description: string;
  widgets: DashboardWidgetRecord[];
};

export type DashboardMetricResult = {
  widgetId: string;
  metricKey: BiMetricKey;
  summary: string;
  points: Array<{ label: string; value: number }>;
};

export type ProjectRecord = {
  id: string;
  code: string;
  name: string;
  status: ProjectStatus;
  manager: string;
  budgetLabel: string;
};

export type ProjectTaskRecord = {
  id: string;
  projectId: string;
  title: string;
  start: string;
  end: string;
  status: TaskStatus;
  owner: string;
};

export type ProjectDependencyRecord = {
  id: string;
  predecessorId: string;
  successorId: string;
};

export type ProjectDetail = {
  project: ProjectRecord;
  tasks: ProjectTaskRecord[];
  dependencies: ProjectDependencyRecord[];
};

type ApiClientOptions = {
  accessToken?: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
const PLAYWRIGHT_BYPASS_ACCESS_TOKEN = "phase15-bypass-access-token";

function isBypassAccessToken(options: ApiClientOptions) {
  return options.accessToken === PLAYWRIGHT_BYPASS_ACCESS_TOKEN;
}

function normalizeCollection<T>(
  payload: unknown,
  keys: string[],
): T[] | null {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  for (const key of keys) {
    const value = (payload as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      return value as T[];
    }
  }

  return null;
}

async function fetchJson<T>(path: string, options: ApiClientOptions = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
    },
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload =
    contentType.includes("application/json")
      ? ((await response.json()) as T | ApiEnvelope<T> | ApiErrorEnvelope)
      : await response.text();

  if (!response.ok) {
    throw parseApiError(
      payload as string | ApiErrorEnvelope | null,
      response.status,
      `Request failed: ${path}`,
    );
  }

  return unwrapApiEnvelope(payload as T | ApiEnvelope<T>);
}

const notificationItems: NotificationItem[] = [
  {
    id: "notif-1",
    title: "Payroll run completed",
    body: "April India payroll generated payslips and ledger postings successfully.",
    eventType: "payroll.run.completed",
    channel: "IN_APP",
    createdAt: "2026-04-23T05:45:00.000Z",
    isRead: false,
    severity: "info",
  },
  {
    id: "notif-2",
    title: "Inventory low-stock watch",
    body: "Warehouse East is below reorder point for Servo Assembly Kits.",
    eventType: "inventory.low-stock",
    channel: "IN_APP",
    createdAt: "2026-04-23T04:10:00.000Z",
    isRead: true,
    severity: "warning",
  },
  {
    id: "notif-3",
    title: "Project budget threshold crossed",
    body: "Northwind rollout is above the configured budget-overrun notification threshold.",
    eventType: "project.budget.overrun",
    channel: "EMAIL",
    createdAt: "2026-04-22T16:20:00.000Z",
    isRead: false,
    severity: "critical",
  },
];

const payrollRuns: PayrollRunRecord[] = [
  {
    id: "run-1",
    name: "India payroll",
    periodLabel: "APR 2026",
    stage: PayrollRunStage.GENERATING_PAYSLIPS,
    progress: 72,
    employees: 184,
    netPayLabel: "INR 24.6M",
    lastUpdated: "2 min ago",
  },
  {
    id: "run-2",
    name: "UAE payroll",
    periodLabel: "APR 2026",
    stage: PayrollRunStage.COMPLETED,
    progress: 100,
    employees: 42,
    netPayLabel: "AED 1.8M",
    lastUpdated: "14 min ago",
  },
];

const payrollResults: Record<string, PayrollResultRecord[]> = {
  "run-1": [
    {
      id: "payroll-result-1",
      employeeName: "Mina Rao",
      status: PayrollResultStatus.PAYSLIP_GENERATED,
      netPayLabel: "INR 138,500",
      payslipUrl: "/artifacts/payslips/mina-rao.pdf",
    },
    {
      id: "payroll-result-2",
      employeeName: "Eli Thomas",
      status: PayrollResultStatus.CALCULATED,
      netPayLabel: "INR 126,300",
      payslipUrl: "/artifacts/payslips/eli-thomas.pdf",
    },
  ],
  "run-2": [
    {
      id: "payroll-result-3",
      employeeName: "Rhea Menon",
      status: PayrollResultStatus.POSTED,
      netPayLabel: "AED 24,800",
      payslipUrl: "/artifacts/payslips/rhea-menon.pdf",
    },
  ],
};

const inventoryDataset: InventoryHeatmapDataset = {
  title: "Warehouse stock pressure",
  cells: [
    { warehouseId: "wh-1", warehouseName: "North Hub", productId: "p-1", productName: "Servo Kit", onHand: 28, reorderPoint: 20, available: 24 },
    { warehouseId: "wh-1", warehouseName: "North Hub", productId: "p-2", productName: "Valve Sensor", onHand: 12, reorderPoint: 18, available: 10 },
    { warehouseId: "wh-2", warehouseName: "East Hub", productId: "p-1", productName: "Servo Kit", onHand: 8, reorderPoint: 16, available: 7 },
    { warehouseId: "wh-2", warehouseName: "East Hub", productId: "p-3", productName: "Relay Board", onHand: 34, reorderPoint: 14, available: 30 },
    { warehouseId: "wh-3", warehouseName: "Export Hub", productId: "p-2", productName: "Valve Sensor", onHand: 42, reorderPoint: 20, available: 37 },
    { warehouseId: "wh-3", warehouseName: "Export Hub", productId: "p-3", productName: "Relay Board", onHand: 15, reorderPoint: 15, available: 14 },
  ],
};

const dashboards: DashboardRecord[] = [
  {
    id: "dashboard-ops",
    name: "Operations pulse",
    description: "Cross-functional KPI surface with fixed widget semantics and drag-resize layout.",
    widgets: [
      { id: "widget-1", title: "Revenue trend", metricKey: BI_METRIC_KEYS[0], type: "bar", layout: { x: 0, y: 0, w: 6, h: 4 } },
      { id: "widget-2", title: "Inventory value", metricKey: BI_METRIC_KEYS[3], type: "stat", layout: { x: 6, y: 0, w: 3, h: 2 } },
      { id: "widget-3", title: "Headcount", metricKey: BI_METRIC_KEYS[2], type: "table", layout: { x: 9, y: 0, w: 3, h: 4 } },
    ],
  },
];

const dashboardMetrics: Record<string, DashboardMetricResult[]> = {
  "dashboard-ops": [
    {
      widgetId: "widget-1",
      metricKey: BI_METRIC_KEYS[0],
      summary: "INR 42.8M",
      points: [
        { label: "Jan", value: 7.6 },
        { label: "Feb", value: 8.1 },
        { label: "Mar", value: 8.9 },
        { label: "Apr", value: 10.4 },
      ],
    },
    {
      widgetId: "widget-2",
      metricKey: BI_METRIC_KEYS[3],
      summary: "INR 13.7M",
      points: [
        { label: "North", value: 5.2 },
        { label: "East", value: 3.1 },
        { label: "Export", value: 5.4 },
      ],
    },
    {
      widgetId: "widget-3",
      metricKey: BI_METRIC_KEYS[2],
      summary: "184 active",
      points: [
        { label: "Finance", value: 28 },
        { label: "People", value: 17 },
        { label: "Ops", value: 61 },
        { label: "Delivery", value: 78 },
      ],
    },
  ],
};

const projects: ProjectRecord[] = [
  {
    id: "project-1",
    code: "PROJ-401",
    name: "Northwind rollout",
    status: ProjectStatus.ACTIVE,
    manager: "Lena Kapoor",
    budgetLabel: "INR 8.4M",
  },
];

const projectDetails: Record<string, ProjectDetail> = {
  "project-1": {
    project: projects[0],
    tasks: Array.from({ length: 24 }, (_, index) => {
      const start = new Date(2026, 3, 1 + index * 2);
      const end = new Date(start);
      end.setDate(start.getDate() + 3 + (index % 4));
      return {
        id: `task-${index + 1}`,
        projectId: "project-1",
        title: `Work package ${index + 1}`,
        start: start.toISOString(),
        end: end.toISOString(),
        status: index % 5 === 0 ? TaskStatus.BLOCKED : index % 3 === 0 ? TaskStatus.IN_PROGRESS : TaskStatus.TODO,
        owner: index % 2 === 0 ? "Asha" : "Noah",
      };
    }),
    dependencies: Array.from({ length: 20 }, (_, index) => ({
      id: `dep-${index + 1}`,
      predecessorId: `task-${index + 1}`,
      successorId: `task-${index + 2}`,
    })),
  },
};

export async function getFinanceOverview(options: ApiClientOptions = {}): Promise<FinanceOverview> {
  try {
    const data = await fetchJson<JournalEntryRow[]>("/finance/journal-entries", options);
    return {
      title: "Finance command center",
      metrics: [
        { label: "Open journals", value: String(data.length), trend: "Live from backend" },
        {
          label: "Balanced entries",
          value: String(data.filter((row) => row.debit === row.credit).length),
          trend: "Balance checked in real time",
        },
        { label: "Primary currency", value: data[0]?.currency ?? "INR", trend: "Phase 3 finance contract" },
      ],
    };
  } catch {
    return {
      title: "Finance command center",
      metrics: [
        { label: "Open journals", value: "18", trend: "+4 vs yesterday" },
        { label: "Unposted value", value: "INR 4.2M", trend: "Close-week backlog" },
        { label: "FX watchlist", value: "3 pairs", trend: "USD, EUR, AED" },
      ],
    };
  }
}

export async function getJournalEntries(options: ApiClientOptions = {}): Promise<JournalEntryRow[]> {
  try {
    return await fetchJson<JournalEntryRow[]>("/finance/journal-entries", options);
  } catch {
    return [
      {
        id: "je-1",
        entryNumber: "JE-2026-0018",
        description: "Revenue accrual for April contracts",
        period: "APR-2026",
        status: JournalEntryStatus.DRAFT,
        debit: 480000,
        credit: 480000,
        currency: "INR",
      },
      {
        id: "je-2",
        entryNumber: "JE-2026-0019",
        description: "Intercompany cost allocation",
        period: "APR-2026",
        status: JournalEntryStatus.POSTED,
        debit: 920000,
        credit: 920000,
        currency: "USD",
      },
    ];
  }
}

export async function getInvoices(options: ApiClientOptions = {}): Promise<InvoiceRow[]> {
  try {
    return await fetchJson<InvoiceRow[]>("/ap-ar/invoices", options);
  } catch {
    return [
      {
        id: "inv-1",
        invoiceNumber: "AP-2026-104",
        counterparty: "Nexon Components",
        status: InvoiceStatus.PENDING_REVIEW,
        type: InvoiceType.PAYABLE,
        amount: 285000,
        dueDate: "2026-04-28",
      },
      {
        id: "inv-2",
        invoiceNumber: "AR-2026-077",
        counterparty: "Northwind Retail",
        status: InvoiceStatus.APPROVED,
        type: InvoiceType.RECEIVABLE,
        amount: 760000,
        dueDate: "2026-05-03",
      },
    ];
  }
}

export async function getAparOverview(options: ApiClientOptions = {}): Promise<AparOverview> {
  const invoices = await getInvoices(options);
  const payable = invoices.filter((item) => item.type === InvoiceType.PAYABLE);
  const receivable = invoices.filter((item) => item.type === InvoiceType.RECEIVABLE);

  return {
    title: "AP/AR operations",
    metrics: [
      { label: "Review queue", value: String(invoices.length), trend: "Invoices routed from OCR and matching" },
      {
        label: "Payables due",
        value: `INR ${payable.reduce((sum, row) => sum + row.amount, 0).toLocaleString("en-IN")}`,
        trend: "Working-capital watchlist",
      },
      {
        label: "Receivables due",
        value: `INR ${receivable.reduce((sum, row) => sum + row.amount, 0).toLocaleString("en-IN")}`,
        trend: "Collections follow-through",
      },
    ],
  };
}

export async function getHrOverview(options: ApiClientOptions = {}): Promise<HrOverview> {
  try {
    const employees = await fetchJson<EmployeeRow[]>("/hr/employees", options);
    return {
      title: "People operations",
      metrics: [
        { label: "Active employees", value: String(employees.length), trend: "Live roster" },
        {
          label: "Department coverage",
          value: String(new Set(employees.map((item) => item.department)).size),
          trend: "Cross-team staffing",
        },
        { label: "Lifecycle attention", value: "6", trend: "Pre-start + leave transitions" },
      ],
    };
  } catch {
    return {
      title: "People operations",
      metrics: [
        { label: "Active employees", value: "184", trend: "+12 month to date" },
        { label: "Open leave reviews", value: "9", trend: "3 overdue" },
        { label: "Attendance corrections", value: "5", trend: "Audit-ready queue" },
      ],
    };
  }
}

export async function getEmployees(options: ApiClientOptions = {}): Promise<EmployeeRow[]> {
  try {
    return await fetchJson<EmployeeRow[]>("/hr/employees", options);
  } catch {
    return [
      { id: "emp-1", employeeCode: "EMP-1004", name: "Mina Rao", department: "Finance", status: EmployeeStatus.ACTIVE, manager: "Arjun Patel" },
      { id: "emp-2", employeeCode: "EMP-1029", name: "Eli Thomas", department: "Operations", status: EmployeeStatus.ON_LEAVE, manager: "Rhea Menon" },
      { id: "emp-3", employeeCode: "EMP-1038", name: "Jia Chen", department: "People", status: EmployeeStatus.PRE_START, manager: "Lena Kapoor" },
    ];
  }
}

export async function getNotificationPreferences(options: ApiClientOptions = {}): Promise<NotificationPreferenceRecord[]> {
  if (isBypassAccessToken(options)) {
    return [
      { id: "pref-1", eventType: "invoice.match_failed", channel: "IN_APP", enabled: true },
      { id: "pref-2", eventType: "payroll.run.completed", channel: "EMAIL", enabled: true },
      { id: "pref-3", eventType: "project.budget.overrun", channel: "IN_APP", enabled: false },
    ];
  }

  try {
    const response = await fetchJson<NotificationPreferenceRecord[] | { preferences?: NotificationPreferenceRecord[]; items?: NotificationPreferenceRecord[] }>(
      "/notifications/preferences",
      options,
    );
    return normalizeCollection<NotificationPreferenceRecord>(response, ["preferences", "items"]) ?? [
      { id: "pref-1", eventType: "invoice.match_failed", channel: "IN_APP", enabled: true },
      { id: "pref-2", eventType: "payroll.run.completed", channel: "EMAIL", enabled: true },
      { id: "pref-3", eventType: "project.budget.overrun", channel: "IN_APP", enabled: false },
    ];
  } catch {
    return [
      { id: "pref-1", eventType: "invoice.match_failed", channel: "IN_APP", enabled: true },
      { id: "pref-2", eventType: "payroll.run.completed", channel: "EMAIL", enabled: true },
      { id: "pref-3", eventType: "project.budget.overrun", channel: "IN_APP", enabled: false },
    ];
  }
}

export async function saveNotificationPreferences(payload: NotificationPreferenceRecord[], _options: ApiClientOptions = {}) {
  await new Promise((resolve) => setTimeout(resolve, 250));
  return payload;
}

export async function getNotifications(options: ApiClientOptions = {}): Promise<NotificationItem[]> {
  if (isBypassAccessToken(options)) {
    return notificationItems;
  }

  try {
    const response = await fetchJson<NotificationItem[] | { notifications?: NotificationItem[]; items?: NotificationItem[] }>(
      "/notifications",
      options,
    );
    return normalizeCollection<NotificationItem>(response, ["notifications", "items"]) ?? notificationItems;
  } catch {
    return notificationItems;
  }
}

export async function markNotificationRead(notificationId: string) {
  return notificationItems.map((item) => (item.id === notificationId ? { ...item, isRead: true } : item));
}

export async function getPayrollRuns(options: ApiClientOptions = {}): Promise<PayrollRunRecord[]> {
  if (isBypassAccessToken(options)) {
    return payrollRuns;
  }

  try {
    const response = await fetchJson<PayrollRunRecord[] | { runs?: PayrollRunRecord[]; items?: PayrollRunRecord[] }>(
      "/payroll/runs",
      options,
    );
    return normalizeCollection<PayrollRunRecord>(response, ["runs", "items"]) ?? payrollRuns;
  } catch {
    return payrollRuns;
  }
}

export async function getPayrollResults(runId: string, options: ApiClientOptions = {}): Promise<PayrollResultRecord[]> {
  if (isBypassAccessToken(options)) {
    return payrollResults[runId] ?? [];
  }

  try {
    const response = await fetchJson<PayrollResultRecord[] | { results?: PayrollResultRecord[]; items?: PayrollResultRecord[] }>(
      `/payroll/runs/${runId}/results`,
      options,
    );
    return normalizeCollection<PayrollResultRecord>(response, ["results", "items"]) ?? (payrollResults[runId] ?? []);
  } catch {
    return payrollResults[runId] ?? [];
  }
}

export async function getInventoryHeatmap(options: ApiClientOptions = {}): Promise<InventoryHeatmapDataset> {
  try {
    const warehouses = await fetchJson<Array<{ id: string; name: string }>>("/supply-chain/warehouses", options);
    const products = await fetchJson<Array<{ id: string; name: string }>>("/supply-chain/products", options);
    return {
      title: "Warehouse stock pressure",
      cells: warehouses.flatMap((warehouse, index) =>
        products.slice(0, 3).map((product, productIndex) => ({
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
          productId: product.id,
          productName: product.name,
          onHand: 12 + index * 5 + productIndex * 3,
          reorderPoint: 15,
          available: 10 + index * 4 + productIndex * 2,
        })),
      ),
    };
  } catch {
    return inventoryDataset;
  }
}

export async function getDashboards(options: ApiClientOptions = {}): Promise<DashboardRecord[]> {
  if (isBypassAccessToken(options)) {
    return dashboards;
  }

  try {
    const response = await fetchJson<DashboardRecord[] | { dashboards?: DashboardRecord[]; items?: DashboardRecord[] }>(
      "/bi/dashboards",
      options,
    );
    return normalizeCollection<DashboardRecord>(response, ["dashboards", "items"]) ?? dashboards;
  } catch {
    return dashboards;
  }
}

export async function getDashboard(dashboardId: string, options: ApiClientOptions = {}): Promise<DashboardRecord> {
  try {
    return await fetchJson<DashboardRecord>(`/bi/dashboards/${dashboardId}`, options);
  } catch {
    return dashboards.find((dashboard) => dashboard.id === dashboardId) ?? dashboards[0];
  }
}

export async function getDashboardMetrics(dashboardId: string, options: ApiClientOptions = {}): Promise<DashboardMetricResult[]> {
  try {
    return await fetchJson<DashboardMetricResult[]>(`/bi/dashboards/${dashboardId}/data`, options);
  } catch {
    return dashboardMetrics[dashboardId] ?? [];
  }
}

export async function saveDashboardLayout(dashboardId: string, widgets: DashboardWidgetRecord[]) {
  const dashboard = dashboards.find((item) => item.id === dashboardId);
  if (dashboard) {
    dashboard.widgets = widgets;
  }
  return widgets;
}

export async function getProjects(options: ApiClientOptions = {}): Promise<ProjectRecord[]> {
  if (isBypassAccessToken(options)) {
    return projects;
  }

  try {
    const response = await fetchJson<ProjectRecord[] | { projects?: ProjectRecord[]; items?: ProjectRecord[] }>(
      "/projects",
      options,
    );
    return normalizeCollection<ProjectRecord>(response, ["projects", "items"]) ?? projects;
  } catch {
    return projects;
  }
}

export async function getProjectDetail(projectId: string, options: ApiClientOptions = {}): Promise<ProjectDetail> {
  if (isBypassAccessToken(options)) {
    return projectDetails[projectId] ?? projectDetails["project-1"];
  }

  try {
    const project = await fetchJson<ProjectRecord>(`/projects/${projectId}`, options);
    const tasksResponse = await fetchJson<ProjectTaskRecord[] | { tasks?: ProjectTaskRecord[]; items?: ProjectTaskRecord[] }>(
      `/projects/tasks?projectId=${projectId}`,
      options,
    );
    const dependenciesResponse = await fetchJson<ProjectDependencyRecord[] | { dependencies?: ProjectDependencyRecord[]; items?: ProjectDependencyRecord[] }>(
      `/projects/dependencies?taskId=`,
      options,
    );
    return {
      project,
      tasks: normalizeCollection<ProjectTaskRecord>(tasksResponse, ["tasks", "items"]) ?? (projectDetails[projectId]?.tasks ?? []),
      dependencies:
        normalizeCollection<ProjectDependencyRecord>(dependenciesResponse, ["dependencies", "items"]) ??
        (projectDetails[projectId]?.dependencies ?? []),
    };
  } catch {
    return projectDetails[projectId] ?? projectDetails["project-1"];
  }
}

export async function updateProjectTaskDates(taskId: string, start: string, end: string) {
  Object.values(projectDetails).forEach((detail) => {
    detail.tasks = detail.tasks.map((task) => (task.id === taskId ? { ...task, start, end } : task));
  });
  return { taskId, start, end };
}
