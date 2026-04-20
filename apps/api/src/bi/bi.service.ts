import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DashboardAccessDenied,
  InvalidWidgetConfiguration,
} from "@amdox/types";
import { ClsService } from "nestjs-cls";
import { PrismaService } from "../prisma/prisma.service";
import { serializeBiValue } from "./bi.serialization";
import { BiMetricsService } from "./metrics/bi-metrics.service";
import { BiRefreshService } from "./bi-refresh.service";
import { CreateDashboardDto } from "./dto/create-dashboard.dto";
import { UpdateDashboardDto } from "./dto/update-dashboard.dto";
import { CreateWidgetDto } from "./dto/create-widget.dto";
import { UpdateWidgetDto } from "./dto/update-widget.dto";
import { MetricQueryDto } from "./dto/metric-query.dto";

type Actor = { userId?: string; roles?: string[] };

@Injectable()
export class BiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly metricsService: BiMetricsService,
    private readonly refreshService: BiRefreshService,
  ) {}

  async listDashboards(actor: Actor) {
    const dashboards = await this.prisma.tenant.dashboard.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        owner: true,
        widgets: {
          where: { deletedAt: null },
          orderBy: [{ sortOrder: "asc" }],
        },
      },
      orderBy: [{ updatedAt: "desc" }],
    });

    return serializeBiValue(
      dashboards.filter((dashboard) => this.canViewDashboard(dashboard, actor)),
    );
  }

  async getDashboard(id: string, actor: Actor) {
    const dashboard = await this.findDashboard(id);
    this.assertViewAccess(dashboard, actor);
    return serializeBiValue(dashboard);
  }

  async createDashboard(dto: CreateDashboardDto, actor: Actor) {
    const created = await this.prisma.tenant.dashboard.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() ?? null,
        ownerId: actor.userId ?? this.requireUserId(actor),
        isPublic: dto.isPublic ?? false,
        layout: dto.layout ?? null,
        defaultFilters: dto.defaultFilters ?? null,
      },
      include: {
        owner: true,
        widgets: true,
      },
    });

    return serializeBiValue(created);
  }

  async updateDashboard(id: string, dto: UpdateDashboardDto, actor: Actor) {
    const existing = await this.findDashboard(id);
    this.assertManageAccess(existing, actor);

    const updated = await this.prisma.tenant.dashboard.update({
      where: { id },
      data: {
        title: dto.title?.trim() ?? existing.title,
        description:
          dto.description === undefined
            ? existing.description
            : (dto.description?.trim() ?? null),
        isPublic: dto.isPublic ?? existing.isPublic,
        layout: dto.layout ?? existing.layout,
        defaultFilters: dto.defaultFilters ?? existing.defaultFilters,
      },
      include: {
        owner: true,
        widgets: {
          where: { deletedAt: null },
          orderBy: [{ sortOrder: "asc" }],
        },
      },
    });

    this.refreshService.emitRefresh(
      updated.id,
      updated.widgets.map((widget) => widget.metricKey),
      updated.widgets.map((widget) => widget.id),
    );
    return serializeBiValue(updated);
  }

  async deleteDashboard(id: string, actor: Actor) {
    const existing = await this.findDashboard(id);
    this.assertManageAccess(existing, actor);

    const deleted = await this.prisma.tenant.dashboard.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    this.refreshService.emitRefresh(id, [], []);
    return serializeBiValue(deleted);
  }

  async addWidget(dashboardId: string, dto: CreateWidgetDto, actor: Actor) {
    const dashboard = await this.findDashboard(dashboardId);
    this.assertManageAccess(dashboard, actor);
    this.validateWidgetShape(dto.position, dto.config);

    const widget = await this.prisma.tenant.widget.create({
      data: {
        dashboardId,
        title: dto.title.trim(),
        type: dto.type,
        metricKey: dto.metricKey,
        position: dto.position,
        config: dto.config ?? { filters: {} },
        refreshEnabled: dto.refreshEnabled ?? true,
        sortOrder: dto.sortOrder ?? dashboard.widgets.length,
      },
      include: {
        dashboard: true,
      },
    });

    this.refreshService.emitRefresh(
      dashboardId,
      [widget.metricKey],
      [widget.id],
    );
    return serializeBiValue(widget);
  }

  async updateWidget(
    dashboardId: string,
    widgetId: string,
    dto: UpdateWidgetDto,
    actor: Actor,
  ) {
    const dashboard = await this.findDashboard(dashboardId);
    this.assertManageAccess(dashboard, actor);
    const widget = dashboard.widgets.find((entry) => entry.id === widgetId);
    if (!widget) {
      throw new NotFoundException("Widget not found.");
    }

    this.validateWidgetShape(
      dto.position ?? widget.position,
      dto.config ?? widget.config,
    );

    const updated = await this.prisma.tenant.widget.update({
      where: { id: widgetId },
      data: {
        title: dto.title?.trim() ?? widget.title,
        type: dto.type ?? widget.type,
        metricKey: dto.metricKey ?? widget.metricKey,
        position: dto.position ?? widget.position,
        config: dto.config ?? widget.config,
        refreshEnabled: dto.refreshEnabled ?? widget.refreshEnabled,
        sortOrder: dto.sortOrder ?? widget.sortOrder,
      },
      include: {
        dashboard: true,
      },
    });

    this.refreshService.emitRefresh(
      dashboardId,
      [updated.metricKey],
      [updated.id],
    );
    return serializeBiValue(updated);
  }

  async deleteWidget(dashboardId: string, widgetId: string, actor: Actor) {
    const dashboard = await this.findDashboard(dashboardId);
    this.assertManageAccess(dashboard, actor);
    const widget = dashboard.widgets.find((entry) => entry.id === widgetId);
    if (!widget) {
      throw new NotFoundException("Widget not found.");
    }

    const deleted = await this.prisma.tenant.widget.update({
      where: { id: widgetId },
      data: { deletedAt: new Date() },
    });

    this.refreshService.emitRefresh(
      dashboardId,
      [widget.metricKey],
      [widgetId],
    );
    return serializeBiValue(deleted);
  }

  async getDashboardData(id: string, actor: Actor, query: MetricQueryDto) {
    const dashboard = await this.findDashboard(id);
    this.assertViewAccess(dashboard, actor);

    const widgets = [];
    for (const widget of dashboard.widgets) {
      const configFilters =
        widget.config &&
        typeof widget.config === "object" &&
        "filters" in widget.config
          ? ((widget.config as { filters?: Record<string, string> }).filters ??
            {})
          : {};
      const result = await this.metricsService.getMetric(
        dashboard.tenantId,
        widget.metricKey,
        {
          ...configFilters,
          ...query,
        },
      );
      widgets.push({ widget, result });
    }

    return serializeBiValue({
      dashboardId: dashboard.id,
      generatedAt: new Date().toISOString(),
      widgets,
    });
  }

  async streamDashboard(id: string, actor: Actor) {
    const dashboard = await this.findDashboard(id);
    this.assertViewAccess(dashboard, actor);

    return this.refreshService.streamDashboard(
      dashboard.id,
      dashboard.widgets
        .filter((widget) => widget.refreshEnabled)
        .map((widget) => widget.metricKey),
      dashboard.widgets
        .filter((widget) => widget.refreshEnabled)
        .map((widget) => widget.id),
    );
  }

  private async findDashboard(id: string) {
    const dashboard = await this.prisma.tenant.dashboard.findFirst({
      where: {
        id,
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

    if (!dashboard) {
      throw new NotFoundException("Dashboard not found.");
    }
    return dashboard;
  }

  private canViewDashboard(
    dashboard: { ownerId: string; isPublic: boolean },
    actor: Actor,
  ) {
    return this.canManageDashboard(dashboard, actor) || dashboard.isPublic;
  }

  private canManageDashboard(dashboard: { ownerId: string }, actor: Actor) {
    return (
      actor.roles?.includes("tenant_admin") ||
      dashboard.ownerId === actor.userId
    );
  }

  private assertViewAccess(
    dashboard: { ownerId: string; isPublic: boolean },
    actor: Actor,
  ) {
    if (!this.canViewDashboard(dashboard, actor)) {
      throw new DashboardAccessDenied();
    }
  }

  private assertManageAccess(dashboard: { ownerId: string }, actor: Actor) {
    if (!this.canManageDashboard(dashboard, actor)) {
      throw new DashboardAccessDenied();
    }
  }

  private validateWidgetShape(
    position: Record<string, unknown>,
    config?: Record<string, unknown>,
  ) {
    const requiredPositionKeys = ["x", "y", "w", "h"];
    const validPosition =
      position &&
      requiredPositionKeys.every(
        (key) =>
          typeof position[key] === "number" && Number.isFinite(position[key]),
      );
    if (!validPosition) {
      throw new InvalidWidgetConfiguration(
        "Widget position must contain numeric x, y, w, and h values.",
      );
    }

    if (config?.filters && typeof config.filters !== "object") {
      throw new InvalidWidgetConfiguration("Widget filters must be an object.");
    }
  }

  private requireTenantId() {
    const tenantId = this.cls.get<string>("tenantId");
    if (!tenantId) {
      throw new ForbiddenException("Tenant context required.");
    }
    return tenantId;
  }

  private requireUserId(actor: Actor) {
    if (!actor.userId) {
      throw new ForbiddenException("Authenticated user context required.");
    }
    return actor.userId;
  }
}
