from __future__ import annotations

import os
from datetime import datetime
from time import perf_counter

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
from app.telemetry import create_telemetry_runtime
from app.services.lstm_service import LSTMTrainingService
from app.services.model_registry import ModelRegistry
from app.services.prediction_service import PredictionService
from app.services.prophet_service import ProphetTrainingService

app = FastAPI(title="Amdox AI ML Service")

telemetry = create_telemetry_runtime(
    service_name=os.getenv(
        "OTEL_SERVICE_NAME_ML",
        os.getenv("OTEL_SERVICE_NAME", "amdox-ml-service"),
    ),
    runtime="ml-service",
    otlp_endpoint=os.getenv(
        "ML_OTEL_EXPORTER_OTLP_ENDPOINT",
        os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318"),
    ),
    metrics_path=os.getenv("ML_METRICS_PATH", os.getenv("METRICS_PATH", "/metrics")),
    active_user_window_minutes=int(
        os.getenv("TELEMETRY_ACTIVE_USER_WINDOW_MINUTES", "15")
    ),
)
telemetry.install(app)

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
    with telemetry.span(
        "ml.train",
        {
            "tenant.id": payload.tenantId,
            "product.id": payload.productId,
            "horizon.days": payload.horizonDays,
        },
    ) as span:
        try:
            started = perf_counter()
            response = _train_models(payload)
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

        span.set_attribute("trained.models", len(response.trainedModels))
        span.set_attribute("skipped.models", len(response.skippedModels))
        span.set_attribute("operation.duration_seconds", perf_counter() - started)
        for model in response.trainedModels:
            telemetry.record_forecast_mape(
                tenant_id=model.tenantId,
                product_id=model.productId,
                model_type=model.modelType,
                mape_percent=float(model.mape),
            )
        return response


@app.post("/ml/retrain-all", response_model=RetrainAllResponse)
def retrain_all(payload: RetrainAllRequest):
    with telemetry.span("ml.retrain_all", {"job.count": len(payload.jobs)}) as span:
        results = []
        try:
            started = perf_counter()
            for job in payload.jobs:
                result = _train_models(
                    TrainRequest(
                        tenantId=job.tenantId,
                        productId=job.productId,
                        demandHistory=job.demandHistory,
                        horizonDays=job.horizonDays,
                    )
                )
                results.append(result)
                for model in result.trainedModels:
                    telemetry.record_forecast_mape(
                        tenant_id=model.tenantId,
                        product_id=model.productId,
                        model_type=model.modelType,
                        mape_percent=float(model.mape),
                    )
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

        span.set_attribute("result.count", len(results))
        span.set_attribute("operation.duration_seconds", perf_counter() - started)
        return RetrainAllResponse(results=results, generatedAt=datetime.utcnow())


@app.post("/ml/predict", response_model=PredictResponse)
def predict(payload: PredictRequest):
    with telemetry.span(
        "ml.predict",
        {
            "model.id": payload.modelId or "ad-hoc",
            "product.id": payload.productId or "unknown",
            "horizon.days": payload.horizonDays,
        },
    ) as span:
        try:
            started = perf_counter()
            model_summary, rows = prediction_service.predict(
                model_id=payload.modelId,
                artifact_uri=payload.artifactUri,
                mape=payload.mape,
                horizon_days=payload.horizonDays,
                forecast_start_date=payload.forecastStartDate,
            )
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

        response = PredictResponse(
            modelId=model_summary.get("id"),
            productId=model_summary.get("productId", payload.productId),
            modelType=model_summary["modelType"],
            mape=float(model_summary.get("mape", payload.mape or 0.0)),
            generatedAt=datetime.utcnow(),
            rows=rows,
        )
        telemetry.record_forecast_mape(
            tenant_id=model_summary.get("tenantId", payload.tenantId or "platform"),
            product_id=response.productId or payload.productId or "unknown",
            model_type=response.modelType,
            mape_percent=response.mape,
        )
        span.set_attribute("row.count", len(rows))
        span.set_attribute("operation.duration_seconds", perf_counter() - started)
        span.set_attribute("forecast.mape_percent", response.mape)
        return response


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
