export interface ForecastDemandPointDto {
  ds: string;
  y: number;
}

export interface TrainForecastDto {
  tenantId: string;
  productId: string;
  demandHistory: ForecastDemandPointDto[];
  horizonDays: number;
  modelTypes?: string[];
}
