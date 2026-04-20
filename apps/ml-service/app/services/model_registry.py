from __future__ import annotations

import json
import os
import pickle
from datetime import datetime
from pathlib import Path
from typing import Any


class ModelRegistry:
    def __init__(self, storage_path: str | None = None) -> None:
        self.storage_path = Path(storage_path or os.getenv("ML_MODEL_STORAGE_PATH", "./artifacts/models"))
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self.index_path = self.storage_path / "index.json"

    def _read_index(self) -> list[dict[str, Any]]:
        if not self.index_path.exists():
            return []
        return json.loads(self.index_path.read_text(encoding="utf-8"))

    def _write_index(self, models: list[dict[str, Any]]) -> None:
        self.index_path.write_text(json.dumps(models, indent=2, sort_keys=True), encoding="utf-8")

    def save_model(self, summary: dict[str, Any], artifact: dict[str, Any]) -> str:
        artifact_dir = self.storage_path / summary["tenantId"] / summary["productId"]
        artifact_dir.mkdir(parents=True, exist_ok=True)
        artifact_path = artifact_dir / f'{summary["id"]}.pkl'
        with artifact_path.open("wb") as handle:
            pickle.dump(artifact, handle)

        summary = {
            **summary,
            "artifactUri": str(artifact_path).replace("\\", "/"),
            "trainedAt": self._serialize_datetime(summary["trainedAt"]),
            "trainingWindowStart": self._serialize_date(summary["trainingWindowStart"]),
            "trainingWindowEnd": self._serialize_date(summary["trainingWindowEnd"]),
        }

        index = [item for item in self._read_index() if item["id"] != summary["id"]]
        index.append(summary)
        index.sort(key=lambda item: item["trainedAt"], reverse=True)
        self._write_index(index)
        return summary["artifactUri"]

    def list_models(self) -> list[dict[str, Any]]:
        return self._read_index()

    def get_model(self, model_id: str) -> dict[str, Any] | None:
        for model in self._read_index():
            if model["id"] == model_id:
                return model
        return None

    def load_artifact(self, artifact_uri: str) -> dict[str, Any]:
        with Path(artifact_uri).open("rb") as handle:
            return pickle.load(handle)

    def health_snapshot(self) -> tuple[int, datetime | None]:
        models = self._read_index()
        if not models:
            return 0, None
        return len(models), datetime.fromisoformat(models[0]["trainedAt"])

    @staticmethod
    def _serialize_datetime(value: Any) -> str:
        if isinstance(value, datetime):
            return value.isoformat()
        return str(value)

    @staticmethod
    def _serialize_date(value: Any) -> str:
        if hasattr(value, "isoformat"):
            return value.isoformat()
        return str(value)
