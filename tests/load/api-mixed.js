import http from "k6/http";
import { check, sleep } from "k6";

const baseUrls = (__ENV.LOAD_BASE_URLS ?? __ENV.LOAD_BASE_URL ?? "http://127.0.0.1:3001")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const username =
  __ENV.LOAD_AUTH_USERNAME ??
  __ENV.PHASE15_AUTH_USERNAME ??
  __ENV.PHASE12_AUTH_USERNAME ??
  "admin@amdox.dev";
const password =
  __ENV.LOAD_AUTH_PASSWORD ??
  __ENV.PHASE15_AUTH_PASSWORD ??
  __ENV.PHASE12_AUTH_PASSWORD ??
  "Admin@123456";
const tenantId = __ENV.LOAD_TENANT_ID ?? __ENV.PHASE15_TENANT_ID ?? "tenant-1";

const targetVus = Number(__ENV.LOAD_TARGET_VUS ?? "2000");
const rampUp = __ENV.LOAD_RAMP_UP ?? "2m";
const hold = __ENV.LOAD_HOLD ?? "5m";
const rampDown = __ENV.LOAD_RAMP_DOWN ?? "1m";
const thinkTimeSeconds = Number(__ENV.LOAD_THINK_TIME_SECONDS ?? "20");

function randomBaseUrl() {
  const index = Math.floor(Math.random() * baseUrls.length);
  return baseUrls[index];
}

export const options = {
  scenarios: {
    api_mixed: {
      executor: "ramping-vus",
      startVUs: 50,
      stages: [
        { duration: rampUp, target: targetVus },
        { duration: hold, target: targetVus },
        { duration: rampDown, target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<300"],
    checks: ["rate>0.99"],
  },
};

export function handleSummary(data) {
  const summary = {
    checksRate: data.metrics.checks?.values?.rate ?? null,
    httpReqFailedRate: data.metrics.http_req_failed?.values?.rate ?? null,
    httpReqDurationP95: data.metrics.http_req_duration?.values?.["p(95)"] ?? null,
    iterations: data.metrics.iterations?.values?.count ?? null,
    httpReqs: data.metrics.http_reqs?.values?.count ?? null,
  };

  return {
    "/scripts/last-summary.json": JSON.stringify(summary, null, 2),
  };
}

function authHeaders(token) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-tenant-id": tenantId,
    },
  };
}

export function setup() {
  const loginResponse = http.post(
    `${baseUrls[0]}/api/v1/auth/login`,
    JSON.stringify({ username, password }),
    { headers: { "Content-Type": "application/json" } },
  );

  check(loginResponse, {
    "load login succeeded": (response) => response.status === 201,
    "load login returned access token": (response) =>
      Boolean(response.json("data.access_token")),
  });

  return {
    accessToken: loginResponse.json("data.access_token"),
  };
}

export default function (data) {
  const token = data.accessToken;
  const selector = Math.floor(Math.random() * 100);
  const baseUrl = randomBaseUrl();

  if (selector < 25) {
    const response = http.get(`${baseUrl}/api/v1/auth/me`, authHeaders(token));
    check(response, {
      "auth me stayed healthy": (res) => res.status === 200,
    });
  } else if (selector < 55) {
    const response = http.get(`${baseUrl}/api/v1/finance/entities`, authHeaders(token));
    check(response, {
      "finance entities read succeeded": (res) => res.status === 200,
    });
  } else if (selector < 80) {
    const response = http.get(`${baseUrl}/api/v1/bi/dashboards`, authHeaders(token));
    check(response, {
      "bi dashboards read succeeded": (res) => res.status === 200,
    });
  } else if (selector < 92) {
    const response = http.get(`${baseUrl}/api/v1/payroll/runs`, authHeaders(token));
    check(response, {
      "payroll runs list stayed healthy": (res) => res.status === 200,
    });
  } else if (selector < 97) {
    const response = http.get(`${baseUrl}/api/v1/hr/org-chart`, authHeaders(token));
    check(response, {
      "hr org chart read succeeded": (res) => res.status === 200,
    });
  } else {
    const response = http.get(`${baseUrl}/api/v1/notifications/templates`, authHeaders(token));
    check(response, {
      "notification templates read stayed healthy": (res) => res.status === 200,
    });
  }

  sleep(thinkTimeSeconds);
}
