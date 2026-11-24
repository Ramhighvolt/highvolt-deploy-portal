import { NextResponse } from "next/server";
import { logoutUpstream } from "@/lib/console/auth-flow";
import { configOrNotFound, problem } from "@/lib/console/handler";
import { clearSessionCookies, readRefreshToken } from "@/lib/console/session";
import { isSameOriginRequest } from "@/lib/security-policy";

export const dynamic = "force-dynamic";

/** Ends the platform session (best effort) and always clears the cookies. */
export async function POST(request: Request) {
  const cfg = configOrNotFound();
  if (cfg instanceof NextResponse) return cfg;
  if (!isSameOriginRequest(request.url, request.headers.get("origin"), request.headers.get("sec-fetch-site"))) {
    return problem(403, "Cross-site requests are not allowed.");
  }
  const refresh = await readRefreshToken();
  if (refresh) await logoutUpstream(fetch, cfg, refresh);
  await clearSessionCookies();
  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
