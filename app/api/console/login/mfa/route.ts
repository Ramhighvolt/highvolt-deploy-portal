import { NextResponse } from "next/server";
import { verifyMfa } from "@/lib/console/auth-flow";
import { configOrNotFound, problem, readJsonBody } from "@/lib/console/handler";
import { decodeClaims, isOperatorRole } from "@/lib/console/jwt";
import { setSessionCookies } from "@/lib/console/session";

export const dynamic = "force-dynamic";

/** Step two for an enrolled operator: a code or a recovery code. Success sets the session cookies. */
export async function POST(request: Request) {
  const cfg = configOrNotFound();
  if (cfg instanceof NextResponse) return cfg;
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const r = await verifyMfa(fetch, cfg, {
    token: parsed.body.mfa_token,
    code: parsed.body.code,
    recoveryCode: parsed.body.recovery_code,
  });
  if (!r.ok) return problem(r.status === 502 ? 502 : r.status === 400 ? 400 : 401, "That code was not accepted.");
  const claims = decodeClaims(r.accessToken);
  if (!claims || !isOperatorRole(claims.role)) return problem(403, "This account cannot use the Console.");
  await setSessionCookies(cfg, r);
  return NextResponse.json({ ok: true, role: claims.role }, { headers: { "cache-control": "no-store" } });
}
