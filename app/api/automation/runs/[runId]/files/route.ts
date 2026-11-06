import { describeError, guard, jsonError, jsonOk, parseId, parseSuite } from "@/lib/automation-api";
import { listArtifactFiles, listArtifacts } from "@/lib/automation-server";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ runId: string }> },
) {
  const { error } = await guard(request, false);
  if (error) return error;
  const suite = parseSuite(new URL(request.url).searchParams.get("suite"));
  const runId = parseId((await ctx.params).runId);
  if (!suite || !runId) return jsonError("Invalid request", 400);
  try {
    const [artifacts, files] = await Promise.all([
      listArtifacts(suite, runId),
      listArtifactFiles(suite, runId),
    ]);
    return jsonOk({ artifacts, files });
  } catch (e) {
    const { message, status } = describeError(e);
    return jsonError(message, status);
  }
}
