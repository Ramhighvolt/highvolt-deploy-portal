import {
  getStatusBadgeClasses,
  getStatusDotClasses,
  getStatusLabel,
  type DeploymentStatus,
} from "@/lib/status";

type StatusBadgeProps = {
  status?: DeploymentStatus;
  showDot?: boolean;
};

export default function StatusBadge({
  status,
  showDot = true,
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${getStatusBadgeClasses(status)}`}
    >
      {showDot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${getStatusDotClasses(status)}`}
        />
      )}
      {getStatusLabel(status)}
    </span>
  );
}
