import { cookies } from "next/headers";
import type { ConsoleConfig } from "./config.ts";
import { refreshTokens, type Tokens } from "./auth-flow.ts";
import { decodeClaims, isOperatorRole, needsRefresh, type OperatorClaims } from "./jwt.ts";

export const ACCESS_COOKIE = "hv_console_at";
export const REFRESH_COOKIE = "hv_console_rt";
/** A Console sign-in lasts at most this long, whatever the platform's own session limits are. */
const SESSION_SECONDS = 12 * 60 * 60;

export type Operator = { token: string; claims: OperatorClaims };

function cookieOptions(cfg: ConsoleConfig) {
  return { httpOnly: true, secure: cfg.secureCookies, sameSite: "strict" as const, path: "/", maxAge: SESSION_SECONDS };
}

/** Route handlers and server actions only: pages cannot set cookies. */
export async function setSessionCookies(cfg: ConsoleConfig, tokens: Tokens): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, tokens.accessToken, cookieOptions(cfg));
  store.set(REFRESH_COOKIE, tokens.refreshToken, cookieOptions(cfg));
}

export async function clearSessionCookies(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export async function readRefreshToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value ?? null;
}

/**
 * The signed-in operator, or null. {@code stale} is true when the access token needs refreshing: a page then sends the
 * browser through the refresh route; a route handler can call {@link refreshOperator} itself.
 */
export async function currentOperator(): Promise<{ operator: Operator | null; stale: boolean }> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  const claims = decodeClaims(token);
  if (claims && isOperatorRole(claims.role) && !needsRefresh(claims, Math.floor(Date.now() / 1000))) {
    return { operator: { token: token as string, claims }, stale: false };
  }
  const hasRefresh = Boolean(store.get(REFRESH_COOKIE)?.value);
  return { operator: null, stale: hasRefresh };
}

/** Exchanges the refresh token for new tokens and stores them; clears the session when the platform refuses. */
export async function refreshOperator(cfg: ConsoleConfig, f: typeof fetch): Promise<Operator | null> {
  const refresh = await readRefreshToken();
  if (!refresh) return null;
  const r = await refreshTokens(f, cfg, refresh);
  if (!r.ok) {
    if (r.status === 401) await clearSessionCookies();
    return null;
  }
  const claims = decodeClaims(r.accessToken);
  if (!claims || !isOperatorRole(claims.role)) {
    await clearSessionCookies();
    return null;
  }
  await setSessionCookies(cfg, r);
  return { token: r.accessToken, claims };
}
