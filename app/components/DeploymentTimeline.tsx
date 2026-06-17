import { flattenDeploymentHistory } from "@/lib/deployment-history";
import {
  formatRelativeTime,
  getStatusDotClasses,
  type WebsiteStatus,
} from "@/lib/status";

type DeploymentTimelineProps = {
  websites: WebsiteStatus[];
  loading?: boolean;
};

export default function DeploymentTimeline({
  websites,
  loading = false,
}: DeploymentTimelineProps) {
  const historyRows = flattenDeploymentHistory(websites).slice(0, 12);

  return (
    <aside className="hv-panel rounded-xl">
      <div className="border-b border-[#2a3548] px-5 py-4">
        <h3 className="text-base font-semibold text-[#f0f4f8]">
          Deployment Activity
        </h3>
        <p className="mt-0.5 text-sm text-[#6b7d96]">Recent GitHub Actions runs</p>
      </div>

      <div className="max-h-[480px] overflow-y-auto">
        {loading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="hv-skeleton h-16 rounded-lg" />
            ))}
          </div>
        ) : historyRows.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-[#8b9bb4]">No deployment events yet</p>
          </div>
        ) : (
          <ul>
            {historyRows.map((row) => (
              <li
                key={`${row.websiteId}-${row.runId}`}
                className="border-b border-[#2a3548]/50 px-5 py-4 last:border-0 transition-colors hover:bg-[#1c2535]/40"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${getStatusDotClasses(row.status)}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium text-[#e8ecf1]">
                        {row.websiteName}
                      </p>
                      <span className="shrink-0 text-xs text-[#6b7d96]">
                        {formatRelativeTime(row.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[#6b7d96]">
                      Deployed by {row.deployedByEmail} · Build #{row.runNumber}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className="text-[#6b7d96]">{row.createdAtIST}</span>
                      <span className="font-mono text-[#60a5fa]">
                        {row.shortCommitSha}
                      </span>
                      {row.runUrl && (
                        <a
                          href={row.runUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[#60a5fa] hover:text-[#93c5fd]"
                        >
                          View Run
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
