import { NextResponse } from "next/server";
import { createGitHubClient } from "@/lib/github-client";
import { requireApiAuth } from "@/lib/require-api-auth";
import { isSameOriginRequest, productionDispatchError, validateDispatchBody } from "@/lib/security-policy";
import { websites } from "@/lib/websites";
import { hasActiveMainDeployment, LEDGERLINE_BRANCH, LEDGERLINE_OWNER, LEDGERLINE_REPO, LEDGERLINE_WORKFLOW, resolveLedgerlineMainRelease, validateLedgerlineReleaseConfirmation } from "@/lib/ledgerline-release";

export async function POST(request: Request) {
  const { session, response } = await requireApiAuth();
  if (response) return response;
  if (!isSameOriginRequest(request.url, request.headers.get("origin"), request.headers.get("sec-fetch-site"))) {
    return NextResponse.json({ success: false, error: "Same-origin request required" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const body = await request.json().catch(() => null);
    const selection = validateDispatchBody(body, websites);
    if (!selection.ok) return NextResponse.json({ success: false, error: selection.error }, { status: 400, headers: { "Cache-Control": "no-store" } });
    const website = selection.website;
    const dispatchError = productionDispatchError(website, process.env.LEDGERLINE_PORTAL_DISPATCH_ENABLED, body.releaseCommit, body.confirmProduction);
    if (dispatchError) return NextResponse.json({ success: false, error: dispatchError.error }, { status: dispatchError.status, headers: { "Cache-Control": "no-store" } });

    const email = session?.user?.email;
    if (!email) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const octokit = createGitHubClient();
    if (website.id === "quantum-ledgerline") {
      const currentMain = await resolveLedgerlineMainRelease(octokit);
      const confirmation = validateLedgerlineReleaseConfirmation(body.releaseCommit, body.confirmProduction, currentMain.sha);
      if (!confirmation.ok) {
        return NextResponse.json({ success: false, error: confirmation.reason === "stale_release" ? "Ledgerline main changed after review. Review the latest release and confirm again." : "Invalid Ledgerline release confirmation" }, { status: confirmation.reason === "stale_release" ? 409 : 400, headers: { "Cache-Control": "no-store" } });
      }

      const activeStatuses: Array<"queued" | "in_progress"> = ["queued", "in_progress"];
      const [queuedResponse, runningResponse] = await Promise.all(activeStatuses.map((status) =>
        octokit.request("GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs", {
          owner: LEDGERLINE_OWNER,
          repo: LEDGERLINE_REPO,
          workflow_id: LEDGERLINE_WORKFLOW,
          branch: LEDGERLINE_BRANCH,
          status,
          per_page: 100,
        })
      ));
      const runs = [...(queuedResponse.data.workflow_runs ?? []), ...(runningResponse.data.workflow_runs ?? [])] as Array<{ head_branch?: string | null; status?: string | null }>;
      if (hasActiveMainDeployment(runs)) {
        return NextResponse.json({ success: false, error: "A Ledgerline production deployment is already queued or running" }, { status: 409, headers: { "Cache-Control": "no-store" } });
      }

      // Re-read main immediately before dispatch so a commit change during the run check is rejected.
      const finalMain = await resolveLedgerlineMainRelease(octokit);
      const finalConfirmation = validateLedgerlineReleaseConfirmation(body.releaseCommit, body.confirmProduction, finalMain.sha);
      if (!finalConfirmation.ok) {
        return NextResponse.json({ success: false, error: "Ledgerline main changed after review. Review the latest release and confirm again." }, { status: 409, headers: { "Cache-Control": "no-store" } });
      }
    }
    const inputs = website.id === "quantum-ledgerline"
      ? { release_commit: body.releaseCommit, confirm_production: "DEPLOY" }
      : { deployer_email: email, deployer_name: session.user.name || email, triggered_from: "HighVolt Deploy Portal" };
    await octokit.request("POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches", {
      owner: website.owner, repo: website.repo, workflow_id: website.workflowFile, ref: website.branch, inputs,
    });

    return NextResponse.json({ success: true, message: `Deployment started for ${website.name}`, deployerEmail: email, website: { id: website.id, name: website.name, domain: website.domain, repo: website.repo, branch: website.branch, workflowFile: website.workflowFile } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Deployment trigger failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ success: false, error: "Failed to start deployment" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
