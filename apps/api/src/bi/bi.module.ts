import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { BiController } from "./bi.controller";
import { BiService } from "./bi.service";
import { BiExceptionFilter } from "./bi-exception.filter";
import { BiMetricsService } from "./metrics/bi-metrics.service";
import { BiRefreshService } from "./bi-refresh.service";
import { BiReportService } from "./reports/bi-report.service";
import { BiReportPdfService } from "./reports/bi-report-pdf.service";
import { BiReportExcelService } from "./reports/bi-report-excel.service";
import { BiReportStorageService } from "./reports/bi-report-storage.service";
import { BiReportMailerService } from "./reports/bi-report-mailer.service";
import { BI_REPORT_QUEUE, BiReportQueue } from "./queue/bi-report.queue";
import { BiReportProcessor } from "./queue/bi-report.processor";
import { isWorkerRuntime } from "../runtime/runtime-mode";

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: BI_REPORT_QUEUE,
    }),
  ],
  controllers: [BiController],
  providers: [
    BiService,
    BiMetricsService,
    BiRefreshService,
    BiReportService,
    BiReportPdfService,
    BiReportExcelService,
    BiReportStorageService,
    BiReportMailerService,
    BiReportQueue,
    ...(isWorkerRuntime() ? [BiReportProcessor] : []),
    {
      provide: APP_FILTER,
      useClass: BiExceptionFilter,
    },
  ],
  exports: [BiService, BiMetricsService, BiReportService],
})
export class BiModule {}
