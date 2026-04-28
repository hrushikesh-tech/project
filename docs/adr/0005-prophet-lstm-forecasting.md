# ADR 0005: Use Prophet First and LSTM Second for Forecasting

**Status:** Accepted
**Date:** 2026-04-28

## Context

The forecasting system needs a practical default model, a higher-capacity fallback for denser histories, and a quality gate so the platform does not serve obviously bad predictions.

## Decision

Use Prophet as the primary forecasting model and LSTM as the secondary model for high-volume or sufficiently rich histories.

## Consequences

- the default path stays easier to explain and operate
- the secondary model can be used when the data supports it
- the platform can gate model quality by MAPE before using predictions
- model registry and telemetry need to carry model type and quality information clearly

## Implementation Notes

- the ML service exposes separate Prophet and LSTM training services
- the runtime records forecast MAPE through telemetry
- the environment contract includes `ML_MAX_MAPE_PERCENT`
