type MetricLabels = Record<string, string | number | boolean | undefined>;
type NormalizedLabels = Record<string, string>;

type CounterSeries = {
  key: string;
  labels: NormalizedLabels;
  value: number;
};

type GaugeSeries = {
  key: string;
  labels: NormalizedLabels;
  value: number;
};

type HistogramSeries = {
  key: string;
  labels: NormalizedLabels;
  buckets: number[];
  bucketCounts: number[];
  count: number;
  sum: number;
};

type MetricDefinition =
  | {
      kind: "counter";
      help: string;
    }
  | {
      kind: "gauge";
      help: string;
    }
  | {
      kind: "histogram";
      help: string;
      buckets: number[];
    };

const DEFAULT_ACTIVE_USER_WINDOW_MINUTES = 15;

export const TELEMETRY_METRIC_NAMES = {
  invoicesProcessedTotal: "invoices_processed_total",
  payrollRunDurationSeconds: "payroll_run_duration_seconds",
  forecastMapePercent: "forecast_mape_percent",
  activeUsersPerTenant: "active_users_per_tenant",
  runtimeRequestDurationSeconds: "runtime_request_duration_seconds",
} as const;

const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  [TELEMETRY_METRIC_NAMES.invoicesProcessedTotal]: {
    kind: "counter",
    help: "Total completed invoice processing operations.",
  },
  [TELEMETRY_METRIC_NAMES.payrollRunDurationSeconds]: {
    kind: "histogram",
    help: "Duration of completed payroll run requests in seconds.",
    buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
  },
  [TELEMETRY_METRIC_NAMES.forecastMapePercent]: {
    kind: "gauge",
    help: "Most recently observed forecast mean absolute percentage error.",
  },
  [TELEMETRY_METRIC_NAMES.activeUsersPerTenant]: {
    kind: "gauge",
    help: "Distinct active users observed in the rolling activity window.",
  },
  [TELEMETRY_METRIC_NAMES.runtimeRequestDurationSeconds]: {
    kind: "histogram",
    help: "Duration of completed runtime requests in seconds.",
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
  },
};

const counters = new Map<string, CounterSeries>();
const gauges = new Map<string, GaugeSeries>();
const histograms = new Map<string, HistogramSeries>();
const activeUserWindowState = new Map<
  string,
  {
    windowMinutes: number;
    users: Map<string, number>;
  }
>();

function normalizeLabels(labels: MetricLabels = {}): NormalizedLabels {
  return Object.fromEntries(
    Object.entries(labels)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)] as const)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function seriesKey(metricName: string, labels: NormalizedLabels) {
  return `${metricName}|${JSON.stringify(labels)}`;
}

function ensureDefinition(metricName: string): MetricDefinition {
  const definition = METRIC_DEFINITIONS[metricName];
  if (!definition) {
    throw new Error(`Unknown telemetry metric: ${metricName}`);
  }
  return definition;
}

function getOrCreateHistogram(
  metricName: string,
  labels: NormalizedLabels,
): HistogramSeries {
  const definition = ensureDefinition(metricName);
  if (definition.kind !== "histogram") {
    throw new Error(`Metric ${metricName} is not a histogram.`);
  }

  const key = seriesKey(metricName, labels);
  const existing = histograms.get(key);
  if (existing) {
    return existing;
  }

  const created: HistogramSeries = {
    key,
    labels,
    buckets: definition.buckets,
    bucketCounts: definition.buckets.map(() => 0),
    count: 0,
    sum: 0,
  };
  histograms.set(key, created);
  return created;
}

function getOrCreateCounter(
  metricName: string,
  labels: NormalizedLabels,
): CounterSeries {
  const definition = ensureDefinition(metricName);
  if (definition.kind !== "counter") {
    throw new Error(`Metric ${metricName} is not a counter.`);
  }

  const key = seriesKey(metricName, labels);
  const existing = counters.get(key);
  if (existing) {
    return existing;
  }

  const created: CounterSeries = { key, labels, value: 0 };
  counters.set(key, created);
  return created;
}

function getOrCreateGauge(
  metricName: string,
  labels: NormalizedLabels,
): GaugeSeries {
  const definition = ensureDefinition(metricName);
  if (definition.kind !== "gauge") {
    throw new Error(`Metric ${metricName} is not a gauge.`);
  }

  const key = seriesKey(metricName, labels);
  const existing = gauges.get(key);
  if (existing) {
    return existing;
  }

  const created: GaugeSeries = { key, labels, value: 0 };
  gauges.set(key, created);
  return created;
}

function escapePrometheusLabel(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/"/g, '\\"');
}

function formatLabels(labels: NormalizedLabels) {
  const parts = Object.entries(labels).map(
    ([key, value]) => `${key}="${escapePrometheusLabel(value)}"`,
  );
  return parts.length > 0 ? `{${parts.join(",")}}` : "";
}

function purgeExpiredActiveUsers(now = Date.now()) {
  for (const [tenantId, state] of activeUserWindowState.entries()) {
    for (const [userId, expiresAt] of state.users.entries()) {
      if (expiresAt <= now) {
        state.users.delete(userId);
      }
    }

    if (state.users.size === 0) {
      activeUserWindowState.delete(tenantId);
    } else {
      setGauge(
        TELEMETRY_METRIC_NAMES.activeUsersPerTenant,
        {
          tenant_id: tenantId,
          window_minutes: String(state.windowMinutes),
        },
        state.users.size,
      );
    }
  }
}

