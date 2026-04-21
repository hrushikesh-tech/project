import net from "node:net";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NotificationChannel } from "@amdox/db";
import { NotificationChannelResult } from "@amdox/types";

@Injectable()
export class EmailChannelService {
  private readonly logger = new Logger(EmailChannelService.name);

  constructor(private readonly configService: ConfigService) {}

  async deliver(params: {
    recipients: string[];
    subject: string | null;
    body: string;
  }): Promise<NotificationChannelResult> {
    const recipients = [...new Set(params.recipients.filter(Boolean))];
    const host = this.configService.get<string>("SMTP_HOST");
    const port = Number(this.configService.get<number>("SMTP_PORT", 1025));
    const from = this.configService.get<string>(
      "NOTIFICATION_FROM_EMAIL",
      "notifications@amdox.local",
    );

    if (recipients.length === 0) {
      return {
        channel: NotificationChannel.EMAIL,
        status: "SKIPPED",
        recipientCount: 0,
        detail: "No email recipients resolved.",
      };
    }

    if (!host) {
      return {
        channel: NotificationChannel.EMAIL,
        status: "SKIPPED",
        recipientCount: recipients.length,
        detail: "SMTP host is not configured.",
      };
    }

    const socket = net.createConnection({ host, port });
    const readResponse = () =>
      new Promise<string>((resolve, reject) => {
        const onData = (chunk: Buffer) => {
          socket.off("error", onError);
          resolve(chunk.toString("utf8"));
        };
        const onError = (error: Error) => {
          socket.off("data", onData);
          reject(error);
        };
        socket.once("data", onData);
        socket.once("error", onError);
      });
    const sendCommand = async (command: string) => {
      socket.write(`${command}\r\n`);
      return readResponse();
    };

    try {
      await readResponse();
      await sendCommand("HELO amdox.local");
      await sendCommand(`MAIL FROM:<${from}>`);
      for (const recipient of recipients) {
        await sendCommand(`RCPT TO:<${recipient}>`);
      }
      await sendCommand("DATA");
      socket.write(
        [
          `From: ${from}`,
          `To: ${recipients.join(", ")}`,
          `Subject: ${params.subject ?? "Amdox notification"}`,
          "",
          params.body,
          "",
          ".",
          "",
        ].join("\r\n"),
      );
      await readResponse();
      await sendCommand("QUIT");
      socket.end();

      return {
        channel: NotificationChannel.EMAIL,
        status: "DELIVERED",
        recipientCount: recipients.length,
      };
    } catch (error) {
      socket.destroy();
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`SMTP delivery failed: ${message}`);
      return {
        channel: NotificationChannel.EMAIL,
        status: "FAILED",
        recipientCount: recipients.length,
        detail: message,
        retryable: true,
      };
    }
  }
}
