import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, Optional, ServiceUnavailableException } from "@nestjs/common";
import { Queue } from "bullmq";
import { areBackgroundQueuesEnabled } from "../../common/queue/queue-runtime";

export const PAYROLL_RUNS_QUEUE = "payroll-runs";
export const PROCESS_PAYROLL_RUN_JOB = "execute-payroll-run";

export interface PayrollRunJobPayload {
  tenantId: string;
  payrollRunId: string;
}

@Injectable()
export class PayrollQueue {
  private readonly logger = new Logger(PayrollQueue.name);

  constructor(
    @Optional()
    @InjectQueue(PAYROLL_RUNS_QUEUE)
    private readonly queue?: Queue<PayrollRunJobPayload>,
  ) {}

  async enqueueRun(payload: PayrollRunJobPayload) {
    if (!areBackgroundQueuesEnabled() || !this.queue) {
      this.logger.error(
        `Cannot enqueue payroll run ${payload.payrollRunId} because background queues are disabled.`,
      );
      throw new ServiceUnavailableException(
        "Payroll processing is unavailable because Redis-backed background queues are disabled.",
      );
    }

    return this.queue.add(PROCESS_PAYROLL_RUN_JOB, payload, {
      jobId: `${PROCESS_PAYROLL_RUN_JOB}:${payload.tenantId}:${payload.payrollRunId}`,
      removeOnComplete: 20,
      removeOnFail: 20,
    });
  }
}
