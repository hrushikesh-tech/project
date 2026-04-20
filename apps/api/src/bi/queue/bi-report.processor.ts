import { Injectable } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { BiReportService } from "../reports/bi-report.service";
import {
  BI_REPORT_JOB,
  BI_REPORT_QUEUE,
  BiReportJobPayload,
} from "./bi-report.queue";

@Injectable()
@Processor(BI_REPORT_QUEUE)
export class BiReportProcessor extends WorkerHost {
  constructor(private readonly reportService: BiReportService) {
    super();
  }

  async process(job: Job<BiReportJobPayload>) {
    if (job.name !== BI_REPORT_JOB) {
      return { skipped: true, jobName: job.name };
    }

    return this.reportService.executeSchedule(
      job.data.scheduleId,
      job.data.tenantId,
      "queue",
    );
  }
}
