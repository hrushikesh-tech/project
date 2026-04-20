import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { PredictForecastDto } from "./dto/predict-forecast.dto";
import type { TrainForecastDto } from "./dto/train-forecast.dto";

interface TrainedModelSummary {
  id: string;
  tenantId: string;
  productId: string;
  modelType: string;
  version: string;
  mape: number;
  trainingWindowStart: string;
  trainingWindowEnd: string;
  dataPoints: number;
  artifactUri: string;
  metrics?: Record<string, unknown> | null;
  trainedAt: string;
}

interface TrainResponse {
  tenantId: string;
  productId: string;
  trainedModels: TrainedModelSummary[];
  skippedModels: string[];
  generatedAt: string;
}

interface PredictionRow {
  forecastDate: string;
  predictedDemand: number;
  confidenceLower: number;
  confidenceUpper: number;
  horizonDay: number;
}

interface PredictResponse {
  modelId?: string;
  productId?: string;
  modelType: string;
  mape: number;
  generatedAt: string;
  rows: PredictionRow[];
}

interface HealthResponse {
  status: string;
  service: string;
  modelCount: number;
  lastTrainingTime?: string | null;
}

@Injectable()
export class ForecastingClient {
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      "ML_SERVICE_URL",
      "http://localhost:8000",
    );
  }

  async train(payload: TrainForecastDto): Promise<TrainResponse> {
    return this.post<TrainResponse>("/ml/train", payload);
  }

  async predict(payload: PredictForecastDto): Promise<PredictResponse> {
    return this.post<PredictResponse>("/ml/predict", payload);
  }

  async listModels(): Promise<TrainedModelSummary[]> {
    return this.get<TrainedModelSummary[]>("/ml/models");
  }

  async getModelDetails(modelId: string): Promise<TrainedModelSummary> {
    return this.get<TrainedModelSummary>(`/ml/models/${modelId}`);
  }

  async retrainAll(payload: {
    jobs: TrainForecastDto[];
  }): Promise<{ results: TrainResponse[]; generatedAt: string }> {
    return this.post("/ml/retrain-all", payload);
  }

  async health(): Promise<HealthResponse> {
    return this.get<HealthResponse>("/health");
  }

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`);
    if (!response.ok) {
      throw new Error(`ML service GET ${path} failed with ${response.status}`);
    }
    return (await response.json()) as T;
  }

  private async post<T>(path: string, payload: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `ML service POST ${path} failed with ${response.status}: ${detail}`,
      );
    }

    return (await response.json()) as T;
  }
}

export type {
  PredictResponse,
  PredictionRow,
  TrainResponse,
  TrainedModelSummary,
};
