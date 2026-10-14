import { NextResponse } from "next/server";
import { createGitHubClient } from "@/lib/github-client";
import { requireApiAuth } from "@/lib/require-api-auth";
import { isSameOriginRequest, productionDispatchError, validateDispatchBody } from "@/lib/security-policy";
import { websites } from "@/lib/websites";

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
    const dispatchError = productionDispatchError(website, process.env.LEDGERLINE_PRODUCTION_CUTOVER_ENABLED, body.releaseCommit, body.confirmProduction);
    if (dispatchError) return NextResponse.json({ success: false, error: dispatchError.error }, { status: dispatchError.status, headers: { "Cache-Control": "no-store" } });

    const email = session?.user?.email;
    if (!email) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const octokit = createGitHubClient();
    const inputs = website.id === "quantum-ledgerline"
      ? { release_commit: body.releaseCommit, confirm_production: body.confirmProduction }
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
