import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { BullModule } from "@nestjs/bullmq";
import {
  areBackgroundQueuesEnabled,
  createQueueProvider,
} from "../common/queue/queue-runtime";
import { HrController } from "./hr.controller";
import { HrExceptionFilter } from "./hr-exception.filter";
import { HrService } from "./hr.service";
import { HrOperationsProcessor } from "./queue/hr-operations.processor";
import {
  HR_OPERATIONS_QUEUE,
  HrOperationsQueue,
} from "./queue/hr-operations.queue";
import { isWorkerRuntime } from "../runtime/runtime-mode";

const BACKGROUND_QUEUES_ENABLED = areBackgroundQueuesEnabled();

@Module({
  imports: [
    ...(BACKGROUND_QUEUES_ENABLED
      ? [
          BullModule.registerQueue({
            name: HR_OPERATIONS_QUEUE,
          }),
        ]
      : []),
  ],
  controllers: [HrController],
  providers: [
    HrService,
    HrOperationsQueue,
    ...(BACKGROUND_QUEUES_ENABLED
      ? isWorkerRuntime()
        ? [HrOperationsProcessor]
        : []
      : [createQueueProvider(HR_OPERATIONS_QUEUE)]),
    {
      provide: APP_FILTER,
      useClass: HrExceptionFilter,
    },
  ],
  exports: [HrService],
})
export class HrModule {}
