import { NextResponse } from "next/server";
import { isSameOriginRequest } from "./../security-policy.js";
import { consoleEnabled, loadConsoleConfig, type ConsoleConfig } from "./config.ts";
import { canWrite } from "./jwt.ts";
import { currentOperator, refreshOperator, type Operator } from "./session.ts";

const MAX_BODY_BYTES = 8 * 1024;

export function problem(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}

/** 404 while the Console is off, so a deployment that does not use it reveals nothing. */
export function configOrNotFound(): ConsoleConfig | NextResponse {
  if (!consoleEnabled()) return problem(404, "Not found.");
  try {
    return loadConsoleConfig();
  } catch {
    return problem(503, "The Console is not configured.");
  }
}

/**
 * Checks that make a cookie-authenticated POST/PUT safe: a same-origin browser request (Origin must match, and
 * Sec-Fetch-Site must not say cross-site) carrying JSON of a sane size. SameSite=Strict cookies are the second layer.
 */
export async function readJsonBody(request: Request): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: NextResponse }> {
  if (!isSameOriginRequest(request.url, request.headers.get("origin"), request.headers.get("sec-fetch-site"))) {
    return { ok: false, response: problem(403, "Cross-site requests are not allowed.") };
  }
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return { ok: false, response: problem(415, "Send JSON.") };
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return { ok: false, response: problem(413, "The request is too large.") };
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return { ok: true, body: parsed as Record<string, unknown> };
  } catch {
    // fall through
  }
  return { ok: false, response: problem(400, "The request was not accepted.") };
}

/** The signed-in operator for an API call (refreshing once when the token is stale), or the 401 to return. */
export async function requireOperator(cfg: ConsoleConfig, opts: { write?: boolean } = {}): Promise<Operator | NextResponse> {
  const { operator, stale } = await currentOperator();
  const who = operator ?? (stale ? await refreshOperator(cfg, fetch) : null);
  if (!who) return problem(401, "Sign in required.");
  if (opts.write && !canWrite(who.claims.role)) return problem(403, "You do not have permission to do that.");
  return who;
}
