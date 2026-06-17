import DeployButton from "./DeployButton";
import DeploymentPipeline from "./DeploymentPipeline";
import StatusBadge from "./StatusBadge";
import {
  formatCommitSha,
  formatDate,
  formatRelativeTime,
  getHealthLabel,
  getStatusDotClasses,
  getStatusVariant,
  type WebsiteStatus,
} from "@/lib/status";

type WebsiteCardProps = {
  website: WebsiteStatus;
  variant?: "full" | "summary";
};

export default function WebsiteCard({
  website,
  variant = "full",
}: WebsiteCardProps) {
  const statusVariant = getStatusVariant(website.githubStatus);
  const health = getHealthLabel(website.githubStatus);

  const healthColor =
    statusVariant === "success"
      ? "text-emerald-400"
      : statusVariant === "deploying"
        ? "text-amber-400"
        : statusVariant === "failed"
          ? "text-red-400"
          : "text-[#8b9bb4]";

  if (variant === "summary") {
    return (
      <article className="hv-card rounded-xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className={`h-2.5 w-2.5 rounded-full ${getStatusDotClasses(website.githubStatus)}`}
            />
            <h3 className="font-semibold text-[#f0f4f8]">{website.name}</h3>
          </div>
          <StatusBadge status={website.githubStatus} />
        </div>
        <p className="mt-2 font-mono text-sm text-[#8b9bb4]">{website.domain}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Meta label="Commit" value={formatCommitSha(website.commitSha)} mono />
          <Meta label="Health" value={health} className={healthColor} />
          <Meta
            label="Last run"
            value={formatRelativeTime(website.lastRunAt)}
          />
          <Meta label="Branch" value={website.branch || "main"} mono />
        </div>
        <div className="mt-4">
          <DeploymentPipeline status={website.githubStatus} compact />
        </div>
      </article>
    );
  }

  return (
    <article className="hv-card rounded-xl p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`h-2.5 w-2.5 rounded-full ${getStatusDotClasses(website.githubStatus)}`}
            />
            <h3 className="text-lg font-semibold text-[#f0f4f8]">
              {website.name}
            </h3>
            <StatusBadge status={website.githubStatus} />
          </div>
          <p className="mt-1 font-mono text-sm text-[#60a5fa]">
            {website.domain}
          </p>
        </div>
        <p className={`text-sm font-medium ${healthColor}`}>{health}</p>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Meta label="Repository" value={website.repo} mono />
        <Meta label="Branch" value={website.branch || "main"} mono />
        <Meta label="Commit" value={formatCommitSha(website.commitSha)} mono />
        <Meta label="Last run" value={formatDate(website.lastRunAt)} />
      </div>

      <div className="mt-5">
        <DeploymentPipeline status={website.githubStatus} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#2a3548] pt-5">
        <DeployButton websiteId={website.id} websiteName={website.name} />
        {website.runUrl && (
          <a
            href={website.runUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-hv-secondary rounded-lg px-4 py-2 text-sm font-medium"
          >
            View Run
          </a>
        )}
        <a
          href={`https://${website.domain}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-hv-secondary rounded-lg px-4 py-2 text-sm font-medium"
        >
          Open Site
        </a>
      </div>
    </article>
  );
}

function Meta({
  label,
  value,
  mono = false,
  className = "text-[#c5d0de]",
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-[#6b7d96]">{label}</p>
      <p
        className={`mt-0.5 truncate text-sm ${mono ? "font-mono" : ""} ${className}`}
      >
        {value}
      </p>
    </div>
  );
}
