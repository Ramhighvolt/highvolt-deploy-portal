"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  XERO_REPORTS,
  XERO_TENANTS,
  isValidIsoDate,
  type RunSummary,
  type XeroTenantId,
} from "@/lib/automation-catalog";
import { RunDetailPanel, RunList } from "./RunsPanel";
import {
  Field,
  Segmented,
  Spinner,
  Toast,
  api,
  inputCls,
  postJson,
  useLiveRuns,
} from "./shared";

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function presets() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const q = Math.floor(m / 3);
  return [
    { id: "mtd", label: "This month", from: iso(new Date(y, m, 1)), to: iso(now) },
    { id: "last-month", label: "Last month", from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) },
    { id: "last-quarter", label: "Last quarter", from: iso(new Date(y, (q - 1) * 3, 1)), to: iso(new Date(y, q * 3, 0)) },
    { id: "ytd", label: "Year to date", from: iso(new Date(y, 0, 1)), to: iso(now) },
    { id: "last-year", label: "Last year", from: iso(new Date(y - 1, 0, 1)), to: iso(new Date(y - 1, 11, 31)) },
  ];
}

const tenantOf = (workflow: string) =>
  XERO_TENANTS.find((t) => t.downloadWorkflow === workflow || t.loginWorkflow === workflow);

function describeRun(run: RunSummary) {
  const tenant = tenantOf(run.workflowFile);
  const isLogin = run.workflowFile === tenant?.loginWorkflow;
  // Download runs are titled "<Tenant> · <ReportId> · <from> to <to>" by the workflow.
  const parts = run.title.split(" · ");
  const report = XERO_REPORTS.find((r) => r.id === parts[1]);
  if (!isLogin && parts.length === 3 && report) {
    return {
      title: `${tenant?.label ?? parts[0]} · ${report.label}`,
      subtitle: run.event === "schedule" ? "Scheduled daily · month to date" : parts[2],
    };
  }
  return {
    title: `${tenant?.label ?? "Xero"} · ${isLogin ? "Login link" : "Report download"}`,
    subtitle: run.event === "schedule" ? "Scheduled daily 07:00 IST" : undefined,
  };
}

