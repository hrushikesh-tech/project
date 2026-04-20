import { Injectable } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { ForecastingService } from "../forecasting.service";
import {
  FORECASTING_QUEUE,
  ForecastingJobPayload,
  WEEKLY_RETRAIN_JOB,
} from "./forecasting.queue";

@Injectable()
@Processor(FORECASTING_QUEUE)
export class ForecastingProcessor extends WorkerHost {
  constructor(private readonly forecastingService: ForecastingService) {
    super();
  }

  async process(job: Job<ForecastingJobPayload>) {
    if (job.name === WEEKLY_RETRAIN_JOB) {
      return this.forecastingService.runWeeklyRetrainingForTenant(
        job.data.tenantId,
      );
    }

    return { skipped: true, jobName: job.name };
  }
}
