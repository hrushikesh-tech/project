import { createHmac, timingSafeEqual } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { NotificationChannel } from "@amdox/db";
import {
  NotificationChannelResult,
  NotificationWebhookPayload,
} from "@amdox/types";

@Injectable()
export class WebhookChannelService {
  createSignature(secret: string, payload: string) {
    return createHmac("sha256", secret).update(payload).digest("hex");
  }

  verifySignature(secret: string, payload: string, signature: string) {
    const expected = Buffer.from(this.createSignature(secret, payload));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length) {
      return false;
    }
    return timingSafeEqual(expected, actual);
  }

  async deliver(params: {
    endpoints: Array<{ id: string; url: string; secret: string }>;
    payload: NotificationWebhookPayload;
  }): Promise<NotificationChannelResult> {
    if (params.endpoints.length === 0) {
      return {
        channel: NotificationChannel.WEBHOOK,
        status: "SKIPPED",
        recipientCount: 0,
        detail: "No active webhook endpoints configured.",
      };
    }

    const body = JSON.stringify(params.payload);
    for (const endpoint of params.endpoints) {
      try {
        const response = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-amdox-signature": this.createSignature(endpoint.secret, body),
            "x-amdox-event-type": params.payload.eventType,
          },
          body,
        });
        if (!response.ok) {
          return {
            channel: NotificationChannel.WEBHOOK,
            status: "FAILED",
            recipientCount: params.endpoints.length,
            detail: `Webhook endpoint ${endpoint.id} responded with ${response.status}.`,
            retryable: true,
          };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          channel: NotificationChannel.WEBHOOK,
          status: "FAILED",
          recipientCount: params.endpoints.length,
          detail: message,
          retryable: true,
        };
      }
    }

    return {
      channel: NotificationChannel.WEBHOOK,
      status: "DELIVERED",
      recipientCount: params.endpoints.length,
    };
  }
}
