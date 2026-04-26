import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { BullModule } from "@nestjs/bullmq";
import { HrController } from "./hr.controller";
import { HrExceptionFilter } from "./hr-exception.filter";
import { HrService } from "./hr.service";
import { HrOperationsProcessor } from "./queue/hr-operations.processor";
import {
  HR_OPERATIONS_QUEUE,
  HrOperationsQueue,
} from "./queue/hr-operations.queue";
import { isWorkerRuntime } from "../runtime/runtime-mode";

@Module({
  imports: [
    BullModule.registerQueue({
      name: HR_OPERATIONS_QUEUE,
    }),
  ],
  controllers: [HrController],
  providers: [
    HrService,
    HrOperationsQueue,
    ...(isWorkerRuntime() ? [HrOperationsProcessor] : []),
    {
      provide: APP_FILTER,
      useClass: HrExceptionFilter,
    },
  ],
  exports: [HrService],
})
export class HrModule {}
