import {
  formatDate,
  getHealthLabel,
  getStatusVariant,
  type WebsiteStatus,
} from "@/lib/status";
import StatusBadge from "./StatusBadge";
import type { SectionBaseProps } from "./OverviewSection";

export default function HealthSection({
  websites,
  loading,
}: SectionBaseProps) {
  const operational = websites.filter(
    (s) => getStatusVariant(s.githubStatus) === "success"
  ).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <HealthSummary
          label="Operational"
          count={operational}
          total={websites.length}
          color="emerald"
        />
        <HealthSummary
          label="Attention required"
          count={
            websites.filter((s) => getStatusVariant(s.githubStatus) === "failed")
              .length
          }
          total={websites.length}
          color="red"
        />
        <HealthSummary
          label="Syncing"
          count={
            websites.filter(
              (s) => getStatusVariant(s.githubStatus) === "deploying"
            ).length
          }
          total={websites.length}
          color="amber"
        />
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="hv-skeleton h-44 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {websites.map((site) => (
            <HealthCard key={site.id} site={site} />
          ))}
        </div>
      )}
    </div>
  );
}

function HealthSummary({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: "emerald" | "red" | "amber";
}) {
  const colors = {
    emerald: "text-emerald-400 border-emerald-500/20",
    red: "text-red-400 border-red-500/20",
    amber: "text-amber-400 border-amber-500/20",
  };

  return (
    <div className={`hv-card rounded-xl border p-5 ${colors[color]}`}>
      <p className="text-sm font-medium text-[#8b9bb4]">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${colors[color].split(" ")[0]}`}>
        {count}
        <span className="text-lg text-[#6b7d96]"> / {total || "—"}</span>
      </p>
    </div>
  );
}

function HealthCard({ site }: { site: WebsiteStatus }) {
  const variant = getStatusVariant(site.githubStatus);
  const healthLabel =
    variant === "success"
      ? "Operational"
      : variant === "deploying"
        ? "Syncing"
        : variant === "failed"
          ? "Attention Required"
          : "Unknown";

  const healthColor =
    variant === "success"
      ? "text-emerald-400"
      : variant === "deploying"
        ? "text-amber-400"
        : variant === "failed"
          ? "text-red-400"
          : "text-[#8b9bb4]";

  return (
    <div className="hv-card rounded-xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[#f0f4f8]">{site.name}</h3>
          <p className="mt-0.5 font-mono text-sm text-[#60a5fa]">
            {site.domain}
          </p>
        </div>
        <StatusBadge status={site.githubStatus} />
      </div>

      <div className={`mt-4 text-lg font-medium ${healthColor}`}>
        {healthLabel}
      </div>

      <ul className="mt-4 space-y-2 border-t border-[#2a3548] pt-4">
        <HealthRow
          label="Deployment status"
          value={site.githubStatus || "Unknown"}
        />
        <HealthRow label="Health signal" value={getHealthLabel(site.githubStatus)} />
        <HealthRow
          label="Last successful check"
          value={formatDate(site.lastRunAt)}
        />
        <HealthRow
          label="Pipeline state"
          value={
            variant === "success"
              ? "Complete — live"
              : variant === "deploying"
                ? "In progress"
                : variant === "failed"
                  ? "Failed — review required"
                  : "No data"
          }
        />
      </ul>
    </div>
  );
}

function HealthRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between text-sm">
      <span className="text-[#6b7d96]">{label}</span>
      <span className="font-medium text-[#c5d0de]">{value}</span>
    </li>
  );
}
