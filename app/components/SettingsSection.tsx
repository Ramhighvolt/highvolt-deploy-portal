export default function SettingsSection() {
  const config = [
    { label: "GitHub Owner", value: "HighVolt-Analytics" },
    { label: "Deployment Engine", value: "GitHub Actions" },
    { label: "Transport", value: "SSH/SCP" },
    { label: "Refresh Interval", value: "15 seconds" },
    { label: "Environment", value: "Production" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {config.map((item) => (
          <div key={item.label} className="hv-card rounded-xl p-5">
            <p className="text-sm text-[#8b9bb4]">{item.label}</p>
            <p className="mt-2 text-base font-semibold text-[#f0f4f8]">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 p-5">
        <div className="flex items-start gap-3">
          <WarningIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <p className="font-medium text-amber-200">Production controls active</p>
            <p className="mt-1 text-sm leading-relaxed text-amber-200/70">
              Authentication should be enabled before public deployment. This
              console currently operates without access controls.
            </p>
          </div>
        </div>
      </div>

      <div className="hv-panel-light rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[#f0f4f8]">Website source</h3>
        <p className="mt-2 text-sm text-[#8b9bb4]">
          Production properties are defined in{" "}
          <code className="rounded bg-[#1c2535] px-2 py-0.5 font-mono text-[#60a5fa]">
            lib/websites.ts
          </code>
          . Status is fetched from GitHub Actions on each sync cycle.
        </p>
      </div>
    </div>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}
