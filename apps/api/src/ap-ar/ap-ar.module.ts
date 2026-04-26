import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import {
  areBackgroundQueuesEnabled,
  createQueueProvider,
} from "../common/queue/queue-runtime";
import { FinanceModule } from "../finance/finance.module";
import { ApArController } from "./ap-ar.controller";
import { ApArService } from "./ap-ar.service";
import { AgingReportService } from "./reports/aging-report.service";
import { ThreeWayMatchService } from "./matching/three-way-match.service";
import { OcrMapperService } from "./ocr/ocr-mapper.service";
import { OCR_PROVIDERS } from "./ocr/ocr.provider";
import { TesseractOcrProvider } from "./ocr/tesseract-ocr.provider";
import { TextractOcrProvider } from "./ocr/textract-ocr.provider";
import { InvoiceLedgerPostingService } from "./posting/invoice-ledger-posting.service";
import { InvoiceOcrProcessor } from "./queue/invoice-ocr.processor";
import { INVOICE_OCR_QUEUE } from "./queue/invoice-ocr.queue";
import { InvoiceStorageService } from "./storage/invoice-storage.service";
import { isWorkerRuntime } from "../runtime/runtime-mode";

const BACKGROUND_QUEUES_ENABLED = areBackgroundQueuesEnabled();

@Module({
  imports: [
    ConfigModule,
    FinanceModule,
    ...(BACKGROUND_QUEUES_ENABLED
      ? [
          BullModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
              connection: readRedisConnection(configService),
            }),
          }),
          BullModule.registerQueue({
            name: INVOICE_OCR_QUEUE,
          }),
        ]
      : []),
  ],
  controllers: [ApArController],
  providers: [
    ApArService,
    InvoiceStorageService,
    OcrMapperService,
    ThreeWayMatchService,
    InvoiceLedgerPostingService,
    AgingReportService,
    TextractOcrProvider,
    TesseractOcrProvider,
    {
      provide: OCR_PROVIDERS,
      inject: [TextractOcrProvider, TesseractOcrProvider],
      useFactory: (
        textractProvider: TextractOcrProvider,
        tesseractProvider: TesseractOcrProvider,
      ) => [textractProvider, tesseractProvider],
    },
    ...(BACKGROUND_QUEUES_ENABLED
      ? isWorkerRuntime()
        ? [InvoiceOcrProcessor]
        : []
      : [createQueueProvider(INVOICE_OCR_QUEUE)]),
  ],
})
export class ApArModule {}

function parseRedisConnection(redisUrl: string) {
  const parsed = new URL(redisUrl);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  };
}

function readRedisConnection(configService: ConfigService) {
  const redisUrl = configService.get<string>("REDIS_URL");
  if (redisUrl) {
    return parseRedisConnection(redisUrl);
  }

  return {
    host: configService.getOrThrow<string>("REDIS_HOST"),
    port: Number(configService.get<number>("REDIS_PORT", 6379)),
    username: configService.get<string>("REDIS_USERNAME") || undefined,
    password: configService.get<string>("REDIS_PASSWORD") || undefined,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  };
}
