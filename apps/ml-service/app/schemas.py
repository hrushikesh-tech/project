from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


class DemandPoint(BaseModel):
    ds: date
    y: float = Field(ge=0)


class TrainedModelSummary(BaseModel):
    id: str
    tenantId: str
    productId: str
    modelType: str
    version: str
    mape: float
    trainingWindowStart: date
    trainingWindowEnd: date
    dataPoints: int
    artifactUri: str
    metrics: dict[str, Any] | None = None
    trainedAt: datetime


class TrainRequest(BaseModel):
    tenantId: str
    productId: str
    demandHistory: list[DemandPoint]
    horizonDays: int = Field(default=30, ge=1, le=365)
    modelTypes: list[str] | None = None


class TrainResponse(BaseModel):
    tenantId: str
    productId: str
    trainedModels: list[TrainedModelSummary]
    skippedModels: list[str] = Field(default_factory=list)
    generatedAt: datetime


class PredictRequest(BaseModel):
    modelId: str | None = None
    artifactUri: str | None = None
    tenantId: str | None = None
    productId: str | None = None
    modelType: str | None = None
    mape: float | None = None
    horizonDays: int = Field(default=30, ge=1, le=365)
    forecastStartDate: date | None = None


class PredictionRow(BaseModel):
    forecastDate: date
    predictedDemand: float
    confidenceLower: float
    confidenceUpper: float
    horizonDay: int


class PredictResponse(BaseModel):
    modelId: str | None = None
    productId: str | None = None
    modelType: str
    mape: float
    generatedAt: datetime
    rows: list[PredictionRow]


class RetrainAllItem(BaseModel):
    tenantId: str
    productId: str
    demandHistory: list[DemandPoint]
    horizonDays: int = Field(default=30, ge=1, le=365)


class RetrainAllRequest(BaseModel):
    jobs: list[RetrainAllItem]


class RetrainAllResponse(BaseModel):
    results: list[TrainResponse]
    generatedAt: datetime


class HealthResponse(BaseModel):
    status: str
    service: str
    modelCount: int
    lastTrainingTime: datetime | None = None
