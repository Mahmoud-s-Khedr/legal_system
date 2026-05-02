import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";
import { buildOptions } from "./_profiles.js";

const errorRate = new Rate("errors");
const loginLatency = new Trend("portal_login_latency");
const casesLatency = new Trend("portal_cases_latency");

export const options = {
  ...buildOptions("PERF_PORTAL"),
  thresholds: {
    ...buildOptions("PERF_PORTAL").thresholds,
    portal_login_latency: [`p(95)<${Number(__ENV.PERF_PORTAL_LOGIN_P95_MS ?? "1200")}`],
    portal_cases_latency: [`p(95)<${Number(__ENV.PERF_PORTAL_CASES_P95_MS ?? "900")}`]
  }
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const PORTAL_EMAIL = __ENV.PORTAL_EMAIL || "portal.client@elms.local";
const PORTAL_PASSWORD = __ENV.PORTAL_PASSWORD || "password123";
const PORTAL_FIRM_ID = __ENV.PORTAL_FIRM_ID || "8f4a6dd5-52b7-4b7c-93e5-2e5285d7009d";

function cookieFrom(res) {
  const token = res.cookies?.elms_portal_token?.[0]?.value;
  if (!token) throw new Error("Missing elms_portal_token");
  return `elms_portal_token=${token}`;
}

export function setup() {
  return { firmId: PORTAL_FIRM_ID };
}

export default function (data) {
  const loginRes = http.post(
    `${BASE_URL}/api/portal/auth/login`,
    JSON.stringify({ email: PORTAL_EMAIL, password: PORTAL_PASSWORD, firmId: data.firmId }),
    { headers: { "Content-Type": "application/json" } }
  );
  loginLatency.add(loginRes.timings.duration);
  const okLogin = check(loginRes, { "portal login 200": (r) => r.status === 200 });
  errorRate.add(!okLogin);
  if (!okLogin) return;

  const cookie = cookieFrom(loginRes);
  const casesRes = http.get(`${BASE_URL}/api/portal/cases?page=1&limit=20`, { headers: { Cookie: cookie } });
  casesLatency.add(casesRes.timings.duration);
  errorRate.add(!check(casesRes, { "portal cases 200": (r) => r.status === 200 }));
  sleep(1);
}
