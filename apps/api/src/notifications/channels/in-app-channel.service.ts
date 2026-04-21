import { Injectable } from "@nestjs/common";
import { NotificationChannel } from "@amdox/db";
import { NotificationChannelResult } from "@amdox/types";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class InAppChannelService {
  async deliver(params: {
    db: ReturnType<PrismaService["forTenant"]>;
    tenantId: string;
    eventType: string;
    title: string | null;
    body: string;
    metadata: Record<string, unknown>;
    userIds: string[];
  }): Promise<NotificationChannelResult> {
    if (params.userIds.length === 0) {
      return {
        channel: NotificationChannel.IN_APP,
        status: "SKIPPED",
        recipientCount: 0,
        detail: "No user recipients resolved.",
      };
    }

    await params.db.notification.createMany({
      data: params.userIds.map((userId) => ({
        tenantId: params.tenantId,
        userId,
        type: params.eventType,
        channel: NotificationChannel.IN_APP,
        title: params.title ?? params.eventType,
        body: params.body,
        metadata: params.metadata,
      })),
    });

    return {
      channel: NotificationChannel.IN_APP,
      status: "DELIVERED",
      recipientCount: params.userIds.length,
    };
  }
}