export default function XeroRunner() {
  const { runs, error, loading, lastSync, boost } = useLiveRuns("xero");
  const [tenant, setTenant] = useState<XeroTenantId>("pactify");
  const [reportId, setReportId] = useState("ProfitAndLoss");
  const initial = useMemo(() => presets()[1], []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [code, setCode] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [launchedAt, setLaunchedAt] = useState<number | undefined>();
  const [awaiting, setAwaiting] = useState(false);

  const report = XERO_REPORTS.find((r) => r.id === reportId)!;
  const tenantCfg = XERO_TENANTS.find((t) => t.id === tenant)!;
  const asAt = report.kind === "as-at";

  const validation = useMemo(() => {
    if (!isValidIsoDate(to)) return "Pick a valid end date (2018–2030).";
    if (!asAt) {
      if (!isValidIsoDate(from)) return "Pick a valid start date (2018–2030).";
      if (from > to) return "Start date must be on or before the end date.";
    }
    if (code.trim() && !/^[A-Za-z0-9_-]{8,200}$/.test(code.trim()))
      return "That doesn't look like an authorization code. Paste only what's after code= and before &.";
    return null;
  }, [from, to, asAt, code]);

  // Follow the newly created run automatically (derived, no effect).
  const autoRun =
    awaiting && launchedAt
      ? runs.find((r) => r.workflowFile === tenantCfg.downloadWorkflow && +new Date(r.createdAt) >= launchedAt - 5000)
      : undefined;
  const current = selected ?? autoRun?.id ?? null;

  const run = async () => {
    if (validation) return;
    setBusy(true);
    setMessage(null);
    try {
      const startedAt = Date.now();
      await postJson("/api/automation/dispatch", {
        suite: "xero",
        action: "download",
        tenant,
        report: reportId,
        fromDate: asAt ? to : from,
        toDate: to,
        authorizationCode: code.trim(),
      });
      setCode("");
      setLaunchedAt(startedAt);
      setSelected(null);
      setAwaiting(true);
      setMessage({ tone: "success", text: `${tenantCfg.label} ${report.label} started. Follow it live on the right.` });
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
          <h3 className="text-base font-semibold text-[#f0f4f8]">Download Xero report</h3>
          <p className="mt-1 text-xs text-[#8b9bb4]">
            Read-only. Nothing is created or changed in Xero.
          </p>

          <div className="mt-5 space-y-4">
            <Field label="Tenant">
              <Segmented
                label="Tenant"
                value={tenant}
                onChange={setTenant}
                options={XERO_TENANTS.map((t) => ({ id: t.id, label: t.label }))}
              />
            </Field>

            <Field label="Report">
              <select value={reportId} onChange={(e) => setReportId(e.target.value)} className={inputCls}>
                {XERO_REPORTS.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </Field>

            {report.needsContact && (
              <Toast tone="info">
                Needs the tenant&apos;s contact ID to be set as a repository secret in GitHub.
              </Toast>
            )}

            <div>
              <span className="sys-label mb-1.5 block">Period</span>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {presets().map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setFrom(p.from);
                      setTo(p.to);
                    }}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                      from === p.from && to === p.to
                        ? "border-blue-500/40 bg-blue-500/15 text-blue-200"
                        : "btn-hv-secondary"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className={`grid gap-3 ${asAt ? "" : "grid-cols-2"}`}>
                {!asAt && (
                  <Field label="From">
                    <input type="date" value={from} min="2018-01-01" max="2030-12-31" onChange={(e) => setFrom(e.target.value)} className={inputCls} />
                  </Field>
                )}
                <Field label={asAt ? "As at" : "To"} hint={asAt ? "This report is a snapshot on a single date." : undefined}>
                  <input type="date" value={to} min="2018-01-01" max="2030-12-31" onChange={(e) => setTo(e.target.value)} className={inputCls} />
                </Field>
              </div>
            </div>

            <div className="rounded-lg border border-[#2a3548] bg-[#0d1219]">
              <button
                type="button"
                onClick={() => setShowAuth((v) => !v)}
                aria-expanded={showAuth}
                className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm text-[#c5d0de]"
              >
                <span>Xero login <span className="text-[#6b7d96]">· only if the saved login expired</span></span>
                <span className="text-[#6b7d96]">{showAuth ? "−" : "+"}</span>
              </button>
              {showAuth && (
                <div className="space-y-3 border-t border-[#2a3548] p-3.5">
                  <LoginLink key={tenant} tenant={tenant} onLaunched={boost} />
                  <Field label="Authorization code" hint="Paste the value after code= and before &. Leave empty to reuse the saved login.">
                    <input
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="Leave blank normally"
                      className={inputCls}
                    />
                  </Field>
                </div>
              )}
            </div>

            {validation && <p className="text-xs text-amber-300">{validation}</p>}
            {message && <Toast tone={message.tone} onClose={() => setMessage(null)}>{message.text}</Toast>}

            <button
              type="button"
              onClick={run}
              disabled={busy || !!validation}
              className="btn-hv-primary flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <><Spinner /> Starting…</> : `Download ${report.label}`}
            </button>
            <p className="text-center text-[11px] text-[#6b7d96]">
              Files are also copied to OneDrive: {tenantCfg.oneDrive}
            </p>
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
        {current && <RunDetailPanel key={current} suite="xero" runId={current} describe={describeRun} />}
      </div>
    </div>
  );
}

/* --------------------------- Login link flow --------------------------- */

function LoginLink({ tenant, onLaunched }: { tenant: XeroTenantId; onLaunched: () => void }) {
  const cfg = XERO_TENANTS.find((t) => t.id === tenant)!;
  const [state, setState] = useState<"idle" | "working" | "ready" | "error">("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const token = useRef(0);

  // Parent remounts this component per tenant; stop polling on unmount.
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
      await postJson("/api/automation/dispatch", { suite: "xero", action: "login", tenant });
      onLaunched();
      const deadline = Date.now() + 3 * 60_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 3500));
        if (cancelled()) return;
        const list = await api<{ runs: RunSummary[] }>(
          `/api/automation/runs?suite=xero&workflow=${cfg.loginWorkflow}`,
        );
        const run = list.runs.find((r) => +new Date(r.createdAt) >= startedAt - 5000);
        if (!run || run.status !== "completed") continue;
        if (run.conclusion !== "success") throw new Error("The login-link run failed. Check it in the run list.");
        const res = await api<{ url: string }>(`/api/automation/xero/login-url?tenant=${tenant}&runId=${run.id}`);
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
  }, [tenant, cfg.loginWorkflow, onLaunched]);

  return (
    <div className="space-y-2.5">
      <ol className="list-decimal space-y-1 pl-4 text-xs text-[#8b9bb4]">
        <li>Generate a link for <span className="text-[#c5d0de]">{cfg.label}</span>.</li>
        <li>Open it, sign in to Xero (2FA), choose companies, <em>Allow</em>.</li>
        <li>The browser may say &ldquo;connection refused&rdquo;. That&apos;s expected. Copy the text after <code className="text-[#c5d0de]">code=</code>.</li>
      </ol>
      {state === "ready" && url ? (
        <div className="flex flex-wrap gap-2">
          <a href={url} target="_blank" rel="noopener noreferrer" className="btn-hv-primary rounded-md px-3 py-1.5 text-xs font-semibold">
            Open Xero login ↗
          </a>
          <button type="button" onClick={() => void navigator.clipboard?.writeText(url)} className="btn-hv-secondary rounded-md px-3 py-1.5 text-xs font-medium">
            Copy link
          </button>
        </div>
      ) : (
        <button type="button" onClick={generate} disabled={state === "working"} className="btn-hv-secondary flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-60">
          {state === "working" ? <><Spinner className="h-3.5 w-3.5" /> Generating link…</> : "Get login link"}
        </button>
      )}
      {err && <Toast tone="error">{err}</Toast>}
    </div>
  );
}
