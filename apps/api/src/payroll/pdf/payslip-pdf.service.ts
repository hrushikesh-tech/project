import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PayslipGenerationFailureException } from "@amdox/types";

@Injectable()
export class PayslipPdfService {
  constructor(private readonly configService: ConfigService) {}

  async renderPayslip(params: {
    employeeName: string;
    period: string;
    grossPayMinor: bigint;
    netPayMinor: bigint;
    earnings: unknown;
    deductions: unknown;
    taxBreakdown: unknown;
  }) {
    try {
      const puppeteerModule = await import("puppeteer");
      const browser = await puppeteerModule.default.launch({
        headless: true,
        executablePath:
          this.configService.get<string>("PUPPETEER_EXECUTABLE_PATH") ||
          this.configService.get<string>("CHROME_BIN") ||
          undefined,
        args: [
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--no-first-run",
          "--no-default-browser-check",
        ],
      });
      try {
        const page = await browser.newPage();
        await page.setContent(this.buildHtml(params), {
          waitUntil: "networkidle0",
        });
        return Buffer.from(
          await page.pdf({
            format: "A4",
            printBackground: true,
          }),
        );
      } finally {
        await browser.close();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (this.shouldUseFallbackPdf(error)) {
        return this.renderFallbackPdf(params);
      }
      throw new PayslipGenerationFailureException(message);
    }
  }

  private buildHtml(params: {
    employeeName: string;
    period: string;
    grossPayMinor: bigint;
    netPayMinor: bigint;
    earnings: unknown;
    deductions: unknown;
    taxBreakdown: unknown;
  }) {
    const serialize = (value: unknown) =>
      JSON.stringify(
        value,
        (_key, nestedValue) =>
          typeof nestedValue === "bigint"
            ? nestedValue.toString()
            : nestedValue,
        2,
      );

    return `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 24px;">
          <h1>Payslip</h1>
          <p><strong>Employee:</strong> ${params.employeeName}</p>
          <p><strong>Period:</strong> ${params.period}</p>
          <p><strong>Gross:</strong> ${params.grossPayMinor.toString()}</p>
          <p><strong>Net:</strong> ${params.netPayMinor.toString()}</p>
          <pre>${serialize({
            earnings: params.earnings,
            deductions: params.deductions,
            taxBreakdown: params.taxBreakdown,
          })}</pre>
        </body>
      </html>
    `;
  }

  private shouldUseFallbackPdf(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return (
      (message.includes("spawn") && message.includes("EPERM")) ||
      message.includes("Failed to launch the browser process") ||
      message.includes("Browser was not found")
    );
  }

  private renderFallbackPdf(params: {
    employeeName: string;
    period: string;
    grossPayMinor: bigint;
    netPayMinor: bigint;
    earnings: unknown;
    deductions: unknown;
    taxBreakdown: unknown;
  }) {
    const lines = [
      "Payslip",
      `Employee: ${params.employeeName}`,
      `Period: ${params.period}`,
      `Gross: ${params.grossPayMinor.toString()}`,
      `Net: ${params.netPayMinor.toString()}`,
      `Earnings: ${JSON.stringify(params.earnings, this.bigintReplacer)}`,
      `Deductions: ${JSON.stringify(params.deductions, this.bigintReplacer)}`,
      `Tax: ${JSON.stringify(params.taxBreakdown, this.bigintReplacer)}`,
    ];
    return this.buildSimplePdf(lines);
  }

  private bigintReplacer(_key: string, value: unknown) {
    return typeof value === "bigint" ? value.toString() : value;
  }

  private buildSimplePdf(lines: string[]) {
    const escapedLines = lines.map((line) => this.escapePdfText(line));
    const content = [
      "BT",
      "/F1 12 Tf",
      "50 780 Td",
      ...escapedLines.flatMap((line, index) =>
        index === 0 ? [`(${line}) Tj`] : ["0 -18 Td", `(${line}) Tj`],
      ),
      "ET",
    ].join("\n");

    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
    ];

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for (let index = 0; index < objects.length; index += 1) {
      offsets.push(Buffer.byteLength(pdf, "utf8"));
      pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
    }

    const xrefStart = Buffer.byteLength(pdf, "utf8");
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += "0000000000 65535 f \n";
    for (let index = 1; index < offsets.length; index += 1) {
      pdf += `${offsets[index].toString().padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
    return Buffer.from(pdf, "utf8");
  }

  private escapePdfText(value: string) {
    return value
      .replaceAll("\\", "\\\\")
      .replaceAll("(", "\\(")
      .replaceAll(")", "\\)");
  }
}
