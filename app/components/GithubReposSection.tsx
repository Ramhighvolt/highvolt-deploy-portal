import { GITHUB_REPOS } from "@/lib/github-repos";

export default function GithubReposSection() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[#8b9bb4]">
        {GITHUB_REPOS.length} GitHub repositories · click a card to open the
        repo in a new tab
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {GITHUB_REPOS.map((repo) => (
          <a
            key={repo.id}
            href={repo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hv-card group flex min-h-[96px] items-center gap-4 rounded-xl px-5 py-4"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#2a3548] bg-[#1c2535] transition-transform duration-200 group-hover:scale-105">
              <GithubIcon className="h-5 w-5 text-[#f0f4f8]" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold leading-snug text-[#f0f4f8]">
                {repo.label}
              </h3>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-[#6b7d96] transition-colors group-hover:text-[#60a5fa]">
                Open on GitHub
                <ExternalLinkIcon className="h-3.5 w-3.5 shrink-0" />
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
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
