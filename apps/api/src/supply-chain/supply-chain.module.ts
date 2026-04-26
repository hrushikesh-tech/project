import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { BullModule } from "@nestjs/bullmq";
import {
  areBackgroundQueuesEnabled,
  createQueueProvider,
} from "../common/queue/queue-runtime";
import { SupplyChainController } from "./supply-chain.controller";
import { SupplyChainService } from "./supply-chain.service";
import { SupplyChainExceptionFilter } from "./supply-chain-exception.filter";
import { GoodsReceiptService } from "./receiving/goods-receipt.service";
import { FifoInventoryService } from "./inventory/fifo-inventory.service";
import { ReorderAutomationService } from "./reorder/reorder-automation.service";
import {
  SUPPLY_CHAIN_QUEUE,
  SupplyChainQueue,
} from "./queue/supply-chain.queue";
import { SupplyChainProcessor } from "./queue/supply-chain.processor";
import { isWorkerRuntime } from "../runtime/runtime-mode";

const BACKGROUND_QUEUES_ENABLED = areBackgroundQueuesEnabled();

@Module({
  imports: [
    ...(BACKGROUND_QUEUES_ENABLED
      ? [
          BullModule.registerQueue({
            name: SUPPLY_CHAIN_QUEUE,
          }),
        ]
      : []),
  ],
  controllers: [SupplyChainController],
  providers: [
    SupplyChainService,
    GoodsReceiptService,
    FifoInventoryService,
    ReorderAutomationService,
    SupplyChainQueue,
    ...(BACKGROUND_QUEUES_ENABLED
      ? isWorkerRuntime()
        ? [SupplyChainProcessor]
        : []
      : [createQueueProvider(SUPPLY_CHAIN_QUEUE)]),
    {
      provide: APP_FILTER,
      useClass: SupplyChainExceptionFilter,
    },
  ],
  exports: [
    SupplyChainService,
    GoodsReceiptService,
    FifoInventoryService,
    ReorderAutomationService,
    SupplyChainQueue,
  ],
})
export class SupplyChainModule {}
