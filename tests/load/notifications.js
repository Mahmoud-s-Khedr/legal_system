import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";
import { loginAndGetCookie } from "./_auth.js";
import { buildOptions } from "./_profiles.js";

const errorRate = new Rate("errors");
const listLatency = new Trend("notifications_list_latency");
const unreadLatency = new Trend("notifications_unread_latency");

export const options = {
  ...buildOptions("PERF_NOTIFICATIONS"),
  thresholds: {
    ...buildOptions("PERF_NOTIFICATIONS").thresholds,
    notifications_list_latency: [`p(95)<${Number(__ENV.PERF_NOTIFICATIONS_LIST_P95_MS ?? "600")}`],
    notifications_unread_latency: [`p(95)<${Number(__ENV.PERF_NOTIFICATIONS_UNREAD_P95_MS ?? "400")}`]
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
  const listRes = http.get(`${BASE_URL}/api/notifications?page=1&limit=25`, params);
  listLatency.add(listRes.timings.duration);
  errorRate.add(!check(listRes, { "notifications 200": (r) => r.status === 200 }));

  const unRes = http.get(`${BASE_URL}/api/notifications/unread-count`, params);
  unreadLatency.add(unRes.timings.duration);
  errorRate.add(!check(unRes, { "notifications unread 200": (r) => r.status === 200 }));
  sleep(1);
}
