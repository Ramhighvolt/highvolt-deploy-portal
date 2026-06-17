import type { AppSection } from "@/lib/navigation";
import {
  formatDate,
  formatRelativeTime,
  getLatestDeployment,
  type WebsiteStatus,
} from "@/lib/status";
import DeploymentTimeline from "./DeploymentTimeline";
import MetricTile, { MetricTileSkeleton } from "./MetricTile";
import WebsiteCard from "./WebsiteCard";

export type SectionBaseProps = {
  websites: WebsiteStatus[];
  loading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onNavigate: (section: AppSection) => void;
  healthyCount: number;
  deployingCount: number;
  attentionCount: number;
};

export default function OverviewSection({
  websites,
  loading,
  isRefreshing,
  onRefresh,
  onNavigate,
  healthyCount,
  deployingCount,
  attentionCount,
}: SectionBaseProps) {
  const latest = getLatestDeployment(websites);
  const propertyCount = websites.length || (loading ? 4 : 0);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="hv-panel relative overflow-hidden rounded-2xl p-6 lg:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#3b82f6]/8 blur-3xl" />
        <div className="relative">
          <p className="text-sm font-medium text-[#60a5fa]">
            HighVolt Deploy OS
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#f0f4f8] lg:text-3xl">
            Production deployment command
          </h2>
          <p className="mt-2 max-w-xl text-base text-[#8b9bb4]">
            Monitor, deploy, and verify all HighVolt and Quantum production
            properties from a single operations interface.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="hv-badge text-[#93c5fd]">
              {propertyCount} properties
            </span>
            <span className="hv-badge text-emerald-400">GitHub Actions</span>
            <span className="hv-badge text-[#93c5fd]">SSH/SCP transport</span>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <MetricTileSkeleton key={i} />
          ))
        ) : (
          <>
            <MetricTile
              label="Healthy"
              value={healthyCount}
              accent="success"
              detail="Latest run passed"
            />
            <MetricTile
              label="Deploying"
              value={deployingCount}
              accent="warning"
              detail="Active pipelines"
            />
            <MetricTile
              label="Attention"
              value={attentionCount}
              accent={attentionCount > 0 ? "danger" : "default"}
              detail="Requires review"
            />
            <MetricTile
              label="Last deployment"
              value={latest ? formatRelativeTime(latest.lastRunAt) : "—"}
              detail={
                latest
                  ? `${latest.name} · ${formatDate(latest.lastRunAt)}`
                  : "No runs yet"
              }
            />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[#f0f4f8]">
              Property fleet
            </h3>
            <button
              type="button"
              onClick={() => onNavigate("websites")}
              className="text-sm font-medium text-[#60a5fa] hover:text-[#93c5fd]"
            >
              View all →
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="hv-skeleton h-48 rounded-xl" />
                ))
              : websites.map((site) => (
                  <WebsiteCard
                    key={site.id}
                    website={site}
                    variant="summary"
                  />
                ))}
          </div>
        </div>

        <DeploymentTimeline websites={websites} loading={loading} />
      </div>

      {/* Quick actions */}
      <div className="hv-panel-light rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[#f0f4f8]">Quick actions</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="btn-hv-secondary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {isRefreshing ? "Refreshing…" : "Refresh status"}
          </button>
          <button
            type="button"
            onClick={() => onNavigate("websites")}
            className="btn-hv-secondary rounded-lg px-4 py-2 text-sm font-medium"
          >
            Manage websites
          </button>
          <button
            type="button"
            onClick={() => onNavigate("deployments")}
            className="btn-hv-secondary rounded-lg px-4 py-2 text-sm font-medium"
          >
            View deployments
          </button>
          <button
            type="button"
            onClick={() => onNavigate("health")}
            className="btn-hv-secondary rounded-lg px-4 py-2 text-sm font-medium"
          >
            Health dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
