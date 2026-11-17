"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  QBO_COMPANY,
  QBO_DOWNLOAD_WORKFLOW,
  QBO_LOGIN_WORKFLOW,
  QBO_REPORTS,
  QBO_RUNNER_OFFLINE_MS,
  type RunSummary,
} from "@/lib/automation-catalog";
import { RunDetailPanel, RunList } from "./RunsPanel";
import { Field, Spinner, Toast, api, inputCls, postJson, useLiveRuns, useNow } from "./shared";

function describeRun(run: RunSummary) {
  if (run.workflowFile === QBO_LOGIN_WORKFLOW)
    return { title: "QuickBooks · Login link" };
  // Workflow titles look like "[QuickBooks] UI · self-hosted · Both".
  const reportId = run.title.split(" · ").pop();
  const report = QBO_REPORTS.find((r) => r.id === reportId);
  return {
    title: `QuickBooks · ${report ? report.label : "Report download"}`,
    subtitle: run.event === "schedule" ? "Scheduled daily 07:05 IST" : undefined,
  };
}

export default function QuickBooksRunner() {
  const { runs, error, loading, lastSync, boost } = useLiveRuns("quickbooks");
  const [reportId, setReportId] = useState<string>("Both");
  const [headed, setHeaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [launchedAt, setLaunchedAt] = useState<number | undefined>();
  const [awaiting, setAwaiting] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  const report = QBO_REPORTS.find((r) => r.id === reportId) ?? QBO_REPORTS[0];

  // Runs wait for the office PC's self-hosted runner. If one stays queued, say so.
  const queued = runs.filter((r) => r.status === "queued" && r.workflowFile === QBO_DOWNLOAD_WORKFLOW);
  const now = useNow(queued.length > 0);
  const stuck = queued.find((r) => now - +new Date(r.createdAt) > QBO_RUNNER_OFFLINE_MS);

  const autoRun =
    awaiting && launchedAt
      ? runs.find((r) => r.workflowFile === QBO_DOWNLOAD_WORKFLOW && +new Date(r.createdAt) >= launchedAt - 5000)
      : undefined;
  const current = selected ?? autoRun?.id ?? null;

  const run = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const startedAt = Date.now();
      await postJson("/api/automation/dispatch", {
        suite: "quickbooks",
        action: "download",
        report: reportId,
        headed,
      });
      setLaunchedAt(startedAt);
      setSelected(null);
      setAwaiting(true);
      setMessage({ tone: "success", text: `${report.label} started. Follow it live on the right.` });
      boost();
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Could not start the run" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <div className="space-y-4">
        <section className="hv-panel rounded-xl p-5">
          <h3 className="text-base font-semibold text-[#f0f4f8]">Download QuickBooks report</h3>
          <p className="mt-1 text-xs text-[#8b9bb4]">
            Read-only. Nothing is created or changed in QuickBooks.
          </p>

          <div className="mt-5 space-y-4">
            <div className="rounded-lg border border-[#2a3548] bg-[#0d1219] px-3.5 py-2.5">
              <span className="sys-label block">Company</span>
              <p className="mt-0.5 text-sm text-[#e8ecf1]">{QBO_COMPANY}</p>
            </div>

            <Field label="Report" hint={report.detail}>
              <select value={reportId} onChange={(e) => setReportId(e.target.value)} className={inputCls}>
                {QBO_REPORTS.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </Field>

            <p className="text-xs text-[#6b7d96]">
              Always this financial year to date (1 April to today).
            </p>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#2a3548] bg-[#0d1219] px-3.5 py-3">
              <input
                type="checkbox"
                checked={headed}
                onChange={(e) => setHeaded(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-blue-500"
              />
              <span className="text-sm text-[#c5d0de]">
                Show browser on the runner PC
                <span className="block text-xs text-[#6b7d96]">
                  Only for the first sign-in or when Intuit asks for MFA again. Someone must be at
                  the runner PC. Leave off for normal daily runs.
                </span>
              </span>
            </label>

            {headed && (
              <Toast tone="info">
                A browser window will open on the office PC. Complete the Intuit MFA there.
              </Toast>
            )}
            {message && <Toast tone={message.tone} onClose={() => setMessage(null)}>{message.text}</Toast>}
            {stuck && (
              <Toast tone="error">
                QuickBooks runner is offline. Ask IT to start the GitHub Actions runner on the office
                PC. This run will start by itself once it is back.
              </Toast>
            )}

            <button
              type="button"
              onClick={run}
              disabled={busy}
              className="btn-hv-primary flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <><Spinner /> Starting…</> : `Download ${report.label}`}
            </button>
            <p className="text-center text-[11px] text-[#6b7d96]">
              Files are also copied to OneDrive: QuickBooks Reports / {QBO_COMPANY}
            </p>

            <div className="rounded-lg border border-[#2a3548] bg-[#0d1219]">
              <button
                type="button"
                onClick={() => setShowAdmin((v) => !v)}
                aria-expanded={showAdmin}
                className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm text-[#c5d0de]"
              >
                <span>API login link <span className="text-[#6b7d96]">· admin only</span></span>
                <span className="text-[#6b7d96]">{showAdmin ? "−" : "+"}</span>
              </button>
              {showAdmin && (
                <div className="border-t border-[#2a3548] p-3.5">
                  <LoginLink onLaunched={boost} />
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <div className="min-w-0 space-y-4">
        <RunList
          runs={runs}
          loading={loading}
          error={error}
          lastSync={lastSync}
          selectedId={current}
          onSelect={setSelected}
          describe={describeRun}
          launchedAfter={launchedAt}
        />
        {current && <RunDetailPanel key={current} suite="quickbooks" runId={current} describe={describeRun} />}
      </div>
    </div>
  );
}

/* --------------------------- Login link flow --------------------------- */

function LoginLink({ onLaunched }: { onLaunched: () => void }) {
  const [state, setState] = useState<"idle" | "working" | "ready" | "error">("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const token = useRef(0);

  useEffect(() => {
    const t = token;
    return () => {
      t.current++;
    };
  }, []);

  const generate = useCallback(async () => {
    const mine = ++token.current;
    const cancelled = () => token.current !== mine;
    setState("working");
    setErr(null);
    try {
      const startedAt = Date.now();
      await postJson("/api/automation/dispatch", { suite: "quickbooks", action: "login" });
      onLaunched();
      const deadline = Date.now() + 3 * 60_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 3500));
        if (cancelled()) return;
        const list = await api<{ runs: RunSummary[] }>(
          `/api/automation/runs?suite=quickbooks&workflow=${QBO_LOGIN_WORKFLOW}`,
        );
        const found = list.runs.find((r) => +new Date(r.createdAt) >= startedAt - 5000);
        if (!found || found.status !== "completed") continue;
        if (found.conclusion !== "success") throw new Error("The login-link run failed. Check it in the run list.");
        const res = await api<{ url: string }>(`/api/automation/quickbooks/login-url?runId=${found.id}`);
        if (cancelled()) return;
        setUrl(res.url);
        setState("ready");
        return;
      }
      throw new Error("Timed out waiting for the login link.");
    } catch (e) {
      if (cancelled()) return;
      setErr(e instanceof Error ? e.message : "Could not get the login link");
      setState("error");
    }
  }, [onLaunched]);

  return (
    <div className="space-y-2.5">
      <p className="text-xs text-[#8b9bb4]">
        Only needed to reconnect the QuickBooks API. Everyday downloads don&apos;t use it.
      </p>
      <ol className="list-decimal space-y-1 pl-4 text-xs text-[#8b9bb4]">
        <li>Generate the link.</li>
        <li>Open it, sign in to Intuit (2FA) and choose <em>Connect</em>.</li>
        <li>Copy the <code className="text-[#c5d0de]">code=</code> value from the address bar.</li>
      </ol>
      {state === "ready" && url ? (
        <div className="flex flex-wrap gap-2">
          <a href={url} target="_blank" rel="noopener noreferrer" className="btn-hv-primary rounded-md px-3 py-1.5 text-xs font-semibold">
            Open Intuit login ↗
          </a>
          <button type="button" onClick={() => void navigator.clipboard?.writeText(url)} className="btn-hv-secondary rounded-md px-3 py-1.5 text-xs font-medium">
            Copy link
          </button>
        </div>
      ) : (
        <button type="button" onClick={generate} disabled={state === "working"} className="btn-hv-secondary flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-60">
          {state === "working" ? <><Spinner className="h-3.5 w-3.5" /> Generating link…</> : "Generate login link"}
        </button>
      )}
      {err && <Toast tone="error">{err}</Toast>}
    </div>
  );
}
