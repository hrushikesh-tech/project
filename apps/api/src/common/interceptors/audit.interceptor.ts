import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only audit mutations (D-11: POST, PUT, PATCH, DELETE)
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const entityType = this.extractEntityType(request.path);
    const entityId = request.params?.id;
    let beforeSnapshot: any = null;

    // Capture before-state for updates and deletes (D-10: full record clone)
    if (['PUT', 'PATCH', 'DELETE'].includes(method) && entityId) {
      try {
        beforeSnapshot = await this.fetchEntity(entityType, entityId);
      } catch {
        // Entity lookup failed — proceed without before snapshot
        beforeSnapshot = null;
      }
    }

    return next.handle().pipe(
      tap({
        next: async (responseBody) => {
          try {
            // Write to AuditLog (D-12: TimescaleDB hypertable)
            await this.prisma.auditLog.create({
              data: {
                action: this.mapHttpMethodToAction(method),
                entityType,
                entityId: entityId || responseBody?.id || 'unknown',
                before: beforeSnapshot ? JSON.parse(JSON.stringify(beforeSnapshot)) : null,
                after: responseBody ? JSON.parse(JSON.stringify(responseBody)) : null,
                userId: request.user?.userId || 'anonymous',
                tenantId: request.user?.tenantId || 'system',
                ipAddress: request.ip,
                userAgent: request.headers?.['user-agent'] || null,
                timestamp: new Date(),
              },
            });
          } catch (error) {
            // Log audit failure but don't block the response
            console.error('Audit log write failed:', error);
          }
        },
      }),
    );
  }

  private extractEntityType(path: string): string {
    // Extract resource name from /api/v1/{resource}/...
    const segments = path.split('/').filter(Boolean);
    const versionIndex = segments.findIndex((s) => s.startsWith('v'));
    return segments[versionIndex + 1] || segments[segments.length - 1] || 'unknown';
  }

  private mapHttpMethodToAction(method: string): string {
    const map: Record<string, string> = {
      POST: 'CREATE',
      PUT: 'UPDATE',
      PATCH: 'UPDATE',
      DELETE: 'DELETE',
    };
    return map[method] || method;
  }

  private async fetchEntity(entityType: string, id: string): Promise<any> {
    // Dynamic entity lookup based on entityType
    // This will be expanded as modules are added
    const modelMap: Record<string, string> = {
      users: 'user',
      accounts: 'account',
      journals: 'journalEntry',
      invoices: 'invoice',
      employees: 'employee',
      'purchase-orders': 'purchaseOrder',
    };
    const model = modelMap[entityType];
    if (!model || !(this.prisma as any)[model]) return null;
    return (this.prisma as any)[model].findUnique({ where: { id } });
  }
}
