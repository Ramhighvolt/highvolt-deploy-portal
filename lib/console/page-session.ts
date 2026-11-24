import { notFound, redirect } from "next/navigation";
import { consoleEnabled, loadConsoleConfig, type ConsoleConfig } from "./config.ts";
import { currentOperator, type Operator } from "./session.ts";

/** For pages: the signed-in operator, or a redirect to refresh / sign in. A disabled Console is a plain 404. */
export async function requireOperatorPage(returnTo: string): Promise<{ cfg: ConsoleConfig; operator: Operator }> {
  if (!consoleEnabled()) notFound();
  const cfg = loadConsoleConfig();
  const { operator, stale } = await currentOperator();
  if (!operator) {
    redirect(stale ? `/api/console/session/refresh?next=${encodeURIComponent(returnTo)}` : "/console/login");
  }
  return { cfg, operator };
}
