import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";
import { loginAndGetCookie } from "./_auth.js";
import { buildOptions } from "./_profiles.js";

const errorRate = new Rate("errors");
const invoicesLatency = new Trend("billing_invoices_latency");
const creditLatency = new Trend("billing_credit_latency");

export const options = {
  ...buildOptions("PERF_BILLING"),
  thresholds: {
    ...buildOptions("PERF_BILLING").thresholds,
    billing_invoices_latency: [`p(95)<${Number(__ENV.PERF_BILLING_INVOICES_P95_MS ?? "900")}`],
    billing_credit_latency: [`p(95)<${Number(__ENV.PERF_BILLING_CREDIT_P95_MS ?? "1000")}`]
  }
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || "admin@elms.local";
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || "password123";

export function setup() {
  const authCookieHeader = loginAndGetCookie(BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
  const invRes = http.get(`${BASE_URL}/api/invoices?page=1&limit=1`, { headers: { Cookie: authCookieHeader } });
  const invoice = JSON.parse(invRes.body)?.items?.[0];
  return { authCookieHeader, invoiceId: invoice?.id, clientId: invoice?.clientId };
}

export default function (data) {
  const params = { headers: { Cookie: data.authCookieHeader } };
  const invRes = http.get(`${BASE_URL}/api/invoices?page=1&limit=20`, params);
  invoicesLatency.add(invRes.timings.duration);
  errorRate.add(!check(invRes, { "invoices 200": (r) => r.status === 200 }));

  if (data.clientId) {
    const cbRes = http.get(`${BASE_URL}/api/clients/${data.clientId}/credit-balance`, params);
    creditLatency.add(cbRes.timings.duration);
    errorRate.add(!check(cbRes, { "credit balance 200": (r) => r.status === 200 }));
  }
  sleep(1);
}
