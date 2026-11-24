import { NextResponse } from "next/server";
import { startEnroll } from "@/lib/console/auth-flow";
import { configOrNotFound, problem, readJsonBody } from "@/lib/console/handler";

export const dynamic = "force-dynamic";

/** First sign-in: creates the authenticator secret. The secret is shown once and never stored by the portal. */
export async function POST(request: Request) {
  const cfg = configOrNotFound();
  if (cfg instanceof NextResponse) return cfg;
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const r = await startEnroll(fetch, cfg, parsed.body.mfa_token);
  if (!r.ok) return problem(r.status === 502 ? 502 : r.status === 400 ? 400 : 401, "Sign in again to set up your authenticator.");
  return NextResponse.json({ secret: r.secret, otpauth_uri: r.otpauthUri }, { headers: { "cache-control": "no-store" } });
}
