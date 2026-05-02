import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";
import { loginAndGetCookie } from "./_auth.js";
import { buildOptions } from "./_profiles.js";

const errorRate = new Rate("errors");
const createLatency = new Trend("cases_create_latency");
const updateLatency = new Trend("cases_update_latency");

export const options = {
  ...buildOptions("PERF_CASES"),
  thresholds: {
    ...buildOptions("PERF_CASES").thresholds,
    cases_create_latency: [`p(95)<${Number(__ENV.PERF_CASES_CREATE_P95_MS ?? "1000")}`],
    cases_update_latency: [`p(95)<${Number(__ENV.PERF_CASES_UPDATE_P95_MS ?? "900")}`]
  }
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || "admin@elms.local";
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || "password123";

export function setup() {
  const authCookieHeader = loginAndGetCookie(BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
  const clientsRes = http.get(`${BASE_URL}/api/clients?page=1&limit=1`, { headers: { Cookie: authCookieHeader } });
  const clientId = JSON.parse(clientsRes.body)?.items?.[0]?.id;
  if (!clientId) throw new Error("No client found for case creation");
  return { authCookieHeader, clientId };
}

export default function (data) {
  const headers = { Cookie: data.authCookieHeader, "Content-Type": "application/json" };
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createRes = http.post(`${BASE_URL}/api/cases`, JSON.stringify({
    clientId: data.clientId,
    title: `Load Case ${suffix}`,
    caseNumber: `LD-${suffix}`,
    judicialYear: 2026,
    type: "CIVIL",
    internalRef: `PERF-${suffix}`
  }), { headers });

  createLatency.add(createRes.timings.duration);
  const created = check(createRes, { "case created": (r) => r.status === 200 });
  errorRate.add(!created);
  if (!created) return;

  const caseId = JSON.parse(createRes.body).id;
  const updateRes = http.put(`${BASE_URL}/api/cases/${caseId}`, JSON.stringify({
    clientId: data.clientId,
    title: `Load Case Updated ${suffix}`,
    caseNumber: `LDU-${suffix}`,
    judicialYear: 2026,
    type: "COMMERCIAL",
    internalRef: `PERF-U-${suffix}`
  }), { headers });

  updateLatency.add(updateRes.timings.duration);
  const updated = check(updateRes, { "case updated": (r) => r.status === 200 });
  errorRate.add(!updated);
  sleep(1);
}
