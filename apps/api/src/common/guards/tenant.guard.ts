import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly cls: ClsService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return false;

    const tenantId = user.tenantId;
    const isSuperAdmin = user.roles?.includes('super_admin');

    if (!tenantId && !isSuperAdmin) {
      throw new ForbiddenException('Tenant context required');
    }

    // Set tenantId in CLS for PrismaService (D-06: SuperAdmin wildcard)
    this.cls.set('tenantId', tenantId || '*');
    return true;
  }
}
