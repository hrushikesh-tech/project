import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly cls: ClsService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return false;

    const tenantId = user.tenantId;
    const isSuperAdmin = user.roles?.includes('super_admin');
    const tenantOverride = this.readTenantOverride(request.headers?.['x-tenant-id']);

    if (tenantId && tenantOverride && tenantOverride !== tenantId) {
      throw new ForbiddenException('Tenant override does not match the authenticated tenant.');
    }

    const effectiveTenantId = tenantId ?? (isSuperAdmin ? tenantOverride : undefined);
    if (!effectiveTenantId) {
      if (isSuperAdmin) {
        throw new ForbiddenException('Super-admin requests must include an x-tenant-id header.');
      }
      throw new ForbiddenException('Tenant context required');
    }

    this.cls.set('tenantId', effectiveTenantId);
    return true;
  }

  private readTenantOverride(value: string | string[] | undefined) {
    const headerValue = Array.isArray(value) ? value[0] : value;
    if (typeof headerValue !== 'string') {
      return undefined;
    }

    const normalized = headerValue.trim();
    return normalized.length > 0 ? normalized : undefined;
  }
}
