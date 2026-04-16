import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, createTenantClient } from '@amdox/db';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly client: PrismaClient;

  constructor(private readonly cls: ClsService) {
    this.client = new PrismaClient({ log: ['warn', 'error'] });
  }

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }

  /**
   * Returns a tenant-scoped Prisma client for the current request.
   * Uses CLS (AsyncLocalStorage) to get tenantId from the request context.
   */
  get tenant() {
    const tenantId = this.cls.get('tenantId');
    if (!tenantId || tenantId === '*') {
      throw new Error('Tenant context not available in CLS');
    }
    return createTenantClient(this.client, tenantId);
  }

  forTenant(tenantId: string) {
    if (!tenantId || tenantId === '*') {
      throw new Error('Explicit tenantId is required for background operations.');
    }
    return createTenantClient(this.client, tenantId);
  }

  /**
   * Returns the unscoped Prisma client for framework-level operations
   * such as scheduled jobs and tenant discovery.
   */
  get raw() {
    return this.client;
  }

  get auditLog() {
    return this.client.auditLog;
  }

  get $transaction(): PrismaClient['$transaction'] {
    return this.client.$transaction.bind(this.client) as PrismaClient['$transaction'];
  }
}
