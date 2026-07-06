import { SUPER_ADMIN_PORTALS } from "@/lib/super-admin-portals";

export default function SuperAdminSection() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[#8b9bb4]">
        {SUPER_ADMIN_PORTALS.length} Super Admin portal · click a card to open
        in a new tab
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {SUPER_ADMIN_PORTALS.map((portal) => (
          <a
            key={portal.id}
            href={portal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hv-card group flex min-h-[96px] items-center gap-4 rounded-xl px-5 py-4"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#2a3548] bg-[#1c2535] transition-transform duration-200 group-hover:scale-105">
              <span className="text-xs font-bold text-[#60a5fa]">SA</span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold leading-snug text-[#f0f4f8]">
                {portal.label}
              </h3>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-[#6b7d96] transition-colors group-hover:text-[#60a5fa]">
                Open Super Admin Portal
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
