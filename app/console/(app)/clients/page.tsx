import Link from "next/link";
import { redirect } from "next/navigation";
import { listClients } from "@/lib/console/clients";
import { requireOperatorPage } from "@/lib/console/page-session";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; status?: string; cursor?: string }>;

const STATUS_STYLE: Record<string, string> = {
  active: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  suspended: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  deleted: "border-red-500/40 bg-red-500/10 text-red-300",
};

function one(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

export default async function ClientsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = one(sp.q).slice(0, 100);
  const status = one(sp.status);
  const cursor = one(sp.cursor).slice(0, 200);
  const here = `/console/clients${q || status || cursor ? `?${new URLSearchParams({ ...(q && { q }), ...(status && { status }), ...(cursor && { cursor }) })}` : ""}`;
  const { cfg, operator } = await requireOperatorPage(here);

  const result = await listClients(fetch, cfg, operator.token, { q, status: status || undefined, cursor: cursor || undefined, limit: 25 });
  if (!result.ok && result.upstream === 401) redirect("/api/console/session/refresh?next=/console/clients");

  const nextHref = result.ok && result.nextCursor
    ? `/console/clients?${new URLSearchParams({ ...(q && { q }), ...(status && { status }), cursor: result.nextCursor })}`
    : null;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-[#f0f4f8]">Clients</h1>
        <p className="mt-1 text-sm text-[#8b9bb4]">Every organization that uses {cfg.appId}, with the modules it has today.</p>
      </header>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm text-[#8b9bb4]">
          Search
          <input
            name="q"
            defaultValue={q}
            maxLength={100}
            placeholder="Name or id"
            className="mt-1 block w-64 rounded-lg border border-[#2a3548] bg-[#0f1623] px-3 py-2 text-sm text-[#f0f4f8]"
          />
        </label>
        <label className="text-sm text-[#8b9bb4]">
          Status
          <select name="status" defaultValue={status} className="mt-1 block rounded-lg border border-[#2a3548] bg-[#0f1623] px-3 py-2 text-sm text-[#f0f4f8]">
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="deleted">Deleted</option>
          </select>
        </label>
        <button className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1d4ed8]" type="submit">
          Apply
        </button>
        {q || status ? (
          <Link href="/console/clients" className="px-2 py-2 text-sm text-[#60a5fa] hover:underline">
            Clear
          </Link>
        ) : null}
      </form>

      {!result.ok ? (
        <p role="alert" className="hv-card rounded-xl px-4 py-6 text-sm text-red-300">
          {result.upstream === 403
            ? "Your role cannot view the client directory."
            : "The client directory is unavailable right now. Try again shortly."}
        </p>
      ) : (
        <>
          {!result.entitlementsAvailable ? (
            <p role="status" className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
              Module information is temporarily unavailable. The list below is complete, but modules show as unknown.
            </p>
          ) : null}
          <div className="hv-card overflow-x-auto rounded-xl">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[#2a3548] text-xs uppercase tracking-wide text-[#8b9bb4]">
                <tr>
                  <th className="px-4 py-3">Organization</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Modules</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3 text-right">Members</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-[#8b9bb4]">
                      No clients match.
                    </td>
                  </tr>
                ) : (
                  result.rows.map((c) => (
                    <tr key={c.orgId} className="border-b border-[#1c2535] last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#f0f4f8]">{c.displayName}</p>
                        <p className="font-mono text-xs text-[#8b9bb4]">{c.orgId}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLE[c.status] ?? STATUS_STYLE.active}`}>{c.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        {c.modules === null ? (
                          <span className="text-[#8b9bb4]">unknown</span>
                        ) : c.modules.length === 0 ? (
                          <span className="text-[#8b9bb4]">none</span>
                        ) : (
                          <span className="flex flex-wrap gap-1">
                            {c.modules.map((m) => (
                              <span key={m} className="rounded border border-[#2a3548] bg-[#1c2535] px-1.5 py-0.5 font-mono text-xs text-[#f0f4f8]">
                                {m}
                              </span>
                            ))}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#c5d0e0]">{c.planCode ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#c5d0e0]">{c.memberCount}</td>
                      <td className="px-4 py-3 text-[#c5d0e0]">{c.createdAt ? c.createdAt.slice(0, 10) : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {nextHref ? (
            <div className="mt-4 text-right">
              <Link href={nextHref} className="text-sm font-semibold text-[#60a5fa] hover:underline">
                Next page →
              </Link>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
