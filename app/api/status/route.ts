import { NextResponse } from "next/server";
import { createGitHubClient } from "@/lib/github-client";
import { mapWorkflowRunToHistoryItem, type DeploymentHistoryItem } from "@/lib/deployment-history";
import { requireApiAuth } from "@/lib/require-api-auth";
import { websites } from "@/lib/websites";

const HISTORY_PAGE_SIZE = 10;

export async function GET() {
  const { response } = await requireApiAuth();
  if (response) return response;
  try {
    const octokit = createGitHubClient();
    const results = await Promise.all(websites.map(async (website) => {
      try {
        const response = await octokit.request("GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs", {
          owner: website.owner, repo: website.repo, workflow_id: website.workflowFile, per_page: HISTORY_PAGE_SIZE,
        });
        const deploymentHistory: DeploymentHistoryItem[] = (response.data.workflow_runs ?? []).map((run) => mapWorkflowRunToHistoryItem(run as Parameters<typeof mapWorkflowRunToHistoryItem>[0]));
        const latestRun = deploymentHistory[0];
        let liveDomainReachable: boolean | null = null;
        let liveCommitSha: string | null = null;
        let deployedCommitMatchesDomain: boolean | null = null;
        if (website.id === "quantum-ledgerline") {
          try {
            const liveResponse = await fetch(`https://${website.domain}/deploy-info.txt`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
            liveDomainReachable = liveResponse.ok;
            if (liveResponse.ok) liveCommitSha = (await liveResponse.text()).match(/^Commit:\\s*([a-f0-9]{40})\\s*$/im)?.[1] ?? null;
            deployedCommitMatchesDomain = Boolean(latestRun?.commitSha && liveCommitSha && latestRun.commitSha.toLowerCase() === liveCommitSha.toLowerCase());
          } catch { liveDomainReachable = false; deployedCommitMatchesDomain = false; }
        }
        return {
          ...website,
          ...(website.id === "quantum-ledgerline" ? { deploymentEnabled: process.env.LEDGERLINE_PRODUCTION_CUTOVER_ENABLED === "true" } : {}),
          githubStatus: latestRun?.status ?? "No Runs",
          githubRawStatus: latestRun?.rawStatus ?? null,
          githubConclusion: latestRun?.conclusion ?? null,
          runUrl: latestRun?.runUrl ?? null,
          runId: latestRun?.runId ?? null,
          lastRunAt: latestRun?.createdAt ?? null,
          updatedAt: latestRun?.updatedAt ?? null,
          commitSha: latestRun?.commitSha ?? null,
          branch: latestRun?.branch ?? null,
          deploymentHistory,
          ...(website.id === "quantum-ledgerline" ? { liveDomainReachable, liveCommitSha, deployedCommitMatchesDomain } : {}),
        };
      } catch (error) {
        console.error("Failed to fetch deployment status", { websiteId: website.id, errorName: error instanceof Error ? error.name : "UnknownError" });
        return { ...website, githubStatus: "Error", githubConclusion: "error", runUrl: null, runId: null, lastRunAt: null, updatedAt: null, commitSha: null, branch: null, deploymentHistory: [] };
      }
    }));
    return NextResponse.json({ success: true, websites: results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to fetch deployment statuses", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ success: false, error: "Failed to fetch deployment statuses" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
