import { NextResponse } from "next/server";
import { Octokit } from "octokit";
import {
  mapWorkflowRunToHistoryItem,
  type DeploymentHistoryItem,
} from "@/lib/deployment-history";
import { requireApiAuth } from "@/lib/require-api-auth";
import { websites } from "@/lib/websites";

const HISTORY_PAGE_SIZE = 10;

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export async function GET() {
  const { response: authError } = await requireApiAuth();
  if (authError) return authError;

  try {
    const results = await Promise.all(
      websites.map(async (website) => {
        const owner = process.env.GITHUB_OWNER || website.owner;

        try {
          const response = await octokit.request(
            "GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs",
            {
              owner,
              repo: website.repo,
              workflow_id: website.workflowFile,
              per_page: HISTORY_PAGE_SIZE,
            }
          );

          const runs = response.data.workflow_runs ?? [];
          const deploymentHistory: DeploymentHistoryItem[] = runs.map(
            mapWorkflowRunToHistoryItem
          );
          const latestRun = deploymentHistory[0];

          if (!latestRun) {
            return {
              ...website,
              githubStatus: "No Runs" as const,
              githubConclusion: null,
              runUrl: null,
              runId: null,
              lastRunAt: null,
              updatedAt: null,
              commitSha: null,
              branch: null,
              deploymentHistory: [],
            };
          }

          return {
            ...website,
            githubStatus: latestRun.status,
            githubRawStatus: latestRun.rawStatus,
            githubConclusion: latestRun.conclusion,
            runUrl: latestRun.runUrl,
            runId: latestRun.runId,
            lastRunAt: latestRun.createdAt,
            updatedAt: latestRun.updatedAt,
            commitSha: latestRun.commitSha,
            branch: latestRun.branch,
            deploymentHistory,
          };
        } catch (error) {
          console.error(`Failed to fetch status for ${website.repo}`, error);

          return {
            ...website,
            githubStatus: "Error" as const,
            githubConclusion: "error",
            runUrl: null,
            runId: null,
            lastRunAt: null,
            updatedAt: null,
            commitSha: null,
            branch: null,
            deploymentHistory: [],
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      websites: results,
    });
  } catch (error) {
    console.error("Failed to fetch deployment statuses:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch deployment statuses",
      },
      { status: 500 }
    );
  }
}
