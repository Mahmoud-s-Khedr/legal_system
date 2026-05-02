import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";
import { loginAndGetCookie } from "./_auth.js";
import { buildOptions } from "./_profiles.js";

const errorRate = new Rate("errors");
const globalLatency = new Trend("search_global_latency");

export const options = {
  ...buildOptions("PERF_SEARCH"),
  thresholds: {
    ...buildOptions("PERF_SEARCH").thresholds,
    search_global_latency: [`p(95)<${Number(__ENV.PERF_SEARCH_GLOBAL_P95_MS ?? "800")}`]
  }
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || "admin@elms.local";
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || "password123";

export function setup() {
  return { authCookieHeader: loginAndGetCookie(BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD) };
}

export default function (data) {
  const res = http.get(`${BASE_URL}/api/search/global?q=seed&page=1&limit=15`, { headers: { Cookie: data.authCookieHeader } });
  globalLatency.add(res.timings.duration);
  errorRate.add(!check(res, { "search global 200": (r) => r.status === 200 }));
  sleep(1);
}
