import { NextResponse } from "next/server";
import { Octokit } from "octokit";
import { websites } from "@/lib/websites";
import { requireApiAuth } from "@/lib/require-api-auth";
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export async function POST(request: Request) {
  const { session, response: authError } = await requireApiAuth();
  if (authError) return authError;

  const deployerEmail = session?.user?.email;
  if (!deployerEmail) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const deployerName = session?.user?.name || deployerEmail;

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
        inputs: {
          deployer_email: deployerEmail,
          deployer_name: deployerName,
          triggered_from: "HighVolt Deploy OS",
        },
      }
    );

    return NextResponse.json({
      success: true,
      message: `Deployment started for ${website.name}`,
      deployerEmail,
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