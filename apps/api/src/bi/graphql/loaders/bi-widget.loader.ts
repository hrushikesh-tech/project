import DataLoader from "dataloader";
import { Injectable, Scope } from "@nestjs/common";
import { ClsService } from "nestjs-cls";
import { PrismaService } from "../../../prisma/prisma.service";

@Injectable({ scope: Scope.REQUEST })
export class BiWidgetLoader {
  readonly byDashboardId: DataLoader<string, unknown[]>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {
    this.byDashboardId = new DataLoader<string, unknown[]>(async (dashboardIds) => {
      const tenantId = this.requireTenantId();
      const widgets = await this.prisma.forTenant(tenantId).widget.findMany({
        where: {
          dashboardId: { in: [...dashboardIds] },
          deletedAt: null,
        },
        orderBy: [{ sortOrder: "asc" }],
      });

      const grouped = new Map<string, unknown[]>();
      for (const dashboardId of dashboardIds) {
        grouped.set(dashboardId, []);
      }

      for (const widget of widgets) {
        grouped.get(widget.dashboardId)?.push(widget);
      }

      return dashboardIds.map((dashboardId) => grouped.get(dashboardId) ?? []);
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
