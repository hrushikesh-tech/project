import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NotificationChannel } from "@amdox/db";
import { NotificationChannelResult } from "@amdox/types";

@Injectable()
export class SmsChannelService {
  constructor(private readonly configService: ConfigService) {}

  async deliver(params: {
    recipients: string[];
    body: string;
  }): Promise<NotificationChannelResult> {
    const recipients = [...new Set(params.recipients.filter(Boolean))];
    if (recipients.length === 0) {
      return {
        channel: NotificationChannel.SMS,
        status: "SKIPPED",
        recipientCount: 0,
        detail: "No phone recipients resolved.",
      };
    }

    const providerUrl = this.configService.get<string>("SMS_PROVIDER_URL");
    const providerToken = this.configService.get<string>("SMS_PROVIDER_TOKEN");
    if (!providerUrl || !providerToken) {
      return {
        channel: NotificationChannel.SMS,
        status: "SKIPPED",
        recipientCount: recipients.length,
        detail: "SMS provider is not configured.",
      };
    }

    try {
      const response = await fetch(providerUrl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${providerToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          recipients,
          message: params.body,
        }),
      });
      if (!response.ok) {
        return {
          channel: NotificationChannel.SMS,
          status: "FAILED",
          recipientCount: recipients.length,
          detail: `SMS provider responded with ${response.status}.`,
          retryable: true,
        };
      }

      return {
        channel: NotificationChannel.SMS,
        status: "DELIVERED",
        recipientCount: recipients.length,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        channel: NotificationChannel.SMS,
        status: "FAILED",
        recipientCount: recipients.length,
        detail: message,
        retryable: true,
      };
    }
  }
}
