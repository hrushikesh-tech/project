import { UserRole } from "@amdox/types";

type RoleHome = {
  key: string;
  title: string;
  description: string;
  href: string;
  emphasis: string;
};

const rolePriority: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.TENANT_ADMIN,
  UserRole.FINANCE_MANAGER,
  UserRole.HR_MANAGER,
  UserRole.SUPPLY_CHAIN_MANAGER,
  UserRole.PROJECT_MANAGER,
  UserRole.VIEWER,
];

const roleHomes: Record<UserRole, RoleHome> = {
  [UserRole.SUPER_ADMIN]: {
    key: "super_admin",
    title: "Platform command center",
    description: "Monitor tenant health, cross-module activity, and the highest-risk operational signals in one place.",
    href: "/dashboard",
    emphasis: "Cross-tenant visibility and system coordination.",
  },
  [UserRole.TENANT_ADMIN]: {
    key: "tenant_admin",
    title: "Tenant operations home",
    description: "Watch finance, people, and workflow hotspots before diving into module-level work.",
    href: "/dashboard",
    emphasis: "Policy, approvals, and tenant-wide visibility.",
  },
  [UserRole.FINANCE_MANAGER]: {
    key: "finance_manager",
    title: "Finance command center",
    description: "Keep journals, AP/AR, and period-sensitive tasks visible as soon as the shell loads.",
    href: "/dashboard",
    emphasis: "Close readiness, cash movement, and reconciliation work.",
  },
  [UserRole.HR_MANAGER]: {
    key: "hr_manager",
    title: "People operations home",
    description: "Prioritize hiring, leave, and payroll-adjacent work with fast access to employee workflows.",
    href: "/dashboard",
    emphasis: "Headcount, leave approvals, and org responsiveness.",
  },
  [UserRole.SUPPLY_CHAIN_MANAGER]: {
    key: "supply_chain_manager",
    title: "Supply chain operations home",
    description: "Surface inventory pressure, replenishment work, and goods-receipt follow-through first.",
    href: "/dashboard",
    emphasis: "Warehouse pressure points and stock movement.",
  },
  [UserRole.PROJECT_MANAGER]: {
    key: "project_manager",
    title: "Project delivery home",
    description: "Start with utilization, milestones, and schedule risk before opening detailed project plans.",
    href: "/dashboard",
    emphasis: "Milestone movement and delivery risk.",
  },
  [UserRole.VIEWER]: {
    key: "viewer",
    title: "Executive overview",
    description: "See the most important ERP signals without dropping directly into heavy operational forms.",
    href: "/dashboard",
    emphasis: "Read-only oversight and cross-module awareness.",
  },
};

export function getPrimaryRole(roles: string[]) {
  return rolePriority.find((role) => roles.includes(role)) ?? UserRole.VIEWER;
}

export function resolveRoleHome(roles: string[]) {
  return roleHomes[getPrimaryRole(roles)];
}

export function resolveRoleHomeHref(roles: string[]) {
  return resolveRoleHome(roles).href;
}
