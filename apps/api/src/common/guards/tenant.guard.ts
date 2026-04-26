import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { getRequestFromExecutionContext } from '../../bi/graphql/graphql-auth';
import { normalizeTenantIdHeader } from '../validation/tenant-id-header.dto';

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

    const request = getRequestFromExecutionContext(context);
    const user = request.user;

    if (!user) return false;

    const tenantId = user.tenantId;
    const isSuperAdmin = user.roles?.includes('super_admin');
    const tenantOverride = this.readTenantOverride(request.headers?.['x-tenant-id']);

    if (!isSuperAdmin && tenantId && tenantOverride && tenantOverride !== tenantId) {
      throw new ForbiddenException('Tenant override does not match the authenticated tenant.');
    }

    const effectiveTenantId = isSuperAdmin
      ? tenantOverride
      : tenantId ?? tenantOverride;
    if (!effectiveTenantId) {
      if (isSuperAdmin) {
        throw new ForbiddenException('Super-admin requests must include an x-tenant-id header.');
      }
      throw new ForbiddenException('Tenant context required');
    }

    this.cls.set('tenantId', effectiveTenantId);
    this.cls.set('effectiveTenantId', effectiveTenantId);
    this.cls.set(
      'actingTenantOverride',
      Boolean(isSuperAdmin && tenantOverride && tenantOverride === effectiveTenantId),
    );
    request.user = {
      ...user,
      effectiveTenantId,
      selectedTenantId: tenantOverride,
      actingTenantOverride: Boolean(
        isSuperAdmin && tenantOverride && tenantOverride === effectiveTenantId,
      ),
    };
    return true;
  }

  private readTenantOverride(value: string | string[] | undefined) {
    try {
      return normalizeTenantIdHeader(value);
    } catch {
      throw new ForbiddenException('Invalid x-tenant-id header.');
    }
  }
}
