import { redirect } from "next/navigation";
import { currentOperator } from "@/lib/console/session";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function ConsoleLoginPage() {
  const { operator } = await currentOperator();
  if (operator) redirect("/console/clients");
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="hv-card w-full max-w-md rounded-2xl p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#2a3548] bg-[#1c2535]">
            <span className="text-sm font-bold text-[#60a5fa]">HV</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[#f0f4f8]">Platform Console</h1>
            <p className="text-xs text-[#8b9bb4]">Sign in with your operator account</p>
          </div>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
