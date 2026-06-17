import { getPipelineSteps, type DeploymentStatus } from "@/lib/status";

type DeploymentPipelineProps = {
  status?: DeploymentStatus;
  compact?: boolean;
};

function stepStyles(state: "complete" | "active" | "failed" | "pending") {
  switch (state) {
    case "complete":
      return "border-[#3b82f6]/35 bg-[#3b82f6]/10 text-[#93c5fd]";
    case "active":
      return "border-amber-500/35 bg-amber-500/10 text-amber-400 pipeline-active";
    case "failed":
      return "border-red-500/35 bg-red-500/10 text-red-400";
    default:
      return "border-[#2a3548] bg-transparent text-[#5a6a7f]";
  }
}

export default function DeploymentPipeline({
  status,
  compact = false,
}: DeploymentPipelineProps) {
  const steps = getPipelineSteps(status);

  return (
    <div>
      {!compact && (
        <p className="mb-2 text-xs font-medium text-[#6b7d96]">
          Deployment pipeline
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1">
        {steps.map((step, index) => (
          <div key={step.label} className="flex items-center">
            <div
              className={`rounded-md border px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-wide ${stepStyles(step.state)}`}
            >
              {step.label}
            </div>
            {index < steps.length - 1 && (
              <span className="mx-0.5 text-[#3d4f6a]">→</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
