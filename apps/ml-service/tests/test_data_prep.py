from __future__ import annotations

from datetime import date, timedelta

from app.services.data_prep import (
    aggregate_daily_points,
    remove_outliers_iqr,
    summarize_series,
)


def test_aggregate_daily_points_merges_duplicate_days() -> None:
    day = date(2025, 1, 1)
    aggregated = aggregate_daily_points(
        [
            {"ds": day, "y": 3},
            {"ds": day, "y": 5},
            {"ds": day + timedelta(days=1), "y": 2},
        ]
    )

    assert aggregated == [
        {"ds": day, "y": 8.0},
        {"ds": day + timedelta(days=1), "y": 2.0},
    ]


def test_remove_outliers_iqr_strips_spikes_from_series() -> None:
    start = date(2025, 1, 1)
    points = [
        {"ds": start + timedelta(days=index), "y": value}
        for index, value in enumerate([10, 11, 12, 13, 12, 11, 95])
    ]

    filtered, stats = remove_outliers_iqr(points)

    assert len(filtered) == 6
    assert stats["removed"] == 1
    assert all(point["y"] < 95 for point in filtered)


def test_summarize_series_includes_window_and_weekday_shape() -> None:
    start = date(2025, 1, 1)
    points = [
        {"ds": start + timedelta(days=index), "y": 20 + (index % 3)}
        for index in range(14)
    ]

    summary = summarize_series(points)

    assert summary["data_points"] == 14
    assert summary["window_start"] == start
    assert summary["window_end"] == start + timedelta(days=13)
    assert summary["weekday_multipliers"]
