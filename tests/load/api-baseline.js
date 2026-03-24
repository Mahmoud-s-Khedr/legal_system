/**
 * ELMS API Baseline Load Test
 * Tests core read paths under concurrent load.
 *
 * Usage: k6 run tests/load/api-baseline.js
 * Env:   BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("errors");
const dashboardLatency = new Trend("dashboard_latency");
const casesLatency = new Trend("cases_latency");
const hearingsLatency = new Trend("hearings_latency");

export const options = {
  stages: [
    { duration: "30s", target: 10 },  // ramp up to 10 VU
    { duration: "3m", target: 50 },   // ramp up to 50 VU
    { duration: "1m", target: 50 },   // hold at 50 VU
    { duration: "30s", target: 0 }    // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],  // 95% of requests under 500ms
    errors: ["rate<0.01"],             // < 1% error rate
    dashboard_latency: ["p(95)<800"],
    cases_latency: ["p(95)<500"],
    hearings_latency: ["p(95)<500"]
  }
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || "admin@elms.test";
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || "Admin123!";

const ACCESS_COOKIE = "elms_access_token";
const REFRESH_COOKIE = "elms_refresh_token";
const LOCAL_SESSION_COOKIE = "elms_local_session";

function extractCookieFromSetCookie(setCookieHeader, cookieName) {
  if (!setCookieHeader) {
    return null;
  }

  const values = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const value of values) {
    const match = String(value).match(new RegExp(`(?:^|[;,]\\s*)${cookieName}=([^;]+)`));
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

function buildAuthCookieHeader(loginRes) {
  const localSession = loginRes.cookies?.[LOCAL_SESSION_COOKIE]?.[0]?.value
    ?? extractCookieFromSetCookie(loginRes.headers["Set-Cookie"], LOCAL_SESSION_COOKIE);
  if (localSession) {
    return `${LOCAL_SESSION_COOKIE}=${localSession}`;
  }

  const access = loginRes.cookies?.[ACCESS_COOKIE]?.[0]?.value
    ?? extractCookieFromSetCookie(loginRes.headers["Set-Cookie"], ACCESS_COOKIE);
  const refresh = loginRes.cookies?.[REFRESH_COOKIE]?.[0]?.value
    ?? extractCookieFromSetCookie(loginRes.headers["Set-Cookie"], REFRESH_COOKIE);

  const pairs = [];
  if (access) {
    pairs.push(`${ACCESS_COOKIE}=${access}`);
  }
  if (refresh) {
    pairs.push(`${REFRESH_COOKIE}=${refresh}`);
  }

  if (pairs.length === 0) {
    throw new Error("Login succeeded but no auth cookies were found in response");
  }

  return pairs.join("; ");
}

// Shared auth cookie — set once in setup, reused across VUs
export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    { headers: { "Content-Type": "application/json" } }
  );

  if (loginRes.status !== 200) {
    throw new Error(`Login failed: ${loginRes.status} ${loginRes.body}`);
  }

  return { authCookieHeader: buildAuthCookieHeader(loginRes) };
}

export default function (data) {
  const params = {
    headers: { Cookie: data.authCookieHeader }
  };

  // ── Dashboard summary
  const dashRes = http.get(`${BASE_URL}/api/dashboard/summary`, params);
  dashboardLatency.add(dashRes.timings.duration);
  const dashOk = check(dashRes, {
    "dashboard 200": (r) => r.status === 200
  });
  errorRate.add(!dashOk);

  sleep(0.5);

  // ── Cases list (paginated)
  const casesRes = http.get(`${BASE_URL}/api/cases?page=1&limit=20`, params);
  casesLatency.add(casesRes.timings.duration);
  const casesOk = check(casesRes, {
    "cases 200": (r) => r.status === 200,
    "cases has items array": (r) => {
      try {
        return Array.isArray(JSON.parse(r.body).items);
      } catch {
        return false;
      }
    }
  });
  errorRate.add(!casesOk);

  sleep(0.5);

  // ── Hearings list (upcoming filter)
  const hearingsRes = http.get(`${BASE_URL}/api/hearings?page=1&limit=20`, params);
  hearingsLatency.add(hearingsRes.timings.duration);
  const hearingsOk = check(hearingsRes, {
    "hearings 200": (r) => r.status === 200
  });
  errorRate.add(!hearingsOk);

  sleep(1);
}