export function incrementCounter(
  metricName: string,
  labels: MetricLabels = {},
  delta = 1,
) {
  const series = getOrCreateCounter(metricName, normalizeLabels(labels));
  series.value += delta;
}

export function setGauge(
  metricName: string,
  labels: MetricLabels = {},
  value: number,
) {
  const series = getOrCreateGauge(metricName, normalizeLabels(labels));
  series.value = value;
}

export function observeHistogram(
  metricName: string,
  labels: MetricLabels = {},
  value: number,
) {
  if (!Number.isFinite(value)) {
    return;
  }

  const series = getOrCreateHistogram(metricName, normalizeLabels(labels));
  series.count += 1;
  series.sum += value;

  for (let index = 0; index < series.buckets.length; index += 1) {
    if (value <= series.buckets[index]) {
      series.bucketCounts[index] += 1;
    }
  }
}

export function recordInvoiceProcessed(params: {
  tenantId: string;
  route: string;
  outcome?: string;
  count?: number;
}) {
  incrementCounter(
    TELEMETRY_METRIC_NAMES.invoicesProcessedTotal,
    {
      tenant_id: params.tenantId,
      route: params.route,
      outcome: params.outcome ?? "success",
    },
    params.count ?? 1,
  );
}

export function recordPayrollRunDuration(params: {
  tenantId: string;
  route: string;
  outcome?: string;
  durationSeconds: number;
}) {
  observeHistogram(
    TELEMETRY_METRIC_NAMES.payrollRunDurationSeconds,
    {
      tenant_id: params.tenantId,
      route: params.route,
      outcome: params.outcome ?? "success",
    },
    params.durationSeconds,
  );
}

export function recordForecastMape(params: {
  tenantId: string;
  productId: string;
  modelType: string;
  mapePercent: number;
}) {
  setGauge(
    TELEMETRY_METRIC_NAMES.forecastMapePercent,
    {
      tenant_id: params.tenantId,
      product_id: params.productId,
      model_type: params.modelType,
    },
    params.mapePercent,
  );
}

export function recordRuntimeRequestDuration(params: {
  runtime: string;
  method: string;
  route: string;
  outcome: string;
  durationSeconds: number;
}) {
  observeHistogram(
    TELEMETRY_METRIC_NAMES.runtimeRequestDurationSeconds,
    {
      runtime: params.runtime,
      method: params.method,
      route: params.route,
      outcome: params.outcome,
    },
    params.durationSeconds,
  );
}

export function recordActiveUser(params: {
  tenantId: string;
  userId: string;
  windowMinutes?: number;
  seenAt?: number;
}) {
  const tenantId = params.tenantId.trim();
  const userId = params.userId.trim();
  if (!tenantId || !userId) {
    return;
  }

  const windowMinutes =
    params.windowMinutes ?? DEFAULT_ACTIVE_USER_WINDOW_MINUTES;
  const now = params.seenAt ?? Date.now();
  const expiresAt = now + windowMinutes * 60_000;
  const bucket = activeUserWindowState.get(tenantId) ?? {
    windowMinutes,
    users: new Map<string, number>(),
  };

  bucket.windowMinutes = windowMinutes;
  bucket.users.set(userId, expiresAt);
  activeUserWindowState.set(tenantId, bucket);

  purgeExpiredActiveUsers(now);
  setGauge(
    TELEMETRY_METRIC_NAMES.activeUsersPerTenant,
    {
      tenant_id: tenantId,
      window_minutes: String(windowMinutes),
    },
    bucket.users.size,
  );
}

export function renderPrometheusMetrics() {
  purgeExpiredActiveUsers();

  const lines: string[] = [];

  for (const [metricName, definition] of Object.entries(METRIC_DEFINITIONS)) {
    lines.push(`# HELP ${metricName} ${definition.help}`);
    lines.push(`# TYPE ${metricName} ${definition.kind}`);

    if (definition.kind === "counter") {
      const samples = [...counters.values()].filter((sample) =>
        sample.key.startsWith(`${metricName}|`),
      );
      for (const sample of samples) {
        lines.push(
          `${metricName}${formatLabels(sample.labels)} ${sample.value}`,
        );
      }
      continue;
    }

    if (definition.kind === "gauge") {
      const samples = [...gauges.values()].filter((sample) =>
        sample.key.startsWith(`${metricName}|`),
      );
      for (const sample of samples) {
        lines.push(
          `${metricName}${formatLabels(sample.labels)} ${sample.value}`,
        );
      }
      continue;
    }

    const samples = [...histograms.values()].filter((sample) =>
      sample.key.startsWith(`${metricName}|`),
    );
    for (const sample of samples) {
      let runningCount = 0;
      for (let index = 0; index < sample.buckets.length; index += 1) {
        runningCount += sample.bucketCounts[index];
        lines.push(
          `${metricName}_bucket${formatLabels({
            ...sample.labels,
            le: String(sample.buckets[index]),
          })} ${runningCount}`,
        );
      }
      lines.push(
        `${metricName}_bucket${formatLabels({ ...sample.labels, le: "+Inf" })} ${sample.count}`,
      );
      lines.push(
        `${metricName}_sum${formatLabels(sample.labels)} ${sample.sum}`,
      );
      lines.push(
        `${metricName}_count${formatLabels(sample.labels)} ${sample.count}`,
      );
    }
  }

  return `${lines.join("\n")}\n`;
}
