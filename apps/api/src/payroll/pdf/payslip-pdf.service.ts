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
    return `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 24px;">
          <h1>Payslip</h1>
          <p><strong>Employee:</strong> ${params.employeeName}</p>
          <p><strong>Period:</strong> ${params.period}</p>
          <p><strong>Gross:</strong> ${params.grossPayMinor.toString()}</p>
          <p><strong>Net:</strong> ${params.netPayMinor.toString()}</p>
          <pre>${JSON.stringify(
            {
              earnings: params.earnings,
              deductions: params.deductions,
              taxBreakdown: params.taxBreakdown,
            },
            null,
            2,
          )}</pre>
        </body>
      </html>
    `;
  }
}
