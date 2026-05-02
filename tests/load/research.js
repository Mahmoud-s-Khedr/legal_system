import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";
import { loginAndGetCookie } from "./_auth.js";
import { buildOptions } from "./_profiles.js";

const errorRate = new Rate("errors");
const listLatency = new Trend("research_list_latency");
const usageLatency = new Trend("research_usage_latency");

export const options = {
  ...buildOptions("PERF_RESEARCH"),
  thresholds: {
    ...buildOptions("PERF_RESEARCH").thresholds,
    research_list_latency: [`p(95)<${Number(__ENV.PERF_RESEARCH_LIST_P95_MS ?? "900")}`],
    research_usage_latency: [`p(95)<${Number(__ENV.PERF_RESEARCH_USAGE_P95_MS ?? "700")}`]
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
  const listRes = http.get(`${BASE_URL}/api/research/sessions?page=1&limit=20`, params);
  listLatency.add(listRes.timings.duration);
  errorRate.add(!check(listRes, { "research sessions 200": (r) => r.status === 200 }));

  const usageRes = http.get(`${BASE_URL}/api/research/usage`, params);
  usageLatency.add(usageRes.timings.duration);
  errorRate.add(!check(usageRes, { "research usage 200": (r) => r.status === 200 }));
  sleep(1);
}
