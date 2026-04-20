export interface PredictForecastDto {
  modelId?: string;
  artifactUri?: string;
  tenantId?: string;
  productId?: string;
  modelType?: string;
  mape?: number;
  horizonDays: number;
  forecastStartDate?: string;
}
