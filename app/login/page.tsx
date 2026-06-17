import { signInWithMicrosoft } from "@/app/actions/auth";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, callbackUrl } = await searchParams;

  return (
    <div className="deploy-os-bg flex min-h-screen items-center justify-center px-4">
      <div className="hv-panel w-full max-w-md rounded-2xl p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#2a3548] bg-[#1c2535]">
            <span className="text-sm font-bold text-[#60a5fa]">HV</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#f0f4f8]">
            HighVolt Deploy OS
          </h1>
          <p className="mt-2 text-sm text-[#8b9bb4]">
            Sign in with your HighVolt Microsoft account to access the
            deployment console.
          </p>
        </div>

        {error === "AccessDenied" && (
          <div className="mb-6 rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            Your account is not authorized for this portal. Contact an
            administrator if you need access.
          </div>
        )}

        <form action={signInWithMicrosoft.bind(null, callbackUrl)}>
          <button
            type="submit"
            className="btn-hv-primary flex w-full items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold"
          >
            <MicrosoftIcon className="h-5 w-5" />
            Sign in with Microsoft
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[#6b7d96]">
          Production deployment controls · Authorized users only
        </p>
      </div>
    </div>
  );
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 23 23" fill="currentColor">
      <path d="M0 0h11v11H0zM12 0h11v11H12zM0 12h11v11H0zM12 12h11v11H12z" />
    </svg>
  );
}
