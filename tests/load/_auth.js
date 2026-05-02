import http from "k6/http";

export const ACCESS_COOKIE = "elms_access_token";
export const REFRESH_COOKIE = "elms_refresh_token";
export const LOCAL_SESSION_COOKIE = "elms_local_session";

export function extractCookieFromSetCookie(setCookieHeader, cookieName) {
  if (!setCookieHeader) return null;
  const values = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const value of values) {
    const match = String(value).match(new RegExp(`(?:^|[;,]\\s*)${cookieName}=([^;]+)`));
    if (match?.[1]) return match[1];
  }
  return null;
}

export function buildAuthCookieHeader(loginRes) {
  const localSession = loginRes.cookies?.[LOCAL_SESSION_COOKIE]?.[0]?.value
    ?? extractCookieFromSetCookie(loginRes.headers["Set-Cookie"], LOCAL_SESSION_COOKIE);
  if (localSession) return `${LOCAL_SESSION_COOKIE}=${localSession}`;

  const access = loginRes.cookies?.[ACCESS_COOKIE]?.[0]?.value
    ?? extractCookieFromSetCookie(loginRes.headers["Set-Cookie"], ACCESS_COOKIE);
  const refresh = loginRes.cookies?.[REFRESH_COOKIE]?.[0]?.value
    ?? extractCookieFromSetCookie(loginRes.headers["Set-Cookie"], REFRESH_COOKIE);

  const pairs = [];
  if (access) pairs.push(`${ACCESS_COOKIE}=${access}`);
  if (refresh) pairs.push(`${REFRESH_COOKIE}=${refresh}`);
  if (pairs.length === 0) throw new Error("Login succeeded but no auth cookies were found in response");
  return pairs.join("; ");
}

export function loginAndGetCookie(baseUrl, email, password) {
  const loginRes = http.post(
    `${baseUrl}/api/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { "Content-Type": "application/json" } }
  );

  if (loginRes.status !== 200) {
    throw new Error(`Login failed: ${loginRes.status} ${loginRes.body}`);
  }

  return buildAuthCookieHeader(loginRes);
}
