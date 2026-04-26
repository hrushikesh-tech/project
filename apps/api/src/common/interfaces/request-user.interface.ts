export interface RequestUser {
  userId: string;
  email: string;
  roles: string[];
  tenantId?: string;
  sessionId?: string;
  jti?: string;
  effectiveTenantId?: string;
  selectedTenantId?: string;
  actingTenantOverride?: boolean;
}
