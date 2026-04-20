import net from "node:net";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class BiReportMailerService {
  private readonly logger = new Logger(BiReportMailerService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendReportReadyEmail(params: {
    recipients: string[];
    dashboardTitle: string;
    downloadLinks: string[];
  }) {
    const host = this.configService.get<string>("SMTP_HOST");
    const port = Number(this.configService.get<number>("SMTP_PORT", 1025));
    const from = this.configService.get<string>(
      "REPORT_FROM_EMAIL",
      "reports@amdox.local",
    );

    if (!host || params.recipients.length === 0) {
      return { sent: false, skipped: true };
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
      for (const recipient of params.recipients) {
        await sendCommand(`RCPT TO:<${recipient}>`);
      }
      await sendCommand("DATA");
      socket.write(
        [
          `From: ${from}`,
          `To: ${params.recipients.join(", ")}`,
          `Subject: BI report ready - ${params.dashboardTitle}`,
          "",
          `Your BI dashboard report for "${params.dashboardTitle}" is ready.`,
          ...params.downloadLinks.map((link) => `Download: ${link}`),
          "",
          ".",
          "",
        ].join("\r\n"),
      );
      await readResponse();
      await sendCommand("QUIT");
      socket.end();
      return { sent: true };
    } catch (error) {
      socket.destroy();
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`SMTP delivery skipped: ${message}`);
      return { sent: false, error: message };
    }
  }
}
