import type { DeploymentHistoryItem } from "@/lib/deployment-history";

export type DeploymentStatus =
  | "Success"
  | "Deploying"
  | "Queued"
  | "Failed"
  | "Error"
  | "Timed Out"
  | "Cancelled"
  | "Completed"
  | "No Runs"
  | "Unknown"
  | string;

export type WebsiteStatus = {
  id: string;
  name: string;
  domain: string;
  repo: string;
  status: string;
  lastDeploy: string;
  githubStatus?: DeploymentStatus;
  githubConclusion?: string | null;
  runUrl?: string | null;
  runId?: number | null;
  lastRunAt?: string | null;
  updatedAt?: string | null;
  commitSha?: string | null;
  branch?: string | null;
  deploymentHistory?: DeploymentHistoryItem[];
};

export type { DeploymentHistoryItem };

export type StatusVariant = "success" | "deploying" | "failed" | "unknown";

export function getStatusVariant(status?: DeploymentStatus): StatusVariant {
  if (status === "Success") return "success";
  if (status === "Deploying" || status === "Queued") return "deploying";
  if (
    status === "Failed" ||
    status === "Error" ||
    status === "Timed Out" ||
    status === "Cancelled"
  ) {
    return "failed";
  }
  return "unknown";
}

export function getStatusLabel(status?: DeploymentStatus): string {
  if (!status) return "Unknown";
  return status;
}

export function getHealthLabel(status?: DeploymentStatus): string {
  const variant = getStatusVariant(status);
  if (variant === "success") return "Healthy";
  if (variant === "deploying") return "Deploying";
  if (variant === "failed") return "Attention";
  return "Unknown";
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return "—";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatRelativeTime(value?: string | Date | null): string {
  if (!value) return "—";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function formatCommitSha(sha?: string | null): string {
  if (!sha) return "—";
  return sha.slice(0, 7);
}

export { formatDateIST } from "@/lib/deployment-history";

export function getStatusBadgeClasses(status?: DeploymentStatus): string {
  const variant = getStatusVariant(status);

  switch (variant) {
    case "success":
      return "border-emerald-500/25 bg-emerald-500/8 text-emerald-400";
    case "deploying":
      return "border-amber-500/25 bg-amber-500/8 text-amber-400";
    case "failed":
      return "border-red-500/25 bg-red-500/8 text-red-400";
    default:
      return "border-[#3d4a5c] bg-white/[0.03] text-[#8b9bb4]";
  }
}

export function getStatusDotClasses(status?: DeploymentStatus): string {
  const variant = getStatusVariant(status);

  switch (variant) {
    case "success":
      return "bg-emerald-500";
    case "deploying":
      return "bg-amber-500 pipeline-active";
    case "failed":
      return "bg-red-500";
    default:
      return "bg-[#5a6a7f]";
  }
}

export function getCardBorderClasses(status?: DeploymentStatus): string {
  const variant = getStatusVariant(status);

  switch (variant) {
    case "success":
      return "border-l-emerald-500/60";
    case "deploying":
      return "border-l-amber-500/60";
    case "failed":
      return "border-l-red-500/60";
    default:
      return "border-l-[#3d4a5c]";
  }
}

export type PipelineStepState = "complete" | "active" | "failed" | "pending";

export type PipelineStep = {
  label: string;
  state: PipelineStepState;
};

const PIPELINE_STEPS = [
  "Source",
  "Build",
  "Package",
  "Upload",
  "Verify",
  "Live",
];

export function getPipelineSteps(status?: DeploymentStatus): PipelineStep[] {
  const variant = getStatusVariant(status);

  if (variant === "success") {
    return PIPELINE_STEPS.map((label) => ({ label, state: "complete" as const }));
  }

  if (variant === "deploying") {
    return PIPELINE_STEPS.map((label, index) => ({
      label,
      state: index < 3 ? ("active" as const) : ("pending" as const),
    }));
  }

  if (status === "Queued") {
    return PIPELINE_STEPS.map((label, index) => ({
      label,
      state: index === 0 ? ("active" as const) : ("pending" as const),
    }));
  }

  if (variant === "failed") {
    return PIPELINE_STEPS.map((label, index) => {
      if (index < 2) return { label, state: "complete" as const };
      if (index === 2) return { label, state: "failed" as const };
      return { label, state: "pending" as const };
    });
  }

  return PIPELINE_STEPS.map((label) => ({ label, state: "pending" as const }));
}

export function getLatestDeployment(
  websites: WebsiteStatus[]
): WebsiteStatus | null {
  const withRuns = websites.filter((site) => site.lastRunAt);
  if (withRuns.length === 0) return null;

  return withRuns.reduce((latest, site) => {
    if (!latest.lastRunAt || !site.lastRunAt) return latest;
    return new Date(site.lastRunAt) > new Date(latest.lastRunAt)
      ? site
      : latest;
  });
}

export function getSystemStatus(
  websites: WebsiteStatus[]
): "operational" | "degraded" | "critical" {
  if (websites.length === 0) return "operational";

  const failed = websites.filter(
    (site) => getStatusVariant(site.githubStatus) === "failed"
  ).length;

  const deploying = websites.filter(
    (site) => getStatusVariant(site.githubStatus) === "deploying"
  ).length;

  if (failed > 0) return "critical";
  if (deploying > 0) return "degraded";
  return "operational";
}
