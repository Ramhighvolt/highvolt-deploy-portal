import {
  formatCommitSha,
  formatDate,
  formatRelativeTime,
  getStatusDotClasses,
  type WebsiteStatus,
} from "@/lib/status";
import StatusBadge from "./StatusBadge";
import type { SectionBaseProps } from "./OverviewSection";

export default function LogsSection({ websites, loading }: SectionBaseProps) {
  return (
    <div className="space-y-6">
      <div className="hv-panel rounded-2xl p-6 lg:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#2a3548] bg-[#1c2535]">
            <TerminalIcon className="h-6 w-6 text-[#60a5fa]" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[#f0f4f8]">
              Live logs module
            </h2>
            <p className="mt-1 text-sm text-[#8b9bb4]">
              Full streaming logs will be enabled in v2. Access run logs via
              GitHub Actions below.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="hv-skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {websites.map((site) => (
            <LogRow key={site.id} site={site} />
          ))}
        </div>
      )}
    </div>
  );
}

function LogRow({ site }: { site: WebsiteStatus }) {
  return (
    <div className="hv-card rounded-xl p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className={`mt-2 h-2 w-2 shrink-0 rounded-full ${getStatusDotClasses(site.githubStatus)}`}
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-[#f0f4f8]">{site.name}</h3>
              <StatusBadge status={site.githubStatus} showDot={false} />
            </div>
            <p className="mt-1 font-mono text-sm text-[#8b9bb4]">{site.repo}</p>
            <p className="mt-2 text-sm text-[#6b7d96]">
              {formatDate(site.lastRunAt)} ·{" "}
              <span className="font-mono text-[#60a5fa]">
                {formatCommitSha(site.commitSha)}
              </span>{" "}
              · {formatRelativeTime(site.lastRunAt)}
            </p>
          </div>
        </div>
        {site.runUrl ? (
          <a
            href={site.runUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-hv-primary shrink-0 rounded-lg px-4 py-2 text-sm font-medium"
          >
            Open GitHub Logs
          </a>
        ) : (
          <span className="text-sm text-[#6b7d96]">No run available</span>
        )}
      </div>
    </div>
  );
}

function TerminalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}
