import { NextResponse } from "next/server";
import { passwordLogin } from "@/lib/console/auth-flow";
import { configOrNotFound, problem, readJsonBody } from "@/lib/console/handler";

export const dynamic = "force-dynamic";

/** Step one of operator sign-in. Never sets a session: the answer is a challenge for the second factor. */
export async function POST(request: Request) {
  const cfg = configOrNotFound();
  if (cfg instanceof NextResponse) return cfg;
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const r = await passwordLogin(fetch, cfg, parsed.body.email, parsed.body.password);
  if (!r.ok) {
    return problem(r.status, r.status === 502 ? "Sign-in is unavailable. Try again shortly." : r.status === 400 ? "Enter your email and password." : "Sign-in failed.");
  }
  return NextResponse.json(
    { step: r.challenge.step, mfa_token: r.challenge.token, methods: r.challenge.methods },
    { headers: { "cache-control": "no-store" } },
  );
}
