export interface RequestUser {
  userId: string;
  email: string;
  roles: string[];
  tenantId?: string;
}
