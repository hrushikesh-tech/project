from __future__ import annotations

from datetime import date, timedelta

from fastapi.testclient import TestClient

import main as main_module
from app.services.lstm_service import LSTMTrainingService
from app.services.model_registry import ModelRegistry
from app.services.prediction_service import PredictionService
from app.services.prophet_service import ProphetTrainingService


def build_history(points: int, *, start: date = date(2024, 1, 1)) -> list[dict]:
    history = []
    for index in range(points):
        day = start + timedelta(days=index)
        weekday_multiplier = 1.2 if day.weekday() < 5 else 0.7
        demand = round((24 + index * 0.03) * weekday_multiplier, 4)
        history.append({"ds": day.isoformat(), "y": demand})
    return history


def configure_runtime(tmp_path, monkeypatch):
    registry = ModelRegistry(str(tmp_path / "models"))
    monkeypatch.setattr(main_module, "registry", registry)
    monkeypatch.setattr(main_module, "prophet_service", ProphetTrainingService(registry))
    monkeypatch.setattr(main_module, "lstm_service", LSTMTrainingService(registry))
    monkeypatch.setattr(
        main_module,
        "prediction_service",
        PredictionService(registry, max_mape_percent=20),
    )
    return TestClient(main_module.app), registry


def test_prophet_training_returns_mape_below_20_percent(tmp_path) -> None:
    registry = ModelRegistry(str(tmp_path / "models"))
    service = ProphetTrainingService(registry)

    result = service.train("tenant-1", "product-1", build_history(180), 30)

    assert result["modelType"] == "PROPHET"
    assert result["mape"] < 20
    assert "artifactUri" in result
    assert result["metrics"]["outlierStats"]["removed"] == 0


def test_lstm_requires_500_points_before_training(tmp_path) -> None:
    registry = ModelRegistry(str(tmp_path / "models"))
    service = LSTMTrainingService(registry)

    try:
        service.train("tenant-1", "product-1", build_history(240), 30)
    except ValueError as error:
        assert "500" in str(error)
    else:
        raise AssertionError("LSTM training should reject series below 500 points.")


def test_lstm_records_early_stopping_for_eligible_series(tmp_path) -> None:
    registry = ModelRegistry(str(tmp_path / "models"))
    service = LSTMTrainingService(registry)

    result = service.train("tenant-1", "product-1", build_history(540), 30)

    assert result["modelType"] == "LSTM"
    assert result["metrics"]["earlyStoppingEpoch"] >= 1
    assert result["metrics"]["lookback"] == 60


def test_post_ml_predict_rejects_models_above_20_percent_mape(tmp_path, monkeypatch) -> None:
    client, _registry = configure_runtime(tmp_path, monkeypatch)
    train_response = client.post(
        "/ml/train",
        json={
            "tenantId": "tenant-1",
            "productId": "product-1",
            "demandHistory": build_history(180),
            "horizonDays": 14,
            "modelTypes": ["PROPHET"],
        },
    )
    trained_model = train_response.json()["trainedModels"][0]

    predict_response = client.post(
        "/ml/predict",
        json={
            "artifactUri": trained_model["artifactUri"],
            "productId": "product-1",
            "modelType": "PROPHET",
            "mape": 25,
            "horizonDays": 7,
        },
    )

    assert predict_response.status_code == 400
    assert "20%" in predict_response.json()["detail"]


def test_post_ml_predict_returns_confidence_bounds_and_health(tmp_path, monkeypatch) -> None:
    client, _registry = configure_runtime(tmp_path, monkeypatch)
    train_response = client.post(
        "/ml/train",
        json={
            "tenantId": "tenant-1",
            "productId": "product-1",
            "demandHistory": build_history(180),
            "horizonDays": 14,
            "modelTypes": ["PROPHET"],
        },
    )

    assert train_response.status_code == 200
    payload = train_response.json()
    trained_model = payload["trainedModels"][0]
    assert trained_model["mape"] < 20

    predict_response = client.post(
        "/ml/predict",
        json={
            "artifactUri": trained_model["artifactUri"],
            "productId": "product-1",
            "modelType": trained_model["modelType"],
            "mape": trained_model["mape"],
            "horizonDays": 7,
        },
    )

    assert predict_response.status_code == 200
    prediction_payload = predict_response.json()
    assert len(prediction_payload["rows"]) == 7
    assert all("confidenceLower" in row for row in prediction_payload["rows"])
    assert all("confidenceUpper" in row for row in prediction_payload["rows"])

    health_response = client.get("/health")
    assert health_response.status_code == 200
    health_payload = health_response.json()
    assert health_payload["modelCount"] == 1
    assert health_payload["lastTrainingTime"] is not None
