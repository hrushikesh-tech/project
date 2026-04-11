import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createTenantClient } from '@amdox/db';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly cls: ClsService) {
    super({ log: ['warn', 'error'] });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Returns a tenant-scoped Prisma client for the current request.
   * Uses CLS (AsyncLocalStorage) to get tenantId from the request context.
   */
  get tenant() {
    const tenantId = this.cls.get('tenantId');
    if (!tenantId) {
      throw new Error('Tenant context not available in CLS');
    }
    return createTenantClient(this, tenantId);
  }
}
