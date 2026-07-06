import ClarityLogo from "./ClarityLogo";
import { CLARITY_PROJECTS } from "@/lib/clarity-projects";

export default function ClaritySection() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[#8b9bb4]">
        {CLARITY_PROJECTS.length} Clarity properties · click a card to open its
        dashboard
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {CLARITY_PROJECTS.map((project) => (
          <a
            key={project.id}
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hv-card group flex min-h-[96px] items-center gap-4 rounded-xl px-5 py-4"
          >
            <ClarityLogo className="h-10 w-10 shrink-0 transition-transform duration-200 group-hover:scale-105" />
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold leading-snug text-[#f0f4f8]">
                {project.label}
              </h3>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-[#6b7d96] transition-colors group-hover:text-[#60a5fa]">
                Open in Clarity
                <ExternalLinkIcon className="h-3.5 w-3.5 shrink-0" />
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
      />
    </svg>
  );
}
