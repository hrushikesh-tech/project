import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";

export const PAYROLL_RUNS_QUEUE = "payroll-runs";
export const PROCESS_PAYROLL_RUN_JOB = "execute-payroll-run";

export interface PayrollRunJobPayload {
  tenantId: string;
  payrollRunId: string;
}

@Injectable()
export class PayrollQueue {
  constructor(
    @InjectQueue(PAYROLL_RUNS_QUEUE)
    private readonly queue: Queue<PayrollRunJobPayload>,
  ) {}

  async enqueueRun(payload: PayrollRunJobPayload) {
    return this.queue.add(PROCESS_PAYROLL_RUN_JOB, payload, {
      jobId: `${PROCESS_PAYROLL_RUN_JOB}:${payload.tenantId}:${payload.payrollRunId}`,
      removeOnComplete: 20,
      removeOnFail: 20,
    });
  }
}
