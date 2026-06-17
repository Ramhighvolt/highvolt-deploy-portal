import { NextResponse } from "next/server";
import { Octokit } from "octokit";
import { websites } from "@/lib/websites";
import { requireApiAuth } from "@/lib/require-api-auth";
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

function mapStatus(status: string | null, conclusion: string | null) {
  if (status === "queued") return "Queued";
  if (status === "in_progress") return "Deploying";

  if (status === "completed") {
    if (conclusion === "success") return "Success";
    if (conclusion === "failure") return "Failed";
    if (conclusion === "cancelled") return "Cancelled";
    if (conclusion === "timed_out") return "Timed Out";
    return "Completed";
  }

  return "Unknown";
}

export async function GET() {
  const { response: authError } = await requireApiAuth();
  if (authError) return authError;

  try {    const owner = process.env.GITHUB_OWNER || "HighVolt-Analytics";

    const results = await Promise.all(
      websites.map(async (website) => {
        try {
          const response = await octokit.request(
            "GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs",
            {
              owner,
              repo: website.repo,
              workflow_id: website.workflowFile,
              per_page: 1,
            }
          );

          const latestRun = response.data.workflow_runs[0];

          if (!latestRun) {
            return {
              ...website,
              githubStatus: "No Runs",
              githubConclusion: null,
              runUrl: null,
              runId: null,
              lastRunAt: null,
            };
          }

          return {
            ...website,
            githubStatus: mapStatus(
              latestRun.status,
              latestRun.conclusion
            ),
            githubRawStatus: latestRun.status,
            githubConclusion: latestRun.conclusion,
            runUrl: latestRun.html_url,
            runId: latestRun.id,
            lastRunAt: latestRun.created_at,
            updatedAt: latestRun.updated_at,
            commitSha: latestRun.head_sha,
            branch: latestRun.head_branch,
          };
        } catch (error) {
          console.error(`Failed to fetch status for ${website.repo}`, error);

          return {
            ...website,
            githubStatus: "Error",
            githubConclusion: "error",
            runUrl: null,
            runId: null,
            lastRunAt: null,
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