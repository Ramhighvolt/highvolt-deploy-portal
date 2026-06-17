import { NextResponse } from "next/server";
import { Octokit } from "octokit";
import { websites } from "@/lib/websites";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const websiteId = body.websiteId;

    const website = websites.find((site) => site.id === websiteId);

    if (!website) {
      return NextResponse.json(
        { success: false, error: "Website not found" },
        { status: 404 }
      );
    }

    const owner = process.env.GITHUB_OWNER || website.owner;

    await octokit.request(
      "POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches",
      {
        owner,
        repo: website.repo,
        workflow_id: website.workflowFile,
        ref: website.branch,
      }
    );

    return NextResponse.json({
      success: true,
      message: `Deployment started for ${website.name}`,
      website,
    });
  } catch (error) {
    console.error("Deployment trigger failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to start deployment",
      },
      { status: 500 }
    );
  }
}