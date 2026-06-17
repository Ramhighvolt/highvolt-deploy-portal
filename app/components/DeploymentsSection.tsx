"use client";

import { flattenDeploymentHistory } from "@/lib/deployment-history";
import {
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

function formatPushedBy(
  name: string | null | undefined,
  email: string | null | undefined
): string {
  if (name && email) return `${name} (${email})`;
  if (name) return name;
  if (email) return email;
  return "—";
}

export default function DeploymentsSection({
  websites,
  loading,
  filter,
  onFilterChange,
}: DeploymentsSectionProps) {
  const historyRows = flattenDeploymentHistory(websites);

  const filtered = historyRows.filter((row) => {
    const variant = getStatusVariant(row.status);
    if (filter === "all") return true;
    if (filter === "success") return variant === "success";
    if (filter === "failed") return variant === "failed";
    if (filter === "deploying") return variant === "deploying";
    return true;
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
        <div className="hv-skeleton h-96 rounded-xl" />
      ) : filtered.length === 0 ? (
        <div className="hv-panel rounded-xl px-8 py-12 text-center">
          <p className="text-[#8b9bb4]">No deployments match this filter</p>
        </div>
      ) : (
        <div className="hv-panel overflow-hidden rounded-xl">
          <div className="border-b border-[#2a3548] px-5 py-4">
            <h3 className="text-base font-semibold text-[#f0f4f8]">
              Deployment History
            </h3>
            <p className="mt-0.5 text-sm text-[#6b7d96]">
              Recent workflow runs from GitHub Actions (IST)
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b border-[#2a3548] bg-[#1c2535]/60 text-xs uppercase tracking-wide text-[#6b7d96]">
                <tr>
                  <th className="px-4 py-3 font-medium">Website</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Deployed by</th>
                  <th className="px-4 py-3 font-medium">Pushed by</th>
                  <th className="px-4 py-3 font-medium">Commit</th>
                  <th className="px-4 py-3 font-medium">Build</th>
                  <th className="px-4 py-3 font-medium">Branch</th>
                  <th className="px-4 py-3 font-medium">Started IST</th>
                  <th className="px-4 py-3 font-medium">Completed IST</th>
                  <th className="px-4 py-3 font-medium">Run</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={`${row.websiteId}-${row.runId}`}
                    className="border-b border-[#2a3548]/50 transition-colors hover:bg-[#1c2535]/40"
                  >
                    <td className="px-4 py-3 font-medium text-[#e8ecf1]">
                      {row.websiteName}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3 text-[#c5d0de]">
                      {row.deployedByName || row.deployedByEmail}
                    </td>
                    <td className="px-4 py-3 text-[#c5d0de]">
                      {formatPushedBy(
                        row.commitAuthorName,
                        row.commitAuthorEmail
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-[220px]">
                        <p
                          className="truncate font-mono text-[#60a5fa]"
                          title={row.shortCommitSha}
                        >
                          {row.shortCommitSha}
                        </p>
                        {row.commitMessage && (
                          <p
                            className="mt-0.5 truncate text-xs text-[#6b7d96]"
                            title={row.commitMessage}
                          >
                            {row.commitMessage}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[#c5d0de]">
                      #{row.runNumber}
                    </td>
                    <td className="px-4 py-3 font-mono text-[#8b9bb4]">
                      {row.branch || "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[#8b9bb4]">
                      {row.createdAtIST}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[#8b9bb4]">
                      {row.updatedAtIST}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={row.runUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-[#60a5fa] hover:text-[#93c5fd]"
                      >
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export type { DeployFilter };
