from __future__ import annotations

from datetime import date, datetime
from math import ceil
from statistics import mean


def _to_date(value: date | datetime | str) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return datetime.fromisoformat(str(value)).date()


def aggregate_daily_points(points: list[dict]) -> list[dict]:
    bucket: dict[date, float] = {}
    for point in points:
        day = _to_date(point["ds"])
        bucket[day] = bucket.get(day, 0.0) + float(point["y"])
    return [{"ds": day, "y": bucket[day]} for day in sorted(bucket)]


def _quantile(values: list[float], percentile: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * percentile
    lower_index = int(position)
    upper_index = min(lower_index + 1, len(ordered) - 1)
    fraction = position - lower_index
    return ordered[lower_index] + (ordered[upper_index] - ordered[lower_index]) * fraction


def remove_outliers_iqr(points: list[dict]) -> tuple[list[dict], dict]:
    if len(points) < 4:
        return points, {"q1": 0.0, "q3": 0.0, "iqr": 0.0, "removed": 0}

    values = [float(point["y"]) for point in points]
    q1 = _quantile(values, 0.25)
    q3 = _quantile(values, 0.75)
    iqr = q3 - q1
    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr
    filtered = [point for point in points if lower <= float(point["y"]) <= upper]
    return filtered, {"q1": q1, "q3": q3, "iqr": iqr, "removed": len(points) - len(filtered)}


def split_train_validation(points: list[dict], *, min_validation: int = 7, max_validation: int = 30) -> tuple[list[dict], list[dict]]:
    if len(points) < 3:
        return points, []

    validation_size = max(min_validation, ceil(len(points) * 0.2))
    validation_size = min(max_validation, validation_size)
    if validation_size >= len(points):
        validation_size = max(1, len(points) // 3)
    return points[:-validation_size], points[-validation_size:]


def compute_mape(actual: list[float], predicted: list[float]) -> float:
    if not actual:
        return 0.0
    errors = []
    for actual_value, predicted_value in zip(actual, predicted, strict=False):
        denominator = max(abs(actual_value), 1e-6)
        errors.append(abs(actual_value - predicted_value) / denominator)
    if not errors:
        return 0.0
    return round(mean(errors) * 100, 4)


def build_weekday_multipliers(points: list[dict]) -> dict[int, float]:
    weekday_values: dict[int, list[float]] = {}
    overall_mean = mean([float(point["y"]) for point in points]) if points else 1.0
    baseline = overall_mean or 1.0
    for point in points:
        weekday_values.setdefault(_to_date(point["ds"]).weekday(), []).append(float(point["y"]))
    return {
        weekday: max(0.2, mean(values) / baseline)
        for weekday, values in weekday_values.items()
    }


def summarize_series(points: list[dict]) -> dict:
    values = [float(point["y"]) for point in points]
    if not values:
        return {
            "data_points": 0,
            "average": 0.0,
            "std_dev": 0.0,
            "trend": 0.0,
            "last_value": 0.0,
            "window_end": None,
            "window_start": None,
            "weekday_multipliers": {},
        }

    average = mean(values)
    variance = mean([(value - average) ** 2 for value in values]) if len(values) > 1 else 0.0
    trend = (values[-1] - values[0]) / max(1, len(values) - 1)
    return {
        "data_points": len(values),
        "average": average,
        "std_dev": variance ** 0.5,
        "trend": trend,
        "last_value": values[-1],
        "window_start": _to_date(points[0]["ds"]),
        "window_end": _to_date(points[-1]["ds"]),
        "weekday_multipliers": build_weekday_multipliers(points),
    }
