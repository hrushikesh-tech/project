import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DashboardAccessDenied,
  ReportScheduleExecutionFailed,
} from "@amdox/types";
import { ClsService } from "nestjs-cls";
import { PrismaService } from "../../prisma/prisma.service";
import { BiMetricsService } from "../metrics/bi-metrics.service";
import { serializeBiValue } from "../bi.serialization";
import { BiReportPdfService } from "./bi-report-pdf.service";
import { BiReportExcelService } from "./bi-report-excel.service";
import { BiReportStorageService } from "./bi-report-storage.service";
import { BiReportMailerService } from "./bi-report-mailer.service";
import { BiReportQueue } from "../queue/bi-report.queue";
import { CreateReportScheduleDto } from "../dto/create-report-schedule.dto";
import { UpdateReportScheduleDto } from "../dto/update-report-schedule.dto";

type Actor = { userId?: string; roles?: string[] };

@Injectable()
export class BiReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly metricsService: BiMetricsService,
    private readonly pdfService: BiReportPdfService,
    private readonly excelService: BiReportExcelService,
    private readonly storageService: BiReportStorageService,
    private readonly mailerService: BiReportMailerService,
    private readonly queue: BiReportQueue,
  ) {}

  async listSchedules(actor: Actor) {
    const schedules = await this.prisma.tenant.reportSchedule.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        dashboard: {
          include: {
            owner: true,
            widgets: {
              where: { deletedAt: null },
              orderBy: [{ sortOrder: "asc" }],
            },
          },
        },
        runs: {
          where: { deletedAt: null },
          orderBy: [{ createdAt: "desc" }],
        },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    return serializeBiValue(
      schedules.filter((schedule) => this.canManage(schedule.dashboard, actor)),
    );
  }

  async createSchedule(dto: CreateReportScheduleDto, actor: Actor) {
    const dashboard = await this.prisma.tenant.dashboard.findFirst({
      where: {
        id: dto.dashboardId,
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
    this.assertManageAccess(dashboard, actor);

    const schedule = await this.prisma.tenant.reportSchedule.create({
      data: {
        dashboardId: dto.dashboardId,
        title: dto.title.trim(),
        cronExpression: dto.cronExpression.trim(),
        timezone: (dto.timezone ?? "UTC").trim(),
        recipients: dto.recipients,
        formats: dto.formats,
        isEnabled: dto.isEnabled ?? true,
        createdById: actor.userId ?? null,
      },
      include: {
        dashboard: {
          include: {
            owner: true,
            widgets: {
              where: { deletedAt: null },
              orderBy: [{ sortOrder: "asc" }],
            },
          },
        },
      },
    });

    await this.queue.registerSchedule(schedule);
    return serializeBiValue(schedule);
  }

  async updateSchedule(id: string, dto: UpdateReportScheduleDto, actor: Actor) {
    const existing = await this.prisma.tenant.reportSchedule.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        dashboard: {
          include: {
            owner: true,
            widgets: {
              where: { deletedAt: null },
              orderBy: [{ sortOrder: "asc" }],
            },
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException("Report schedule not found.");
    }
    this.assertManageAccess(existing.dashboard, actor);

    const updated = await this.prisma.tenant.reportSchedule.update({
      where: { id },
      data: {
        title: dto.title?.trim() ?? existing.title,
        cronExpression: dto.cronExpression?.trim() ?? existing.cronExpression,
        timezone: dto.timezone?.trim() ?? existing.timezone,
        recipients: dto.recipients ?? existing.recipients,
        formats: dto.formats ?? existing.formats,
        isEnabled: dto.isEnabled ?? existing.isEnabled,
      },
      include: {
        dashboard: {
          include: {
            owner: true,
            widgets: {
              where: { deletedAt: null },
              orderBy: [{ sortOrder: "asc" }],
            },
          },
        },
      },
    });

    await this.queue.syncSchedule(updated);
    return serializeBiValue(updated);
  }

  async executeSchedule(
    scheduleId: string,
    tenantId: string,
    triggeredBy = "system",
  ) {
    const db = this.prisma.forTenant(tenantId);
    const schedule = await db.reportSchedule.findFirst({
      where: {
        id: scheduleId,
        deletedAt: null,
      },
      include: {
        dashboard: {
          include: {
            owner: true,
            widgets: {
              where: { deletedAt: null },
              orderBy: [{ sortOrder: "asc" }],
            },
          },
        },
      },
    });

    if (!schedule) {
      throw new ReportScheduleExecutionFailed(
        "Report schedule could not be found.",
      );
    }

    const run = await db.reportRun.create({
      data: {
        reportScheduleId: schedule.id,
        dashboardId: schedule.dashboardId,
        status: "PROCESSING",
        startedAt: new Date(),
        triggeredBy,
      },
    });

    try {
      const snapshot = await this.buildDashboardSnapshot(
        tenantId,
        schedule.dashboard,
      );
      const artifacts = [];

      if (schedule.formats.includes("PDF")) {
        artifacts.push(
          await this.storageService.uploadArtifact({
            tenantId,
            dashboardId: schedule.dashboardId,
            reportRunId: run.id,
            format: "PDF",
            body: await this.pdfService.renderDashboardReport(snapshot),
          }),
        );
      }

      if (schedule.formats.includes("EXCEL")) {
        artifacts.push(
          await this.storageService.uploadArtifact({
            tenantId,
            dashboardId: schedule.dashboardId,
            reportRunId: run.id,
            format: "EXCEL",
            body: this.excelService.renderDashboardReport(snapshot),
          }),
        );
      }

      const delivery = await this.mailerService.sendReportReadyEmail({
        recipients: Array.isArray(schedule.recipients)
          ? schedule.recipients
          : [],
        dashboardTitle: schedule.dashboard.title,
        downloadLinks: artifacts.map((artifact) => artifact.url),
      });

      await db.reportRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          snapshot,
          artifact: artifacts,
          deliveryStatus: delivery.sent ? "DELIVERED" : "PENDING",
        },
      });

      await db.reportSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: new Date(),
        },
      });

      await db.outboxEvent.create({
        data: {
          tenantId,
          eventType: "bi.report.ready",
          payload: {
            reportRunId: run.id,
            dashboardId: schedule.dashboardId,
            recipients: schedule.recipients,
            artifacts,
          },
        },
      });

      if (schedule.dashboard.ownerId) {
        await db.notification.create({
          data: {
            userId: schedule.dashboard.ownerId,
            type: "bi.report.ready",
            channel: "IN_APP",
            title: `Report ready: ${schedule.title}`,
            body: `Dashboard report is available for ${schedule.dashboard.title}.`,
            metadata: {
              reportRunId: run.id,
              dashboardId: schedule.dashboardId,
              artifacts,
            },
            tenantId,
          },
        });
      }

      return serializeBiValue({
        reportRunId: run.id,
        artifacts,
        delivery,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db.reportRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          deliveryStatus: "FAILED",
          failureReason: message,
        },
      });
      throw new ReportScheduleExecutionFailed(message);
    }
  }

  private async buildDashboardSnapshot(
    tenantId: string,
    dashboard: {
      title: string;
      widgets: Array<{
        title: string;
        metricKey: string;
        config: unknown;
      }>;
    },
  ) {
    const widgets = [];
    for (const widget of dashboard.widgets) {
      const filters =
        widget.config &&
        typeof widget.config === "object" &&
        "filters" in widget.config
          ? ((widget.config as { filters?: Record<string, string> }).filters ??
            {})
          : {};
      const result = await this.metricsService.getMetric(
        tenantId,
        widget.metricKey,
        filters,
      );
      widgets.push({
        widgetTitle: widget.title,
        metricKey: widget.metricKey,
        summary: result.summary,
        points: result.points,
      });
    }

    return {
      dashboardTitle: dashboard.title,
      generatedAt: new Date().toISOString(),
      widgets,
    };
  }

  private canManage(dashboard: { ownerId: string }, actor: Actor) {
    return (
      actor.roles?.includes("tenant_admin") ||
      dashboard.ownerId === actor.userId
    );
  }

  private assertManageAccess(dashboard: { ownerId: string }, actor: Actor) {
    if (!this.canManage(dashboard, actor)) {
      throw new DashboardAccessDenied();
    }
  }

  private requireTenantId() {
    const tenantId = this.cls.get<string>("tenantId");
    if (!tenantId) {
      throw new ForbiddenException("Tenant context required.");
    }
    return tenantId;
  }
}
