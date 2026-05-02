import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";
import { loginAndGetCookie } from "./_auth.js";
import { buildOptions } from "./_profiles.js";

const errorRate = new Rate("errors");
const importLatency = new Trend("import_preview_latency");

export const options = {
  ...buildOptions("PERF_IMPORT"),
  thresholds: {
    ...buildOptions("PERF_IMPORT").thresholds,
    import_preview_latency: [`p(95)<${Number(__ENV.PERF_IMPORT_PREVIEW_P95_MS ?? "1500")}`]
  }
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || "admin@elms.local";
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || "password123";

const CSV = `name,type,phone,email\nLoad Import Co,COMPANY,01012345678,load.import@example.com\n`;

export function setup() {
  return { authCookieHeader: loginAndGetCookie(BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD) };
}

export default function (data) {
  const form = {
    file: http.file(CSV, "clients.csv", "text/csv")
  };
  const res = http.post(`${BASE_URL}/api/import/clients/preview`, form, { headers: { Cookie: data.authCookieHeader } });
  importLatency.add(res.timings.duration);
  errorRate.add(!check(res, { "import preview 200": (r) => r.status === 200 }));
  sleep(1.5);
}
