import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
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

@Module({
  imports: [
    ConfigModule,
    FinanceModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: parseRedisConnection(
          configService.get<string>("REDIS_URL", "redis://127.0.0.1:6379"),
        ),
      }),
    }),
    BullModule.registerQueue({
      name: INVOICE_OCR_QUEUE,
    }),
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
    InvoiceOcrProcessor,
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
