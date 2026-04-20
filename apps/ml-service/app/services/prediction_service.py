from __future__ import annotations

from datetime import date, datetime, timedelta
from statistics import mean

from .model_registry import ModelRegistry


class PredictionService:
    def __init__(self, registry: ModelRegistry, max_mape_percent: float = 20.0) -> None:
        self.registry = registry
        self.max_mape_percent = max_mape_percent

    def predict(
        self,
        *,
        model_id: str | None,
        artifact_uri: str | None,
        mape: float | None,
        horizon_days: int,
        forecast_start_date: date | None,
    ) -> tuple[dict, list[dict]]:
        model_summary = self.registry.get_model(model_id) if model_id else None
        if model_summary is None and artifact_uri is None:
            raise ValueError("A modelId or artifactUri is required for prediction.")

        effective_mape = mape if mape is not None else float(model_summary["mape"])
        if effective_mape > self.max_mape_percent:
            raise ValueError("Forecast MAPE exceeds the 20% quality gate.")

        artifact = self.registry.load_artifact(artifact_uri or model_summary["artifactUri"])
        summary = artifact["summary"]
        start_date = forecast_start_date or summary["window_end"] + timedelta(days=1)
        if isinstance(start_date, datetime):
            start_date = start_date.date()

        rows = []
        rolling = [float(point["y"]) for point in artifact["history"]][- max(7, artifact.get("lookback", 7)) :]
        for horizon_day in range(1, horizon_days + 1):
            target_date = start_date + timedelta(days=horizon_day - 1)
            weekday_multiplier = summary["weekday_multipliers"].get(target_date.weekday(), 1.0)
            if artifact["modelType"] == "LSTM":
                predicted = max(0.0, mean(rolling[-artifact.get("lookback", 7) :]) + summary["trend"] * 0.2)
            else:
                predicted = max(
                    0.0,
                    (summary["last_value"] + summary["trend"] * horizon_day) * weekday_multiplier,
                )
            spread = max(1.0, summary["std_dev"] * 1.96)
            rows.append(
                {
                    "forecastDate": target_date,
                    "predictedDemand": round(predicted, 4),
                    "confidenceLower": round(max(0.0, predicted - spread), 4),
                    "confidenceUpper": round(predicted + spread, 4),
                    "horizonDay": horizon_day,
                }
            )
            rolling.append(predicted)

        return model_summary or {"id": None, "modelType": artifact["modelType"], "mape": effective_mape}, rows
