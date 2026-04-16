// =============================================================================
// Amdox Technologies — Evolving Status Enums (D-03 Hybrid Strategy)
// These are TypeScript enums for statuses that may evolve over time.
// Prisma schema uses String fields for these; validation is in application layer.
// =============================================================================

// Purchase Order Lifecycle
export enum PurchaseOrderStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  SENT_TO_VENDOR = 'SENT_TO_VENDOR',
  PARTIALLY_RECEIVED = 'PARTIALLY_RECEIVED',
  FULLY_RECEIVED = 'FULLY_RECEIVED',
  CLOSED = 'CLOSED',
  REJECTED = 'REJECTED',
}

// Leave Request States
export enum LeaveStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

// Employee Status
export enum EmployeeStatus {
  ACTIVE = 'ACTIVE',
  ON_LEAVE = 'ON_LEAVE',
  TERMINATED = 'TERMINATED',
  SUSPENDED = 'SUSPENDED',
}

// Journal Entry Status
export enum JournalEntryStatus {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
  REVERSED = 'REVERSED',
}

// Payroll Run Status
export enum PayrollRunStatus {
  DRAFT = 'DRAFT',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REVERSED = 'REVERSED',
}

// Project Status
export enum ProjectStatus {
  PLANNING = 'PLANNING',
  ACTIVE = 'ACTIVE',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

// Task Status
export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
  BLOCKED = 'BLOCKED',
}

// Task Priority
export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// User Roles (matches Keycloak realm roles)
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  TENANT_ADMIN = 'tenant_admin',
  FINANCE_MANAGER = 'finance_manager',
  HR_MANAGER = 'hr_manager',
  SUPPLY_CHAIN_MANAGER = 'supply_chain_manager',
  PROJECT_MANAGER = 'project_manager',
  VIEWER = 'viewer',
}

// Audit Action Types
export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

// Tenant Status
export enum TenantStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DEACTIVATED = 'DEACTIVATED',
}

// Tenant Plan
export enum TenantPlan {
  STARTER = 'STARTER',
  STANDARD = 'STANDARD',
  ENTERPRISE = 'ENTERPRISE',
}

// Vendor Status
export enum VendorStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BLACKLISTED = 'BLACKLISTED',
}

// Attendance Status
export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  HALF_DAY = 'HALF_DAY',
  ON_LEAVE = 'ON_LEAVE',
  WORK_FROM_HOME = 'WORK_FROM_HOME',
}

// Outbox Event Status
export enum OutboxEventStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

// Project Milestone Status
export enum MilestoneStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE',
}

// Task Dependency Type
export enum DependencyType {
  FINISH_TO_START = 'FINISH_TO_START',
  START_TO_START = 'START_TO_START',
  FINISH_TO_FINISH = 'FINISH_TO_FINISH',
  START_TO_FINISH = 'START_TO_FINISH',
}
