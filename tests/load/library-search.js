import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";
import { loginAndGetCookie } from "./_auth.js";
import { buildOptions } from "./_profiles.js";

const errorRate = new Rate("errors");
const searchLatency = new Trend("library_search_latency");
const docsLatency = new Trend("library_docs_latency");

export const options = {
  ...buildOptions("PERF_LIBRARY"),
  thresholds: {
    ...buildOptions("PERF_LIBRARY").thresholds,
    library_search_latency: [`p(95)<${Number(__ENV.PERF_LIBRARY_SEARCH_P95_MS ?? "1000")}`],
    library_docs_latency: [`p(95)<${Number(__ENV.PERF_LIBRARY_DOCS_P95_MS ?? "900")}`]
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
  const docsRes = http.get(`${BASE_URL}/api/library/documents?page=1&limit=20`, params);
  docsLatency.add(docsRes.timings.duration);
  errorRate.add(!check(docsRes, { "library docs 200": (r) => r.status === 200 }));

  const sRes = http.get(`${BASE_URL}/api/library/search?q=seed&page=1&limit=20`, params);
  searchLatency.add(sRes.timings.duration);
  errorRate.add(!check(sRes, { "library search 200": (r) => r.status === 200 }));
  sleep(1);
}
