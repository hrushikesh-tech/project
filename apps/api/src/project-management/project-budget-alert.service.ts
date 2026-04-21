import { Injectable } from "@nestjs/common";
import { NotificationChannel } from "@amdox/db";
import { ProjectBudgetOverrunEventPayload } from "@amdox/types";
import { PrismaService } from "../prisma/prisma.service";

type ProjectAlertSnapshot = {
  id: string;
  code: string;
  name: string;
  managerId: string;
  budget: bigint;
  actualCost: bigint;
  tenantId: string;
  manager?: { id: string; userId: string | null } | null;
};

type TenantPrisma = ReturnType<PrismaService["forTenant"]>;

@Injectable()
export class ProjectBudgetAlertService {
  async handleBudgetThresholdCrossing(
    db: TenantPrisma,
    args: {
      previous: ProjectAlertSnapshot;
      current: ProjectAlertSnapshot;
    },
  ) {
    const { previous, current } = args;
    if (!this.crossedThreshold(previous, current)) {
      return;
    }

    const tenantAdmins = await db.user.findMany({
      where: {
        tenantId: current.tenantId,
        role: "tenant_admin",
        deletedAt: null,
        isActive: true,
      },
      orderBy: [{ createdAt: "asc" }],
    });

    const recipientIds = new Set(
      tenantAdmins.map((user: { id: string }) => user.id),
    );
    if (current.manager?.userId) {
      recipientIds.add(current.manager.userId);
    }

    const payload: ProjectBudgetOverrunEventPayload = {
      projectId: current.id,
      projectCode: current.code,
      projectName: current.name,
      managerId: current.managerId,
      budget: Number(current.budget),
      actualCost: Number(current.actualCost),
      thresholdPercent: 10,
      recipients: [...recipientIds],
    };

    await db.outboxEvent.create({
      data: {
        tenantId: current.tenantId,
        eventType: "project.budget.overrun",
        payload,
      },
    });

    if (recipientIds.size > 0) {
      await db.notification.createMany({
        data: [...recipientIds].map((userId) => ({
          tenantId: current.tenantId,
          userId,
          type: "project.budget.overrun",
          channel: NotificationChannel.IN_APP,
          title: `Project ${current.code} exceeded budget`,
          body: `${current.name} is at least 10% over budget.`,
          metadata: payload,
        })),
      });
    }
  }

  private crossedThreshold(
    previous: Pick<ProjectAlertSnapshot, "budget" | "actualCost">,
    current: Pick<ProjectAlertSnapshot, "budget" | "actualCost">,
  ) {
    if (previous.budget <= 0n || current.budget <= 0n) {
      return false;
    }

    const previousThreshold = previous.budget * 110n;
    const currentThreshold = current.budget * 110n;

    return (
      previous.actualCost * 100n < previousThreshold &&
      current.actualCost * 100n >= currentThreshold
    );
  }
}
