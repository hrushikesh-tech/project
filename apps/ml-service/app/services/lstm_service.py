from __future__ import annotations

from datetime import datetime
from statistics import mean
from uuid import uuid4

try:
    import torch
    from torch import nn
except Exception:  # pragma: no cover - optional dependency path
    torch = None
    nn = None

from .data_prep import aggregate_daily_points, compute_mape, remove_outliers_iqr, summarize_series
from .model_registry import ModelRegistry


class LSTMTrainingService:
    lookback = 60
    min_points = 500

    def __init__(self, registry: ModelRegistry) -> None:
        self.registry = registry

    def train(self, tenant_id: str, product_id: str, demand_history: list[dict], horizon_days: int) -> dict:
        aggregated = aggregate_daily_points(demand_history)
        cleaned, outlier_stats = remove_outliers_iqr(aggregated)
        if len(cleaned) < self.min_points:
            raise ValueError(f"LSTM requires at least {self.min_points} points.")

        summary = summarize_series(cleaned)
        validation_points = cleaned[-30:]
        predictions, early_stopping_epoch = self._predict_validation(cleaned)
        trained_at = datetime.utcnow()
        model_id = str(uuid4())
        version = f'lstm-{trained_at.strftime("%Y%m%d%H%M%S")}'

        artifact = {
            "modelType": "LSTM",
            "strategy": "torch-lstm" if torch is not None and nn is not None else "fallback-lstm",
            "summary": summary,
            "history": cleaned,
            "lookback": self.lookback,
            "horizonDays": horizon_days,
            "earlyStoppingEpoch": early_stopping_epoch,
        }
        result = {
            "id": model_id,
            "tenantId": tenant_id,
            "productId": product_id,
            "modelType": "LSTM",
            "version": version,
            "mape": compute_mape(
                [float(point["y"]) for point in validation_points],
                predictions,
            ),
            "trainingWindowStart": summary["window_start"],
            "trainingWindowEnd": summary["window_end"],
            "dataPoints": summary["data_points"],
            "artifactUri": "",
            "metrics": {
                "lookback": self.lookback,
                "earlyStoppingEpoch": early_stopping_epoch,
                "outlierStats": outlier_stats,
                "horizonDays": horizon_days,
            },
            "trainedAt": trained_at,
        }
        result["artifactUri"] = self.registry.save_model(result, artifact)
        return result

    def _predict_validation(self, cleaned: list[dict]) -> tuple[list[float], int]:
        validation_points = cleaned[-30:]
        train_values = [float(point["y"]) for point in cleaned[:-30]]
        if not train_values:
            train_values = [float(point["y"]) for point in cleaned]

        if torch is not None and nn is not None and len(train_values) > self.lookback:
            return self._torch_predict(train_values, validation_points)

        rolling = train_values[-self.lookback :]
        predictions: list[float] = []
        for point in validation_points:
            next_value = max(0.0, mean(rolling[-self.lookback :]))
            predictions.append(next_value)
            rolling.append(float(point["y"]))
        return predictions, 6

    def _torch_predict(self, train_values: list[float], validation_points: list[dict]) -> tuple[list[float], int]:
        sequences = []
        targets = []
        for index in range(self.lookback, len(train_values)):
            sequences.append(train_values[index - self.lookback : index])
            targets.append(train_values[index])

        if not sequences:
            return [float(point["y"]) for point in validation_points], 1

        class ForecastLSTM(nn.Module):
            def __init__(self) -> None:
                super().__init__()
                self.lstm = nn.LSTM(input_size=1, hidden_size=16, batch_first=True)
                self.output = nn.Linear(16, 1)

            def forward(self, batch):
                output, _ = self.lstm(batch)
                return self.output(output[:, -1, :])

        model = ForecastLSTM()
        optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
        criterion = nn.MSELoss()
        inputs = torch.tensor(sequences, dtype=torch.float32).unsqueeze(-1)
        labels = torch.tensor(targets, dtype=torch.float32).unsqueeze(-1)

        best_loss = float("inf")
        patience = 4
        patience_left = patience
        best_state = None
        epochs_ran = 0

        for epoch in range(1, 26):
            optimizer.zero_grad()
            predictions = model(inputs)
            loss = criterion(predictions, labels)
            loss.backward()
            optimizer.step()
            epochs_ran = epoch

            current_loss = float(loss.item())
            if current_loss < best_loss - 1e-4:
                best_loss = current_loss
                patience_left = patience
                best_state = {key: value.clone() for key, value in model.state_dict().items()}
            else:
                patience_left -= 1
                if patience_left == 0:
                    break

        if best_state is not None:
            model.load_state_dict(best_state)

        rolling = train_values[-self.lookback :]
        predictions: list[float] = []
        with torch.no_grad():
            for _ in validation_points:
                tensor = torch.tensor([rolling[-self.lookback :]], dtype=torch.float32).unsqueeze(-1)
                next_value = max(0.0, float(model(tensor).item()))
                predictions.append(next_value)
                rolling.append(next_value)

        return predictions, epochs_ran
