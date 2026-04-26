import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import {
  areBackgroundQueuesEnabled,
  createQueueProvider,
} from "../common/queue/queue-runtime";
import { ForecastingClient } from "./forecasting.client";
import { ForecastingController } from "./forecasting.controller";
import { ForecastingExceptionFilter } from "./forecasting-exception.filter";
import { ForecastingService } from "./forecasting.service";
import { FORECASTING_QUEUE, ForecastingQueue } from "./queue/forecasting.queue";
import { ForecastingProcessor } from "./queue/forecasting.processor";

const BACKGROUND_QUEUES_ENABLED = areBackgroundQueuesEnabled();

@Module({
  imports: [
    ConfigModule,
    ...(BACKGROUND_QUEUES_ENABLED
      ? [
          BullModule.registerQueue({
            name: FORECASTING_QUEUE,
          }),
        ]
      : []),
  ],
  controllers: [ForecastingController],
  providers: [
    ForecastingClient,
    ForecastingService,
    ForecastingQueue,
    ...(BACKGROUND_QUEUES_ENABLED
      ? [ForecastingProcessor]
      : [createQueueProvider(FORECASTING_QUEUE)]),
    {
      provide: APP_FILTER,
      useClass: ForecastingExceptionFilter,
    },
  ],
  exports: [ForecastingClient, ForecastingService],
})
export class ForecastingModule {}
