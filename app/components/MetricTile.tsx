type MetricTileProps = {
  label: string;
  value: string | number;
  detail?: string;
  accent?: "default" | "success" | "warning" | "danger" | "info";
};

const accentMap = {
  default: "text-[#f0f4f8]",
  success: "text-emerald-400",
  warning: "text-amber-400",
  danger: "text-red-400",
  info: "text-[#60a5fa]",
};

export default function MetricTile({
  label,
  value,
  detail,
  accent = "default",
}: MetricTileProps) {
  return (
    <div className="hv-card rounded-xl p-5">
      <p className="text-sm font-medium text-[#8b9bb4]">{label}</p>
      <p
        className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums ${accentMap[accent]}`}
      >
        {value}
      </p>
      {detail && (
        <p className="mt-1.5 truncate text-sm text-[#6b7d96]">{detail}</p>
      )}
    </div>
  );
}

export function MetricTileSkeleton() {
  return (
    <div className="hv-skeleton rounded-xl p-5">
      <div className="h-4 w-24 rounded bg-[#2a3548]/60" />
      <div className="mt-3 h-9 w-14 rounded bg-[#2a3548]/80" />
      <div className="mt-2 h-3 w-32 rounded bg-[#2a3548]/40" />
    </div>
  );
}
