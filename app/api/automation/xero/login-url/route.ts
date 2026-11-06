import { XERO_TENANTS } from "@/lib/automation-catalog";
import { describeError, guard, jsonError, jsonOk, parseId } from "@/lib/automation-api";
import { listArtifacts, readArtifactFile } from "@/lib/automation-server";

/** Returns the Xero consent URL produced by a "Show login link" run. */
export async function GET(request: Request) {
  const { error } = await guard(request, false);
  if (error) return error;
  const url = new URL(request.url);
  const tenant = XERO_TENANTS.find((t) => t.id === url.searchParams.get("tenant"));
  const runId = parseId(url.searchParams.get("runId"));
  if (!tenant || !runId) return jsonError("Invalid request", 400);
  try {
    const artifact = (await listArtifacts("xero", runId, { includeLoginLinks: true })).find(
      (a) => a.name === tenant.loginArtifact && !a.expired,
    );
    if (!artifact) return jsonError("Login link is not ready yet", 404);
    const bytes = await readArtifactFile("xero", runId, artifact.id, "xero-login-url.txt");
    const text = new TextDecoder().decode(bytes);
    const link = /https:\/\/login\.xero\.com\/[^\s"'<>]+/.exec(text)?.[0];
    if (!link) return jsonError("Login link file did not contain a Xero URL", 502);
    return jsonOk({ url: link });
  } catch (e) {
    const { message, status } = describeError(e);
    return jsonError(message, status);
  }
}
