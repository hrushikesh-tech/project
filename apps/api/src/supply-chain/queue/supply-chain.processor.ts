import { Injectable } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";
import { ReorderAutomationService } from "../reorder/reorder-automation.service";
import {
  AUTO_REORDER_JOB,
  SUPPLY_CHAIN_QUEUE,
  SupplyChainJobPayload,
} from "./supply-chain.queue";

@Injectable()
@Processor(SUPPLY_CHAIN_QUEUE)
export class SupplyChainProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reorderAutomationService: ReorderAutomationService,
  ) {
    super();
  }

  async process(job: Job<SupplyChainJobPayload>) {
    if (job.name === AUTO_REORDER_JOB) {
      this.prisma.forTenant(job.data.tenantId);
      return this.reorderAutomationService.runForTenant(job.data.tenantId);
    }

    return { skipped: true, jobName: job.name };
  }
}
