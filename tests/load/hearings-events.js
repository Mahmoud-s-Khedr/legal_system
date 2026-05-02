import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";
import { loginAndGetCookie } from "./_auth.js";
import { buildOptions } from "./_profiles.js";

const errorRate = new Rate("errors");
const listLatency = new Trend("hearings_list_latency");
const conflictsLatency = new Trend("hearings_conflicts_latency");

export const options = {
  ...buildOptions("PERF_HEARINGS"),
  thresholds: {
    ...buildOptions("PERF_HEARINGS").thresholds,
    hearings_list_latency: [`p(95)<${Number(__ENV.PERF_HEARINGS_LIST_P95_MS ?? "700")}`],
    hearings_conflicts_latency: [`p(95)<${Number(__ENV.PERF_HEARINGS_CONFLICTS_P95_MS ?? "700")}`]
  }
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || "admin@elms.local";
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || "password123";

export function setup() {
  return { authCookieHeader: loginAndGetCookie(BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD) };
}

export default function (data) {
  const params = { headers: { Cookie: data.authCookieHeader } };
  const listRes = http.get(`${BASE_URL}/api/hearings?page=1&limit=20`, params);
  listLatency.add(listRes.timings.duration);
  errorRate.add(!check(listRes, { "hearings 200": (r) => r.status === 200 }));

  const cRes = http.get(`${BASE_URL}/api/hearings/conflicts?from=2026-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.000Z`, params);
  conflictsLatency.add(cRes.timings.duration);
  errorRate.add(!check(cRes, { "hearings conflicts 200": (r) => r.status === 200 }));
  sleep(1);
}
