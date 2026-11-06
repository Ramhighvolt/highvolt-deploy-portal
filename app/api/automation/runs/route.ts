import { isAllowedWorkflow } from "@/lib/automation-catalog";
import { describeError, guard, jsonError, jsonOk, parseSuite } from "@/lib/automation-api";
import { listRuns } from "@/lib/automation-server";

export async function GET(request: Request) {
  const { error } = await guard(request, false);
  if (error) return error;
  const url = new URL(request.url);
  const suite = parseSuite(url.searchParams.get("suite"));
  if (!suite) return jsonError("Unknown suite", 400);
  const workflows = url.searchParams.getAll("workflow");
  if (workflows.some((w) => !isAllowedWorkflow(suite, w)))
    return jsonError("Workflow not allowed", 400);
  try {
    const runs = await listRuns(suite, workflows.length ? workflows : null, 10);
    return jsonOk({ runs: runs.slice(0, 30), fetchedAt: new Date().toISOString() });
  } catch (e) {
    const { message, status } = describeError(e);
    return jsonError(message, status);
  }
}
