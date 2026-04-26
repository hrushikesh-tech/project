import { Bell, BriefcaseBusiness, ChartNoAxesCombined, Factory, Landmark, LayoutDashboard, ReceiptText, UsersRound } from "lucide-react";

export const AUTH_ROUTES = ["/login"];
export const PUBLIC_ROUTES = ["/", "/login"];
export const DASHBOARD_PREFIX = "/dashboard";
export const API_AUTH_PREFIX = "/api/auth";
export const DEFAULT_LOGIN_REDIRECT = "/dashboard";

export const shellNavItems = [
  {
    href: "/dashboard",
    label: "Home",
    icon: LayoutDashboard,
    description: "Role-aware landing view",
    disabled: false,
  },
  {
    href: "/dashboard/finance",
    label: "Finance",
    icon: Landmark,
    description: "Journals, AP/AR, and close operations",
    disabled: false,
  },
  {
    href: "/dashboard/ap-ar",
    label: "AP / AR",
    icon: Landmark,
    description: "Invoice review, due dates, and collections follow-through",
    disabled: false,
  },
  {
    href: "/dashboard/hr",
    label: "HR",
    icon: UsersRound,
    description: "Employees, leave, and people workflows",
    disabled: false,
  },
  {
    href: "/dashboard/payroll",
    label: "Payroll",
    icon: ReceiptText,
    description: "Run progress, payslips, and payroll artifacts",
    disabled: false,
  },
  {
    href: "/dashboard/supply-chain",
    label: "Supply Chain",
    icon: Factory,
    description: "Inventory, vendors, and warehouse flows",
    disabled: false,
  },
  {
    href: "/dashboard/projects",
    label: "Projects",
    icon: BriefcaseBusiness,
    description: "Milestones, schedules, and delivery risk",
    disabled: false,
  },
  {
    href: "/dashboard/bi",
    label: "BI",
    icon: ChartNoAxesCombined,
    description: "Dashboards, widgets, and live metrics",
    disabled: false,
  },
  {
    href: "/dashboard/notifications",
    label: "Notifications",
    icon: Bell,
    description: "Inbox and channel preferences",
    disabled: false,
  },
] as const;
