"use client";

import {
  formatCommitSha,
  formatDate,
  getStatusVariant,
  type WebsiteStatus,
} from "@/lib/status";
import StatusBadge from "./StatusBadge";
import type { SectionBaseProps } from "./OverviewSection";

type DeployFilter = "all" | "success" | "failed" | "deploying";

type DeploymentsSectionProps = SectionBaseProps & {
  filter: DeployFilter;
  onFilterChange: (filter: DeployFilter) => void;
};

const FILTERS: { id: DeployFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "success", label: "Success" },
  { id: "failed", label: "Failed" },
  { id: "deploying", label: "Deploying" },
];

export default function DeploymentsSection({
  websites,
  loading,
  filter,
  onFilterChange,
}: DeploymentsSectionProps) {
  const filtered = websites.filter((site) => {
    const variant = getStatusVariant(site.githubStatus);
    if (filter === "all") return true;
    if (filter === "success") return variant === "success";
    if (filter === "failed") return variant === "failed";
    if (filter === "deploying") return variant === "deploying";
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!a.lastRunAt) return 1;
    if (!b.lastRunAt) return -1;
    return new Date(b.lastRunAt).getTime() - new Date(a.lastRunAt).getTime();
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onFilterChange(f.id)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
              filter === f.id
                ? "nav-active"
                : "border-[#2a3548] text-[#8b9bb4] hover:border-[#3d4f6a] hover:text-[#e8ecf1]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="hv-skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="hv-panel rounded-xl px-8 py-12 text-center">
          <p className="text-[#8b9bb4]">No deployments match this filter</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((site) => (
            <DeploymentRow key={site.id} site={site} />
          ))}
        </div>
      )}
    </div>
  );
}

function DeploymentRow({ site }: { site: WebsiteStatus }) {
  return (
    <div className="hv-card rounded-xl p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-semibold text-[#f0f4f8]">{site.name}</h3>
            <StatusBadge status={site.githubStatus} />
          </div>
          <p className="mt-1 font-mono text-sm text-[#8b9bb4]">{site.repo}</p>
        </div>
        {site.runUrl && (
          <a
            href={site.runUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-hv-secondary shrink-0 rounded-lg px-4 py-2 text-sm font-medium"
          >
            View Run
          </a>
        )}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Field label="Branch" value={site.branch || "main"} />
        <Field label="Commit" value={formatCommitSha(site.commitSha)} mono />
        <Field label="Timestamp" value={formatDate(site.lastRunAt)} />
        <Field label="Domain" value={site.domain} />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-[#6b7d96]">{label}</p>
      <p
        className={`mt-0.5 text-sm text-[#c5d0de] ${mono ? "font-mono" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

export type { DeployFilter };
