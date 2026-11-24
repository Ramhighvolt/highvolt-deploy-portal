import { NextResponse } from "next/server";
import { configOrNotFound } from "@/lib/console/handler";
import { refreshOperator } from "@/lib/console/session";

export const dynamic = "force-dynamic";

/** Only a path inside the Console may be the destination (never an arbitrary URL). */
function safeNext(value: string | null): string {
  return value && /^\/console(\/[A-Za-z0-9_\-/]*)?(\?[A-Za-z0-9_\-=&%.]*)?$/.test(value) ? value : "/console/clients";
}

/** Pages cannot set cookies, so a stale access token sends the browser here to refresh and come straight back. */
export async function GET(request: Request) {
  const cfg = configOrNotFound();
  if (cfg instanceof NextResponse) return cfg;
  const next = safeNext(new URL(request.url).searchParams.get("next"));
  const operator = await refreshOperator(cfg, fetch);
  const target = operator ? next : "/console/login";
  return NextResponse.redirect(new URL(target, request.url), { status: 303 });
}
