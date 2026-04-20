from __future__ import annotations

from datetime import datetime
from statistics import mean
from uuid import uuid4

try:
    import pandas as pd
    from prophet import Prophet
except Exception:  # pragma: no cover - optional dependency path
    pd = None
    Prophet = None

from .data_prep import (
    aggregate_daily_points,
    compute_mape,
    remove_outliers_iqr,
    split_train_validation,
    summarize_series,
)
from .model_registry import ModelRegistry


class ProphetTrainingService:
    def __init__(self, registry: ModelRegistry) -> None:
        self.registry = registry

    def train(self, tenant_id: str, product_id: str, demand_history: list[dict], horizon_days: int) -> dict:
        aggregated = aggregate_daily_points(demand_history)
        cleaned, outlier_stats = remove_outliers_iqr(aggregated)
        train_points, validation_points = split_train_validation(cleaned)
        if not train_points:
            raise ValueError("No usable demand history was provided for Prophet training.")

        predictions = self._predict_validation(train_points, validation_points)
        summary = summarize_series(cleaned)
        trained_at = datetime.utcnow()
        model_id = str(uuid4())
        version = f'prophet-{trained_at.strftime("%Y%m%d%H%M%S")}'
        metrics = {
            "validationWindow": len(validation_points),
            "outlierStats": outlier_stats,
            "seasonalityMode": "multiplicative",
            "horizonDays": horizon_days,
        }

        artifact = {
            "modelType": "PROPHET",
            "strategy": "prophet" if Prophet is not None and pd is not None else "fallback-prophet",
            "summary": summary,
            "history": cleaned,
            "horizonDays": horizon_days,
        }

        result = {
            "id": model_id,
            "tenantId": tenant_id,
            "productId": product_id,
            "modelType": "PROPHET",
            "version": version,
            "mape": compute_mape(
                [float(point["y"]) for point in validation_points],
                predictions,
            ),
            "trainingWindowStart": summary["window_start"],
            "trainingWindowEnd": summary["window_end"],
            "dataPoints": summary["data_points"],
            "artifactUri": "",
            "metrics": metrics,
            "trainedAt": trained_at,
        }
        result["artifactUri"] = self.registry.save_model(result, artifact)
        return result

    def _predict_validation(self, train_points: list[dict], validation_points: list[dict]) -> list[float]:
        if not validation_points:
            return [float(train_points[-1]["y"])]

        if Prophet is not None and pd is not None:
            train_frame = pd.DataFrame(
                [{"ds": point["ds"], "y": float(point["y"])} for point in train_points]
            )
            model = Prophet(
                seasonality_mode="multiplicative",
                weekly_seasonality=True,
                daily_seasonality=False,
                yearly_seasonality=len(train_points) >= 365,
            )
            model.fit(train_frame)
            future = model.make_future_dataframe(periods=len(validation_points), freq="D")
            forecast = model.predict(future).tail(len(validation_points))
            return [max(0.0, float(value)) for value in forecast["yhat"].tolist()]

        series_summary = summarize_series(train_points)
        history_mean = mean([float(point["y"]) for point in train_points])
        predictions = []
        for index, point in enumerate(validation_points, start=1):
            weekday = point["ds"].weekday()
            multiplier = series_summary["weekday_multipliers"].get(weekday, 1.0)
            predicted = max(
                0.0,
                (history_mean + series_summary["trend"] * index) * multiplier,
            )
            predictions.append(predicted)
        return predictions
