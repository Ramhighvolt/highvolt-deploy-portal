import "server-only";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "octokit";

export function createGitHubClient() {
  const appId = process.env.GITHUB_APP_ID;
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!appId || !installationId || !privateKey || !/^\d+$/.test(installationId)) {
    throw new Error("GitHub App credentials are not configured");
  }

  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      installationId: Number(installationId),
      privateKey,
    },
  });
}
