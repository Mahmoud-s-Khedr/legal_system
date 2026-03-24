/**
 * ELMS Document Upload Performance Test
 * Tests concurrent PDF uploads to measure storage + OCR dispatch throughput.
 *
 * Usage: k6 run tests/load/document-upload.js
 * Env:   BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("errors");
const uploadLatency = new Trend("upload_latency");

export const options = {
  stages: [
    { duration: "20s", target: 2 },  // ramp up slowly
    { duration: "1m", target: 10 },  // hold at 10 VU
    { duration: "20s", target: 0 }   // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<5000"],  // uploads can take up to 5s
    errors: ["rate<0.05"],              // allow up to 5% errors for uploads
    upload_latency: ["p(95)<3000"]
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

// Minimal valid PDF bytes (a ~1KB PDF file)
const MINIMAL_PDF = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer
<< /Size 4 /Root 1 0 R >>
startxref
190
%%EOF`;

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
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const formData = {
    title: `Load Test Document ${suffix}`,
    type: "GENERAL",
    file: http.file(MINIMAL_PDF, `load-test-${suffix}.pdf`, "application/pdf")
  };

  const uploadRes = http.post(
    `${BASE_URL}/api/documents`,
    formData,
    {
      headers: { Cookie: data.authCookieHeader },
      timeout: "30s"
    }
  );

  uploadLatency.add(uploadRes.timings.duration);

  const uploadOk = check(uploadRes, {
    "upload 201": (r) => r.status === 201,
    "upload returns document id": (r) => {
      try {
        return !!JSON.parse(r.body).id;
      } catch {
        return false;
      }
    }
  });
  errorRate.add(!uploadOk);

  sleep(2);
}
