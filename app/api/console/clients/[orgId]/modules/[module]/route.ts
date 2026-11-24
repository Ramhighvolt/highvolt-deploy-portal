import { NextResponse } from "next/server";
import { setModule } from "@/lib/console/clients";
import { configOrNotFound, problem, readJsonBody, requireOperator } from "@/lib/console/handler";
import { publicStatus } from "@/lib/console/service-client";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ orgId: string; module: string }> };

/**
 * Switches one module on or off for one client. Allowed for owners and admins only; the platform records who did it
 * and why (the reason is required), and refuses a stale view of the client.
 */
export async function PUT(request: Request, ctx: Ctx) {
  const cfg = configOrNotFound();
  if (cfg instanceof NextResponse) return cfg;
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const who = await requireOperator(cfg, { write: true });
  if (who instanceof NextResponse) return who;
  const { orgId, module } = await ctx.params;
  const r = await setModule(fetch, cfg, who.token, {
    orgId,
    module,
    state: parsed.body.state,
    reason: parsed.body.reason,
    version: parsed.body.version,
  });
  if (!r.ok) {
    const p = publicStatus(r.upstream);
    return problem(p.status, p.message);
  }
  return NextResponse.json({ ok: true, changed: r.changed, version: r.version }, { headers: { "cache-control": "no-store" } });
}
