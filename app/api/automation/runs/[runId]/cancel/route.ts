import { describeError, guard, jsonError, jsonOk, parseId, parseSuite } from "@/lib/automation-api";
import { cancelRun } from "@/lib/automation-server";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ runId: string }> },
) {
  const { error } = await guard(request, true);
  if (error) return error;
  const suite = parseSuite(new URL(request.url).searchParams.get("suite"));
  const runId = parseId((await ctx.params).runId);
  if (!suite || !runId) return jsonError("Invalid request", 400);
  try {
    await cancelRun(suite, runId);
    return jsonOk({});
  } catch (e) {
    const { message, status } = describeError(e);
    return jsonError(message, status);
  }
}
