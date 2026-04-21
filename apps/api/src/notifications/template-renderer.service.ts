import { Injectable } from "@nestjs/common";
import { NotificationChannel } from "@amdox/db";
import { NotificationEventType } from "@amdox/types";
import { PrismaService } from "../prisma/prisma.service";

type TemplateSeed = {
  subject?: string | null;
  body: string;
};

const PLATFORM_DEFAULT_TEMPLATES: Record<
  NotificationEventType,
  Partial<Record<NotificationChannel, TemplateSeed>>
> = {
  "invoice.match_failed": {
    [NotificationChannel.IN_APP]: {
      body: "Invoice {{invoiceId}} needs review because {{mismatchReasons}}.",
    },
    [NotificationChannel.EMAIL]: {
      subject: "Invoice review required",
      body: "Invoice {{invoiceId}} needs review because {{mismatchReasons}}.",
    },
    [NotificationChannel.SMS]: {
      body: "Invoice {{invoiceId}} needs review: {{mismatchReasons}}.",
    },
  },
  "hr.leave.rejected": {
    [NotificationChannel.IN_APP]: {
      body: "Leave request {{leaveRequestId}} was rejected. {{reason}}",
    },
    [NotificationChannel.EMAIL]: {
      subject: "Leave request rejected",
      body: "Leave request {{leaveRequestId}} was rejected. {{reason}}",
    },
    [NotificationChannel.SMS]: {
      body: "Leave request {{leaveRequestId}} was rejected. {{reason}}",
    },
  },
  "payroll.run.completed": {
    [NotificationChannel.IN_APP]: {
      body: "Payroll run {{payrollRunId}} completed.",
    },
    [NotificationChannel.EMAIL]: {
      subject: "Payroll run completed",
      body: "Payroll run {{payrollRunId}} completed.",
    },
    [NotificationChannel.SMS]: {
      body: "Payroll run {{payrollRunId}} completed.",
    },
  },
  "payroll.run.failed": {
    [NotificationChannel.IN_APP]: {
      body: "Payroll run {{payrollRunId}} failed. {{message}}",
    },
    [NotificationChannel.EMAIL]: {
      subject: "Payroll run failed",
      body: "Payroll run {{payrollRunId}} failed. {{message}}",
    },
    [NotificationChannel.SMS]: {
      body: "Payroll run {{payrollRunId}} failed. {{message}}",
    },
  },
  "supply-chain.reorder.skipped": {
    [NotificationChannel.IN_APP]: {
      body: "Reorder skipped for product {{productId}}. {{message}}",
    },
    [NotificationChannel.EMAIL]: {
      subject: "Auto reorder skipped",
      body: "Reorder skipped for product {{productId}}. {{message}}",
    },
    [NotificationChannel.SMS]: {
      body: "Reorder skipped for product {{productId}}. {{message}}",
    },
  },
  "bi.report.ready": {
    [NotificationChannel.IN_APP]: {
      body: "Dashboard report is available for dashboard {{dashboardId}}.",
    },
    [NotificationChannel.EMAIL]: {
      subject: "BI report ready",
      body: "Dashboard report is available for dashboard {{dashboardId}}.",
    },
    [NotificationChannel.SMS]: {
      body: "Dashboard report {{dashboardId}} is ready.",
    },
  },
  "project.budget.overrun": {
    [NotificationChannel.IN_APP]: {
      body: "Project {{projectCode}} exceeded budget by {{thresholdPercent}}%.",
    },
    [NotificationChannel.EMAIL]: {
      subject: "Project budget overrun",
      body: "Project {{projectCode}} exceeded budget by {{thresholdPercent}}%.",
    },
    [NotificationChannel.SMS]: {
      body: "Project {{projectCode}} exceeded budget by {{thresholdPercent}}%.",
    },
  },
  "invoice.posted": {
    [NotificationChannel.EMAIL]: {
      subject: "Invoice posted",
      body: "Invoice {{invoiceId}} has been posted.",
    },
  },
  "invoice.overdue": {
    [NotificationChannel.EMAIL]: {
      subject: "Invoice overdue",
      body: "Invoice {{invoiceId}} is overdue.",
    },
  },
  "invoice.review.required": {
    [NotificationChannel.EMAIL]: {
      subject: "Invoice review required",
      body: "Invoice {{invoiceId}} requires review.",
    },
  },
  "purchase-order.submitted": {
    [NotificationChannel.EMAIL]: {
      subject: "Purchase order submitted",
      body: "Purchase order {{purchaseOrderId}} was submitted.",
    },
  },
  "purchase-order.approved": {
    [NotificationChannel.EMAIL]: {
      subject: "Purchase order approved",
      body: "Purchase order {{purchaseOrderId}} was approved.",
    },
  },
  "inventory.low-stock": {
    [NotificationChannel.EMAIL]: {
      subject: "Inventory low stock",
      body: "Inventory for product {{productId}} is below threshold.",
    },
  },
  "inventory.receipt.posted": {
    [NotificationChannel.EMAIL]: {
      subject: "Inventory receipt posted",
      body: "Goods receipt {{goodsReceiptId}} was posted.",
    },
  },
  "forecast.generated": {
    [NotificationChannel.EMAIL]: {
      subject: "Forecast generated",
      body: "Forecast generation completed for product {{productId}}.",
    },
  },
  "forecast.model.promoted": {
    [NotificationChannel.EMAIL]: {
      subject: "Forecast model promoted",
      body: "Forecast model {{modelVersion}} was promoted for product {{productId}}.",
    },
  },
  "dashboard.shared": {
    [NotificationChannel.EMAIL]: {
      subject: "Dashboard shared",
      body: "Dashboard {{dashboardId}} was shared with you.",
    },
  },
  "report.schedule.failed": {
    [NotificationChannel.EMAIL]: {
      subject: "Scheduled report failed",
      body: "Scheduled report {{reportScheduleId}} failed. {{reason}}",
    },
  },
  "project.milestone.completed": {
    [NotificationChannel.EMAIL]: {
      subject: "Project milestone completed",
      body: "Milestone {{milestoneId}} has been completed.",
    },
  },
  "project.task.blocked": {
    [NotificationChannel.EMAIL]: {
      subject: "Project task blocked",
      body: "Task {{taskId}} is blocked.",
    },
  },
  "user.invited": {
    [NotificationChannel.EMAIL]: {
      subject: "You were invited",
      body: "You were invited to Amdox ERP.",
    },
  },
  "user.deactivated": {
    [NotificationChannel.EMAIL]: {
      subject: "Account deactivated",
      body: "Account {{userId}} was deactivated.",
    },
  },
};

