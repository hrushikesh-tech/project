// @amdox/db — Database package barrel export
// Re-export Prisma client and generated types
export {
  PrismaClient,
  Prisma,
  AccountType,
  JournalEntryStatus,
  NotificationChannel,
  WidgetType,
} from "@prisma/client";
export type {
  Tenant,
  User,
  AuditLog,
  LegalEntity,
  Account,
  FiscalPeriod,
  JournalEntry,
  JournalLine,
  IntercompanyTransfer,
  FxRate,
  Invoice,
  InvoiceLine,
  ThreeWayMatch,
  Employee,
  Department,
  LeaveType,
  LeaveRequest,
  LeaveBalance,
  Attendance,
  PayrollRun,
  Payslip,
  TaxSlab,
  Vendor,
  PurchaseOrder,
  PurchaseOrderLine,
  Product,
  InventoryItem,
  Warehouse,
  CostLayer,
  GoodsReceipt,
  GoodsReceiptLine,
  Project,
  Task,
  TaskDependency,
  ProjectMilestone,
  ForecastPrediction,
  ForecastModel,
  Dashboard,
  Widget,
  Notification,
  OutboxEvent,
  NotificationPreference,
  WebhookConfig,
  NotificationTemplate,
} from "@prisma/client";
export {
  AttendanceCorrectionException,
  DepartmentHeadValidationException,
  EmployeeLifecycleException,
  InsufficientLeaveBalanceException,
  InvalidLeaveTransitionException,
} from "@amdox/types";

export interface Customer {
  id: string;
  name: string;
  code: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  paymentTerms: number;
  currency: string;
  status: string;
  legalEntityId: string;
  receivablesAccountId: string | null;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// Re-export client factory and extensions
export { createPrismaClient, createTenantClient } from "./client";
export { createTenantExtension } from "./extensions/tenant.extension";
export { softDeleteExtension } from "./extensions/soft-delete.extension";
