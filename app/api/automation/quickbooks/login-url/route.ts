import { QBO_LOGIN_ARTIFACT } from "@/lib/automation-catalog";
import { describeError, guard, jsonError, jsonOk, parseId } from "@/lib/automation-api";
import { listArtifacts, readArtifactFileMatching } from "@/lib/automation-server";

/** Returns the Intuit consent URL produced by a "Show login link" run. */
export async function GET(request: Request) {
  const { error } = await guard(request, false);
  if (error) return error;
  const runId = parseId(new URL(request.url).searchParams.get("runId"));
  if (!runId) return jsonError("Invalid request", 400);
  try {
    const artifact = (await listArtifacts("quickbooks", runId, { includeLoginLinks: true })).find(
      (a) => a.name === QBO_LOGIN_ARTIFACT && !a.expired,
    );
    if (!artifact) return jsonError("Login link is not ready yet", 404);
    const bytes = await readArtifactFileMatching(
      "quickbooks",
      runId,
      artifact.id,
      /qbo-login-url\.txt$/,
    );
    const text = new TextDecoder().decode(bytes);
    // Only ever hand the browser an https Intuit URL.
    const link = /https:\/\/(?:[a-z0-9-]+\.)*intuit\.com\/[^\s"'<>]+/i.exec(text)?.[0];
    if (!link) return jsonError("Login link file did not contain an Intuit URL", 502);
    return jsonOk({ url: link });
  } catch (e) {
    const { message, status } = describeError(e);
    return jsonError(message, status);
  }
}
