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
export {
  AttendanceCorrectionException,
  DepartmentHeadValidationException,
  EmployeeLifecycleException,
  InsufficientLeaveBalanceException,
  InvalidLeaveTransitionException,
  InvalidPayrollRunScopeException,
  MissingSalaryStructureException,
  UnsupportedTaxRegimeException,
  PayrollCompensationFailureException,
  PayslipGenerationFailureException,
  InvalidPurchaseOrderTransition,
  VendorPurchasingBlocked,
  GoodsReceiptQuantityExceeded,
  InsufficientStockException,
  MissingReplenishmentConfiguration,
  AmbiguousReplenishmentConfiguration,
  UnsupportedMetricKey,
  InvalidWidgetConfiguration,
  DashboardAccessDenied,
  ReportScheduleExecutionFailed,
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
