import DataLoader from "dataloader";
import { Injectable, Scope } from "@nestjs/common";
import { ClsService } from "nestjs-cls";
import { PrismaService } from "../../../prisma/prisma.service";

@Injectable({ scope: Scope.REQUEST })
export class BiDashboardLoader {
  readonly byId: DataLoader<string, unknown | null>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {
    this.byId = new DataLoader<string, unknown | null>(async (ids) => {
      const tenantId = this.requireTenantId();
      const dashboards = await this.prisma.forTenant(tenantId).dashboard.findMany({
        where: {
          id: { in: [...ids] },
          deletedAt: null,
        },
        include: {
          owner: true,
          widgets: {
            where: { deletedAt: null },
            orderBy: [{ sortOrder: "asc" }],
          },
        },
      });

      const byId = new Map(dashboards.map((dashboard) => [dashboard.id, dashboard]));
      return ids.map((id) => byId.get(id) ?? null);
    });
  }

  private requireTenantId() {
    const tenantId = this.cls.get<string>("tenantId");
    if (!tenantId) {
      throw new Error("Tenant context required for BI GraphQL.");
    }
    return tenantId;
  }
}
