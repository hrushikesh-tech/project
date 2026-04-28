from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from collections.abc import Iterable
from contextlib import AbstractContextManager
from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.responses import PlainTextResponse

TELEMETRY_METRIC_NAMES = {
    "forecast_mape_percent": "forecast_mape_percent",
    "active_users_per_tenant": "active_users_per_tenant",
    "runtime_request_duration_seconds": "runtime_request_duration_seconds",
}

METRIC_DEFINITIONS: dict[str, dict[str, Any]] = {
    TELEMETRY_METRIC_NAMES["forecast_mape_percent"]: {
        "kind": "gauge",
        "help": "Most recently observed forecast mean absolute percentage error.",
    },
    TELEMETRY_METRIC_NAMES["active_users_per_tenant"]: {
        "kind": "gauge",
        "help": "Distinct active users observed in the rolling activity window.",
    },
    TELEMETRY_METRIC_NAMES["runtime_request_duration_seconds"]: {
        "kind": "histogram",
        "help": "Duration of completed runtime requests in seconds.",
        "buckets": [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
    },
}


def _normalize_labels(labels: dict[str, Any] | None = None) -> dict[str, str]:
    normalized: dict[str, str] = {}
    for key, value in sorted((labels or {}).items()):
        if value is None:
            continue
        normalized[key] = str(value)
    return normalized


def _series_key(metric_name: str, labels: dict[str, str]) -> str:
    return f"{metric_name}|{json.dumps(labels, sort_keys=True, separators=(',', ':'))}"


def _escape_label(value: str) -> str:
    return value.replace("\\", "\\\\").replace("\n", "\\n").replace('"', '\\"')


def _format_labels(labels: dict[str, str]) -> str:
    if not labels:
        return ""
    return "{" + ",".join(f'{key}="{_escape_label(value)}"' for key, value in labels.items()) + "}"


@dataclass
class _CounterSeries:
    key: str
    labels: dict[str, str]
    value: float = 0.0


@dataclass
class _GaugeSeries:
    key: str
    labels: dict[str, str]
    value: float = 0.0


@dataclass
class _HistogramSeries:
    key: str
    labels: dict[str, str]
    buckets: list[float]
    bucket_counts: list[int]
    count: int = 0
    sum: float = 0.0


class _MetricStore:
    def __init__(self) -> None:
        self.counters: dict[str, _CounterSeries] = {}
        self.gauges: dict[str, _GaugeSeries] = {}
        self.histograms: dict[str, _HistogramSeries] = {}
        self.active_users: dict[str, dict[str, float]] = {}

    def increment_counter(
        self,
        metric_name: str,
        labels: dict[str, Any] | None = None,
        delta: float = 1.0,
    ) -> None:
        normalized = _normalize_labels(labels)
        key = _series_key(metric_name, normalized)
        series = self.counters.get(key)
        if series is None:
            series = _CounterSeries(key=key, labels=normalized)
            self.counters[key] = series
        series.value += delta

    def set_gauge(
        self,
        metric_name: str,
        labels: dict[str, Any] | None = None,
        value: float = 0.0,
    ) -> None:
        normalized = _normalize_labels(labels)
        key = _series_key(metric_name, normalized)
        series = self.gauges.get(key)
        if series is None:
            series = _GaugeSeries(key=key, labels=normalized)
            self.gauges[key] = series
        series.value = value

    def observe_histogram(
        self,
        metric_name: str,
        labels: dict[str, Any] | None = None,
        value: float = 0.0,
    ) -> None:
        if not isinstance(value, (int, float)):
            return

        definition = METRIC_DEFINITIONS[metric_name]
        normalized = _normalize_labels(labels)
        key = _series_key(metric_name, normalized)
        series = self.histograms.get(key)
        if series is None:
            series = _HistogramSeries(
                key=key,
                labels=normalized,
                buckets=list(definition["buckets"]),
                bucket_counts=[0 for _ in definition["buckets"]],
            )
            self.histograms[key] = series

        series.count += 1
        series.sum += float(value)
        for index, bucket in enumerate(series.buckets):
            if value <= bucket:
                series.bucket_counts[index] += 1

    def touch_active_user(
        self,
        tenant_id: str,
        user_id: str,
        window_minutes: int,
        seen_at: float | None = None,
    ) -> None:
        tenant_id = tenant_id.strip()
        user_id = user_id.strip()
        if not tenant_id or not user_id:
            return

        now = seen_at or time.time()
        expires_at = now + window_minutes * 60
        bucket = self.active_users.setdefault(tenant_id, {})
        bucket[user_id] = expires_at
        self.purge_active_users(now, window_minutes)
        self.set_gauge(
            TELEMETRY_METRIC_NAMES["active_users_per_tenant"],
            {"tenant_id": tenant_id, "window_minutes": window_minutes},
            len(bucket),
        )

    def purge_active_users(
        self,
        now: float | None = None,
        window_minutes: int | None = None,
    ) -> None:
        current_time = now or time.time()
        effective_window_minutes = window_minutes or 15
        for tenant_id, users in list(self.active_users.items()):
            for user_id, expires_at in list(users.items()):
                if expires_at <= current_time:
                    users.pop(user_id, None)
            if not users:
                self.active_users.pop(tenant_id, None)
                continue
            self.set_gauge(
                TELEMETRY_METRIC_NAMES["active_users_per_tenant"],
                {
                    "tenant_id": tenant_id,
                    "window_minutes": effective_window_minutes,
                },
                len(users),
            )

    def render_prometheus(self) -> str:
        self.purge_active_users(window_minutes=self.active_user_window_minutes)
        lines: list[str] = []
        for metric_name, definition in METRIC_DEFINITIONS.items():
            lines.append(f"# HELP {metric_name} {definition['help']}")
            lines.append(f"# TYPE {metric_name} {definition['kind']}")

            if definition["kind"] == "gauge":
                if metric_name == TELEMETRY_METRIC_NAMES["active_users_per_tenant"]:
                    self.purge_active_users(
                        window_minutes=self.active_user_window_minutes
                    )
                for series in self.gauges.values():
                    if series.key.startswith(f"{metric_name}|"):
                        lines.append(
                            f"{metric_name}{_format_labels(series.labels)} {series.value}"
                        )
                continue

            for series in self.histograms.values():
                if not series.key.startswith(f"{metric_name}|"):
                    continue
                running_count = 0
                for bucket, bucket_count in zip(series.buckets, series.bucket_counts):
                    running_count += bucket_count
                    lines.append(
                        f'{metric_name}_bucket{_format_labels({**series.labels, "le": str(bucket)})} {running_count}'
                    )
                lines.append(
                    f'{metric_name}_bucket{_format_labels({**series.labels, "le": "+Inf"})} {series.count}'
                )
                lines.append(f"{metric_name}_sum{_format_labels(series.labels)} {series.sum}")
                lines.append(
                    f"{metric_name}_count{_format_labels(series.labels)} {series.count}"
                )

        return "\n".join(lines) + "\n"


@dataclass
class _SpanState(AbstractContextManager["_SpanState"]):
    runtime: "TelemetryRuntime"
    name: str
    attributes: dict[str, Any] = field(default_factory=dict)
    start_time_ns: int = field(default_factory=time.time_ns)
    trace_id: str = field(default_factory=lambda: uuid4().hex)
    span_id: str = field(default_factory=lambda: uuid4().hex[:16])
    ended: bool = False

    def set_attribute(self, key: str, value: Any) -> None:
        self.attributes[key] = value

    def __enter__(self) -> "_SpanState":
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        self.end("error" if exc_type else "ok", {"error.message": str(exc)} if exc else None)
        return False

    def end(self, status: str = "ok", extra_attributes: dict[str, Any] | None = None) -> None:
        if self.ended:
            return
        self.ended = True
        self.runtime._export_span(  # noqa: SLF001
            {
                "trace_id": self.trace_id,
                "span_id": self.span_id,
                "name": self.name,
                "start_time_ns": self.start_time_ns,
                "end_time_ns": time.time_ns(),
                "status": status,
                "attributes": {**self.attributes, **(extra_attributes or {})},
            }
        )


class TelemetryRuntime:
    def __init__(
        self,
        *,
        service_name: str,
        runtime: str,
        otlp_endpoint: str | None = None,
        metrics_path: str = "/metrics",
        active_user_window_minutes: int = 15,
    ) -> None:
        self.service_name = service_name
        self.runtime = runtime
        self.otlp_traces_endpoint = self._normalize_otlp_endpoint(otlp_endpoint)
        self.metrics_path = metrics_path
        self.active_user_window_minutes = active_user_window_minutes
        self.store = _MetricStore()

    def install(self, app: FastAPI) -> None:
        @app.middleware("http")
        async def telemetry_middleware(request: Request, call_next):
            span = self.span(
                f"http {request.method} {request.url.path}",
                {
                    "http.method": request.method,
                    "http.path": request.url.path,
                    "telemetry.runtime": self.runtime,
                    "service.name": self.service_name,
                },
            )
            started = time.perf_counter()
            response = None
            try:
                response = await call_next(request)
                return response
            finally:
                duration = time.perf_counter() - started
                status_code = getattr(response, "status_code", 500 if response is None else 200)
                self.observe_runtime_request(
                    method=request.method,
                    route=request.url.path,
                    duration_seconds=duration,
                    outcome="error" if status_code >= 400 else "success",
                )
                self._touch_active_user_from_headers(request.headers)
                span.end(
                    "error" if status_code >= 400 else "ok",
                    {
                        "http.status_code": status_code,
                        "request.duration_seconds": duration,
                    },
                )

        @app.get(self.metrics_path, include_in_schema=False)
        async def metrics() -> PlainTextResponse:
            return PlainTextResponse(
                self.render_prometheus(),
                media_type="text/plain; version=0.0.4; charset=utf-8",
            )

    def span(self, name: str, attributes: dict[str, Any] | None = None) -> _SpanState:
        return _SpanState(runtime=self, name=name, attributes=attributes or {})

    def observe_runtime_request(
        self,
        *,
        method: str,
        route: str,
        duration_seconds: float,
        outcome: str,
    ) -> None:
        self.store.observe_histogram(
            TELEMETRY_METRIC_NAMES["runtime_request_duration_seconds"],
            {
                "runtime": self.runtime,
                "method": method,
                "route": route,
                "outcome": outcome,
            },
            duration_seconds,
        )

    def record_forecast_mape(
        self,
        *,
        tenant_id: str,
        product_id: str,
        model_type: str,
        mape_percent: float,
    ) -> None:
        self.store.set_gauge(
            TELEMETRY_METRIC_NAMES["forecast_mape_percent"],
            {
                "tenant_id": tenant_id,
                "product_id": product_id,
                "model_type": model_type,
            },
            mape_percent,
        )

    def touch_active_user(self, tenant_id: str, user_id: str) -> None:
        self.store.touch_active_user(
            tenant_id,
            user_id,
            self.active_user_window_minutes,
        )

    def render_prometheus(self) -> str:
        return self.store.render_prometheus()

    def _touch_active_user_from_headers(self, headers: Any) -> None:
        tenant_id = headers.get("x-tenant-id")
        user_id = headers.get("x-user-id")
        if tenant_id and user_id:
            self.touch_active_user(tenant_id, user_id)

    def _export_span(self, span: dict[str, Any]) -> None:
        if not self.otlp_traces_endpoint:
            return

        payload = {
            "resourceSpans": [
                {
                    "resource": {
                        "attributes": [
                            {"key": "service.name", "value": {"stringValue": self.service_name}},
                            {"key": "telemetry.runtime", "value": {"stringValue": self.runtime}},
                        ]
                    },
                    "scopeSpans": [
                        {
                            "scope": {"name": "amdox.telemetry", "version": "18-01"},
                            "spans": [
                                {
                                    "traceId": span["trace_id"],
                                    "spanId": span["span_id"],
                                    "name": span["name"],
                                    "kind": 1,
                                    "startTimeUnixNano": str(span["start_time_ns"]),
                                    "endTimeUnixNano": str(span["end_time_ns"]),
                                    "attributes": [
                                        {"key": key, "value": self._attribute_value(value)}
                                        for key, value in span["attributes"].items()
                                    ],
                                    "status": {"code": 2 if span["status"] == "error" else 1},
                                }
                            ],
                        }
                    ],
                }
            ]
        }

        request = urllib.request.Request(
            self.otlp_traces_endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={"content-type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=1.5):  # noqa: S310
                pass
        except (urllib.error.URLError, TimeoutError, OSError):
            return

    def _attribute_value(self, value: Any) -> dict[str, Any]:
        if isinstance(value, bool):
            return {"boolValue": value}
        if isinstance(value, (int, float)):
            return {"doubleValue": float(value)}
        return {"stringValue": str(value)}

    def _normalize_otlp_endpoint(self, endpoint: str | None) -> str | None:
        if not endpoint:
            return None
        value = endpoint.strip()
        if not value:
            return None
        if "/v1/traces" in value:
            return value
        return f"{value.rstrip('/')}/v1/traces"


def create_telemetry_runtime(
    *,
    service_name: str,
    runtime: str,
    otlp_endpoint: str | None = None,
    metrics_path: str = "/metrics",
    active_user_window_minutes: int = 15,
) -> TelemetryRuntime:
    return TelemetryRuntime(
        service_name=service_name,
        runtime=runtime,
        otlp_endpoint=otlp_endpoint,
        metrics_path=metrics_path,
        active_user_window_minutes=active_user_window_minutes,
    )
