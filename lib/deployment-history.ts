import type { DeploymentStatus } from "@/lib/status";

export type DeploymentHistoryItem = {
  runId: number;
  runNumber: number;
  runName: string;
  status: DeploymentStatus;
  rawStatus: string | null;
  conclusion: string | null;
  event: string;
  branch: string | null;
  commitSha: string | null;
  shortCommitSha: string;
  commitMessage: string | null;
  commitAuthorName: string | null;
  commitAuthorEmail: string | null;
  githubActor: string;
  createdAt: string;
  updatedAt: string;
  createdAtIST: string;
  updatedAtIST: string;
  runUrl: string;
  deployedByEmail: string;
  deployedByName: string | null;
};

type WorkflowRun = {
  id: number;
  name?: string | null;
  display_title?: string | null;
  run_number: number;
  status?: string | null;
  conclusion?: string | null;
  event: string;
  head_branch?: string | null;
  head_sha?: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  actor?: { login?: string | null; name?: string | null } | null;
  head_commit?: {
    message?: string | null;
    author?: { name?: string | null; email?: string | null } | null;
  } | null;
};

const istFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDateIST(value?: string | Date | null): string {
  if (!value) return "—";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return `${istFormatter.format(date)} IST`;
}

export function mapRunStatus(
  status: string | null | undefined,
  conclusion: string | null | undefined
): DeploymentStatus {
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

const EMAIL_PATTERN = /[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/;

export function parseDeployerFromRunName(
  runName: string | null | undefined,
  githubActor: string
): { deployedByEmail: string; deployedByName: string | null } {
  const normalizedName = runName?.trim() ?? "";
  const emailMatch = normalizedName.match(EMAIL_PATTERN);
  const deployedByEmail = emailMatch?.[0].toLowerCase() ?? githubActor;

  let deployedByName: string | null = null;
  const byMatch = normalizedName.match(/\bby\s+(.+)$/i);
  if (byMatch?.[1]) {
    const candidate = byMatch[1].trim();
    if (candidate && !EMAIL_PATTERN.test(candidate)) {
      deployedByName = candidate;
    } else if (emailMatch) {
      deployedByName = emailMatch[0].toLowerCase();
    }
  }

  return { deployedByEmail, deployedByName };
}

export function mapWorkflowRunToHistoryItem(run: WorkflowRun): DeploymentHistoryItem {
  const githubActor = run.actor?.login ?? "unknown";
  const runName = run.display_title || run.name || `Run #${run.run_number}`;
  const { deployedByEmail, deployedByName } = parseDeployerFromRunName(
    runName,
    githubActor
  );

  const commitSha = run.head_sha ?? null;
  const commitMessage = run.head_commit?.message?.trim() || null;
  const commitAuthorName = run.head_commit?.author?.name?.trim() || null;
  const commitAuthorEmail = run.head_commit?.author?.email?.trim() || null;

  return {
    runId: run.id,
    runNumber: run.run_number,
    runName,
    status: mapRunStatus(run.status, run.conclusion),
    rawStatus: run.status ?? null,
    conclusion: run.conclusion ?? null,
    event: run.event,
    branch: run.head_branch ?? null,
    commitSha,
    shortCommitSha: commitSha ? commitSha.slice(0, 7) : "—",
    commitMessage,
    commitAuthorName,
    commitAuthorEmail,
    githubActor,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    createdAtIST: formatDateIST(run.created_at),
    updatedAtIST: formatDateIST(run.updated_at),
    runUrl: run.html_url,
    deployedByEmail,
    deployedByName,
  };
}

export type DeploymentHistoryRow = DeploymentHistoryItem & {
  websiteId: string;
  websiteName: string;
};

export function flattenDeploymentHistory(
  websites: Array<{
    id: string;
    name: string;
    deploymentHistory?: DeploymentHistoryItem[];
  }>
): DeploymentHistoryRow[] {
  return websites
    .flatMap((site) =>
      (site.deploymentHistory ?? []).map((item) => ({
        ...item,
        websiteId: site.id,
        websiteName: site.name,
      }))
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}