@Injectable()
export class TemplateRendererService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(params: {
    tenantId: string;
    eventType: NotificationEventType;
    channel: NotificationChannel;
    variables: Record<string, unknown>;
  }) {
    const override = await this.prisma
      .forTenant(params.tenantId)
      .notificationTemplate.findFirst({
        where: {
          tenantId: params.tenantId,
          eventType: params.eventType,
          channel: params.channel,
          deletedAt: null,
        },
      });

    const seed =
      override ??
      PLATFORM_DEFAULT_TEMPLATES[params.eventType]?.[params.channel] ??
      null;
    if (!seed) {
      return null;
    }

    return {
      source: override ? "TENANT_OVERRIDE" : "PLATFORM_DEFAULT",
      subject: this.render(seed.subject ?? null, params.variables),
      body: this.render(seed.body, params.variables),
    };
  }

  getDefaultTemplate(
    eventType: NotificationEventType,
    channel: NotificationChannel,
  ) {
    return PLATFORM_DEFAULT_TEMPLATES[eventType]?.[channel] ?? null;
  }

  private render(
    template: string | null | undefined,
    variables: Record<string, unknown>,
  ) {
    if (!template) {
      return null;
    }

    return template.replace(
      /\{\{\s*([\w.]+)\s*\}\}/g,
      (_match, key: string) => {
        const value = key.split(".").reduce<unknown>((current, segment) => {
          if (current && typeof current === "object") {
            return (current as Record<string, unknown>)[segment];
          }
          return undefined;
        }, variables);
        return value == null ? "" : String(value);
      },
    );
  }
}
