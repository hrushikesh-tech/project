export type OfflineActionType =
  | "notification-preferences"
  | "bi-layout"
  | "journal-post"
  | "payroll-run"
  | "inventory-consume"
  | "project-reschedule";

export type OfflineAction = {
  id: string;
  type: OfflineActionType;
  payload: Record<string, unknown>;
  queuedAt: string;
};

const allowlist = new Set<OfflineActionType>(["notification-preferences", "bi-layout"]);

export function isOfflineAllowed(type: OfflineActionType) {
  return allowlist.has(type);
}

export function getOfflinePolicyMessage(type: OfflineActionType) {
  if (isOfflineAllowed(type)) {
    return "This action can queue safely while you are offline.";
  }

  return "This action stays online-only because it can change finance, payroll, inventory, or dependency-sensitive state.";
}
