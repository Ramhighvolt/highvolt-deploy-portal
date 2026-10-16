export const QVM_OWNER = "HighVolt-Analytics";
export const QVM_REPO = "Quantum-Visa-Manager";
export const QVM_BRANCH = "main";
export const QVM_WORKFLOW = "deploy.yml";

const FULL_COMMIT_SHA = /^[a-f0-9]{40}$/;

export type QvmRelease = {
  sha: string;
  shortSha: string;
  message: string;
  committedAt: string | null;
};

/** Resolve only the fixed Quantum Visa Manager main ref; no caller-provided routing is accepted. */
export async function resolveQvmMainRelease(octokit: {
  request: (route: string, parameters: Record<string, string>) => Promise<{ data: unknown }>;
}): Promise<QvmRelease> {
  const response = await octokit.request("GET /repos/{owner}/{repo}/commits/{ref}", {
    owner: QVM_OWNER,
    repo: QVM_REPO,
    ref: QVM_BRANCH,
  });
  const data = response.data as {
    sha?: unknown;
    commit?: { message?: unknown; committer?: { date?: unknown } | null };
  } | null;
  const sha = typeof data?.sha === "string" ? data.sha.toLowerCase() : "";
  if (!FULL_COMMIT_SHA.test(sha)) throw new Error("Invalid commit metadata from GitHub");

  const rawMessage = typeof data?.commit?.message === "string" ? data.commit.message : "";
  const printableMessage = Array.from(rawMessage, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || codePoint === 127 ? " " : character;
  }).join("");
  const message = printableMessage.replace(/\s+/g, " ").trim().slice(0, 240) || "No commit message";
  const committedAt = typeof data?.commit?.committer?.date === "string" && !Number.isNaN(Date.parse(data.commit.committer.date))
    ? data.commit.committer.date
    : null;

  return { sha, shortSha: sha.slice(0, 7), message, committedAt };
}

export function validateQvmReleaseConfirmation(
  releaseCommit: unknown,
  confirmation: unknown,
  currentMainSha: string,
): { ok: true } | { ok: false; reason: "invalid_confirmation" | "stale_release" } {
  if (typeof releaseCommit !== "string" || !FULL_COMMIT_SHA.test(releaseCommit) || confirmation !== "DEPLOY") {
    return { ok: false, reason: "invalid_confirmation" };
  }
  if (!FULL_COMMIT_SHA.test(currentMainSha) || releaseCommit !== currentMainSha) {
    return { ok: false, reason: "stale_release" };
  }
  return { ok: true };
}

export function hasActiveQvmMainDeployment(runs: Array<{
  head_branch?: string | null;
  status?: string | null;
}>): boolean {
  return runs.some((run) => run.head_branch === QVM_BRANCH && (run.status === "queued" || run.status === "in_progress"));
}
