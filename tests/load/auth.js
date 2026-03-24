/**
 * ELMS Auth Performance Test
 * Tests login/logout cycles to benchmark session management.
 *
 * Usage: k6 run tests/load/auth.js
 * Env:   BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("errors");
const loginLatency = new Trend("login_latency");
const meLatency = new Trend("me_latency");

export const options = {
  stages: [
    { duration: "20s", target: 5 },   // ramp up
    { duration: "1m", target: 20 },   // hold
    { duration: "20s", target: 0 }    // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<1000"],  // login can be slower due to bcrypt
    errors: ["rate<0.01"],
    login_latency: ["p(95)<2000"],      // bcrypt is intentionally slow
    me_latency: ["p(95)<200"]
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

export default function () {
  // ── Login
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    { headers: { "Content-Type": "application/json" } }
  );
  loginLatency.add(loginRes.timings.duration);

  const loginOk = check(loginRes, {
    "login 200": (r) => r.status === 200,
    "login returns user": (r) => {
      try {
        return !!JSON.parse(r.body).user;
      } catch {
        return false;
      }
    }
  });
  errorRate.add(!loginOk);

  if (!loginOk) {
    sleep(2);
    return;
  }

  const authCookieHeader = buildAuthCookieHeader(loginRes);
  const params = { headers: { Cookie: authCookieHeader } };

  sleep(0.2);

  // ── GET /me (validate session)
  const meRes = http.get(`${BASE_URL}/api/auth/me`, params);
  meLatency.add(meRes.timings.duration);
  const meOk = check(meRes, {
    "me 200": (r) => r.status === 200,
    "me returns id": (r) => {
      try {
        return !!JSON.parse(r.body).id;
      } catch {
        return false;
      }
    }
  });
  errorRate.add(!meOk);

  sleep(0.5);

  // ── Logout
  const logoutRes = http.post(`${BASE_URL}/api/auth/logout`, null, params);
  check(logoutRes, { "logout 200": (r) => r.status === 200 });

  sleep(1);
}
