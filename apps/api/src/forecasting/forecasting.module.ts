import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { ForecastingClient } from "./forecasting.client";
import { ForecastingController } from "./forecasting.controller";
import { ForecastingExceptionFilter } from "./forecasting-exception.filter";
import { ForecastingService } from "./forecasting.service";
import { FORECASTING_QUEUE, ForecastingQueue } from "./queue/forecasting.queue";
import { ForecastingProcessor } from "./queue/forecasting.processor";

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: FORECASTING_QUEUE,
    }),
  ],
  controllers: [ForecastingController],
  providers: [
    ForecastingClient,
    ForecastingService,
    ForecastingQueue,
    ForecastingProcessor,
    {
      provide: APP_FILTER,
      useClass: ForecastingExceptionFilter,
    },
  ],
  exports: [ForecastingClient, ForecastingService],
})
export class ForecastingModule {}
