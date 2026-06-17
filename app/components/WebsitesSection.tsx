import WebsiteCard from "./WebsiteCard";
import type { SectionBaseProps } from "./OverviewSection";

export default function WebsitesSection({
  websites,
  loading,
  isRefreshing,
  onRefresh,
}: SectionBaseProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-[#8b9bb4]">
          {websites.length} production properties configured
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="btn-hv-secondary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {isRefreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {loading ? (
        <div className="grid gap-5 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="hv-skeleton h-96 rounded-xl" />
          ))}
        </div>
      ) : websites.length === 0 ? (
        <div className="hv-panel rounded-xl px-8 py-16 text-center">
          <p className="text-lg font-medium text-[#c5d0de]">
            No websites configured
          </p>
          <p className="mt-2 text-sm text-[#8b9bb4]">
            Add properties to{" "}
            <code className="rounded bg-[#1c2535] px-2 py-0.5 font-mono text-[#60a5fa]">
              lib/websites.ts
            </code>
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {websites.map((site) => (
            <WebsiteCard key={site.id} website={site} variant="full" />
          ))}
        </div>
      )}
    </div>
  );
}
