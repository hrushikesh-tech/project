export class ForecastQualityGateFailed extends Error {
  constructor(message = "Forecast MAPE exceeds the 20% quality gate") {
    super(message);
    this.name = "ForecastQualityGateFailed";
  }
}

export class InsufficientForecastHistory extends Error {
  constructor(points: number, required: number) {
    super(
      `Insufficient history for forecasting. Got ${points} points, need ${required}.`,
    );
    this.name = "InsufficientForecastHistory";
  }
}

export class ActiveForecastModelNotFound extends Error {
  constructor(productId: string) {
    super(`No active forecast model found for product ${productId}`);
    this.name = "ActiveForecastModelNotFound";
  }
}

export class ForecastPromotionRejected extends Error {
  constructor(reason: string) {
    super(`Forecast model promotion rejected: ${reason}`);
    this.name = "ForecastPromotionRejected";
  }
}

export interface MLPredictionRow {
  forecastDate: string;
  predictedDemand: number;
  confidenceLower: number;
  confidenceUpper: number;
  horizonDay: number;
}

export interface MLTrainResult {
  modelType: string;
  version: string;
  mape: number;
  trainingWindowStart: string;
  trainingWindowEnd: string;
  dataPoints: number;
  artifactUri: string;
  metrics?: Record<string, unknown>;
}
