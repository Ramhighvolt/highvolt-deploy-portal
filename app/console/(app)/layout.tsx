import Link from "next/link";
import { requireOperatorPage } from "@/lib/console/page-session";
import ConsoleSignOut from "./ConsoleSignOut";

export const dynamic = "force-dynamic";

const NAV = [{ href: "/console/clients", label: "Clients" }];

export default async function ConsoleShell({ children }: { children: React.ReactNode }) {
  const { cfg, operator } = await requireOperatorPage("/console/clients");
  return (
    <div className="min-h-screen lg:pl-[260px]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r border-[#2a3548] bg-[#0d1219]/95 lg:flex">
        <div className="border-b border-[#2a3548] px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#2a3548] bg-[#1c2535]">
              <span className="text-sm font-bold text-[#60a5fa]">QQ</span>
            </div>
            <div>
              <p className="text-base font-semibold tracking-tight text-[#f0f4f8]">Quantum Quber</p>
              <p className="text-xs font-medium text-[#60a5fa]">Platform Console</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Console">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="block rounded-lg px-3 py-2 text-sm font-medium text-[#f0f4f8] hover:bg-[#1c2535]">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-[#2a3548] px-5 py-4 text-xs text-[#8b9bb4]">
          <p className="mb-2">
            Role: <span className="font-semibold text-[#f0f4f8]">{operator.claims.role.replace(/_/g, " ")}</span>
          </p>
          <p className="mb-3 truncate">Product: {cfg.appId}</p>
          <ConsoleSignOut />
        </div>
      </aside>
      <div className="px-4 py-6 lg:px-8">{children}</div>
    </div>
  );
}
