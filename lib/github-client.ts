import "server-only";
import { Octokit } from "octokit";

/**
 * Create an Octokit client with the existing server-side GitHub token.
 * This module is server-only so the token cannot enter client bundles.
 */
export function createGitHubClient() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GitHub token is not configured");

  return new Octokit({ auth: token });
}
