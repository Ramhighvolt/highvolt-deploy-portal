import { formatDate, getSystemStatus } from "@/lib/status";
import {
  SECTION_DESCRIPTIONS,
  SECTION_TITLES,
  type AppSection,
} from "@/lib/navigation";
import type { WebsiteStatus } from "@/lib/status";

type HeaderProps = {
  activeSection: AppSection;
  lastRefresh: Date | null;
  websites: WebsiteStatus[];
  isRefreshing?: boolean;
};

export default function Header({
  activeSection,
  lastRefresh,
  websites,
  isRefreshing = false,
}: HeaderProps) {
  const systemStatus = getSystemStatus(websites);

  return (
    <header className="sticky top-0 z-30 border-b border-[#2a3548] bg-[#0b0f14]/90 backdrop-blur-md">
      <div className="border-b border-[#2a3548]/60 px-5 py-2.5 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="font-medium text-[#8b9bb4]">Production Network</span>
            <span className="hidden h-4 w-px bg-[#2a3548] sm:block" />
            <Indicator label="GitHub Actions" value="connected" />
            <Indicator label="Hostinger SSH" value="active" />
          </div>
          <div className="flex items-center gap-3">
            {isRefreshing && (
              <span className="text-xs text-[#60a5fa]">Syncing…</span>
            )}
            <span className="hv-badge text-emerald-400">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  systemStatus === "critical"
                    ? "bg-red-500"
                    : systemStatus === "degraded"
                      ? "bg-amber-500 pipeline-active"
                      : "bg-emerald-500"
                }`}
              />
              {systemStatus === "critical"
                ? "Attention"
                : systemStatus === "degraded"
                  ? "Deploying"
                  : "OPS-ONLINE"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div>
          <p className="text-sm font-medium text-[#60a5fa]">
            HighVolt Deploy OS
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-[#f0f4f8]">
            {SECTION_TITLES[activeSection]}
          </h1>
          <p className="mt-1 text-sm text-[#8b9bb4]">
            {SECTION_DESCRIPTIONS[activeSection]}
          </p>
        </div>

        <div className="hv-panel-light flex flex-wrap gap-4 rounded-xl px-5 py-3 text-sm">
          <SyncStat label="Environment" value="Production" />
          <SyncStat label="Sync" value="Every 15s" />
          <SyncStat label="Engine" value="GitHub Actions" />
          <SyncStat label="Transport" value="SSH/SCP" />
          {lastRefresh && (
            <SyncStat
              label="Last sync"
              value={formatDate(lastRefresh)}
              mono
            />
          )}
        </div>
      </div>
    </header>
  );
}

function Indicator({ label, value }: { label: string; value: string }) {
  return (
    <div className="hidden items-center gap-2 sm:flex">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      <span className="text-xs text-[#8b9bb4]">
        {label}{" "}
        <span className="text-[#c5d0de]">{value}</span>
      </span>
    </div>
  );
}

function SyncStat({
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
      <p className="sys-label text-[0.625rem]">{label}</p>
      <p
        className={`mt-0.5 font-medium text-[#e8ecf1] ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
