import { websites } from "@/lib/websites";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">
            HighVolt Internal System
          </p>
          <h1 className="mt-3 text-4xl font-bold">
            Deployment Portal
          </h1>
          <p className="mt-3 max-w-2xl text-slate-400">
            Monitor and manage live website deployments for HighVolt and Quantum platforms.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-400">Total Websites</p>
            <p className="mt-2 text-3xl font-bold">4</p>
          </div>

          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
            <p className="text-sm text-slate-400">Live</p>
            <p className="mt-2 text-3xl font-bold text-emerald-400">4</p>
          </div>

          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-5">
            <p className="text-sm text-slate-400">Deploying</p>
            <p className="mt-2 text-3xl font-bold text-yellow-400">0</p>
          </div>

          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5">
            <p className="text-sm text-slate-400">Failed</p>
            <p className="mt-2 text-3xl font-bold text-red-400">0</p>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Websites</h2>
              <p className="text-sm text-slate-400">
                Production deployment status
              </p>
            </div>
            <button className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-400">
              Refresh Status
            </button>
          </div>

          <div className="grid gap-4">
            {websites.map((site) => (
              <div
                key={site.domain}
                className="rounded-2xl border border-white/10 bg-slate-900/70 p-5"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-3 rounded-full bg-emerald-400" />
                      <h3 className="text-xl font-semibold">{site.name}</h3>
                    </div>
                    <p className="mt-2 text-slate-400">{site.domain}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Repo: {site.repo}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <span className="rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400">
                      {site.status}
                    </span>

                    <span className="rounded-full bg-white/10 px-4 py-2 text-sm text-slate-300">
                      Last deploy: {site.lastDeploy}
                    </span>

                    <a
                      href={`https://${site.domain}`}
                      target="_blank"
                      className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
                    >
                      Open Site
                    </a>

                    <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-200">
                      Deploy Now
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}