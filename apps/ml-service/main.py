from __future__ import annotations

import os
from datetime import datetime

from fastapi import FastAPI, HTTPException

from app.schemas import (
    HealthResponse,
    PredictRequest,
    PredictResponse,
    RetrainAllRequest,
    RetrainAllResponse,
    TrainRequest,
    TrainResponse,
)
from app.services.lstm_service import LSTMTrainingService
from app.services.model_registry import ModelRegistry
from app.services.prediction_service import PredictionService
from app.services.prophet_service import ProphetTrainingService

app = FastAPI(title="Amdox AI ML Service")

registry = ModelRegistry(os.getenv("ML_MODEL_STORAGE_PATH"))
max_mape_percent = float(os.getenv("ML_MAX_MAPE_PERCENT", "20"))
prophet_service = ProphetTrainingService(registry)
lstm_service = LSTMTrainingService(registry)
prediction_service = PredictionService(registry, max_mape_percent=max_mape_percent)


def _dump_model(model) -> dict:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


def _train_models(payload: TrainRequest) -> TrainResponse:
    trained_models = []
    skipped_models = []
    requested = payload.modelTypes or ["PROPHET", "LSTM"]
    requested = [model_type.upper() for model_type in requested]

    if "PROPHET" in requested:
        trained_models.append(
            prophet_service.train(
                payload.tenantId,
                payload.productId,
                [_dump_model(point) for point in payload.demandHistory],
                payload.horizonDays,
            )
        )

    if "LSTM" in requested:
        try:
            trained_models.append(
                lstm_service.train(
                    payload.tenantId,
                    payload.productId,
                    [_dump_model(point) for point in payload.demandHistory],
                    payload.horizonDays,
                )
            )
        except ValueError:
            skipped_models.append("LSTM")

    return TrainResponse(
        tenantId=payload.tenantId,
        productId=payload.productId,
        trainedModels=trained_models,
        skippedModels=skipped_models,
        generatedAt=datetime.utcnow(),
    )


@app.get("/")
def read_root():
    return {"status": "healthy", "service": "ml-service"}


@app.post("/ml/train", response_model=TrainResponse)
def train_model(payload: TrainRequest):
    try:
        return _train_models(payload)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/ml/retrain-all", response_model=RetrainAllResponse)
def retrain_all(payload: RetrainAllRequest):
    results = []
    try:
        for job in payload.jobs:
            results.append(
                _train_models(
                    TrainRequest(
                        tenantId=job.tenantId,
                        productId=job.productId,
                        demandHistory=job.demandHistory,
                        horizonDays=job.horizonDays,
                    )
                )
            )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return RetrainAllResponse(results=results, generatedAt=datetime.utcnow())


@app.post("/ml/predict", response_model=PredictResponse)
def predict(payload: PredictRequest):
    try:
        model_summary, rows = prediction_service.predict(
            model_id=payload.modelId,
            artifact_uri=payload.artifactUri,
            mape=payload.mape,
            horizon_days=payload.horizonDays,
            forecast_start_date=payload.forecastStartDate,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    return PredictResponse(
        modelId=model_summary.get("id"),
        productId=model_summary.get("productId", payload.productId),
        modelType=model_summary["modelType"],
        mape=float(model_summary.get("mape", payload.mape or 0.0)),
        generatedAt=datetime.utcnow(),
        rows=rows,
    )


@app.get("/ml/models")
def list_models():
    return registry.list_models()


@app.get("/ml/models/{model_id}")
def get_model(model_id: str):
    model = registry.get_model(model_id)
    if model is None:
        raise HTTPException(status_code=404, detail="Model not found")
    return model


@app.get("/health", response_model=HealthResponse)
def health():
    model_count, last_training_time = registry.health_snapshot()
    return HealthResponse(
        status="healthy",
        service="ml-service",
        modelCount=model_count,
        lastTrainingTime=last_training_time,
    )
