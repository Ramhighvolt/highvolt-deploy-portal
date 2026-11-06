"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  isRunActive,
  runOutcome,
  type ArtifactFile,
  type ArtifactInfo,
  type RunDetail,
  type RunSummary,
  type SuiteId,
} from "@/lib/automation-catalog";
import {
  RunStatusPill,
  Spinner,
  Toast,
  api,
  formatBytes,
  formatDuration,
  postJson,
  runElapsed,
  timeAgo,
  useNow,
} from "./shared";

/* ----------------------------- Run list ----------------------------- */

export function RunList({
  runs,
  loading,
  error,
  lastSync,
  selectedId,
  onSelect,
  describe,
  launchedAfter,
}: {
  runs: RunSummary[];
  loading: boolean;
  error: string | null;
  lastSync: Date | null;
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** Friendly name for a run (tenant / environment etc.). */
  describe: (run: RunSummary) => { title: string; subtitle?: string };
  launchedAfter?: number;
}) {
  const active = runs.filter(isRunActive).length;
  const now = useNow(active > 0);

  return (
    <section className="hv-panel rounded-xl">
      <header className="flex items-center justify-between gap-3 border-b border-[#2a3548] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <h3 className="text-sm font-semibold text-[#f0f4f8]">Live runs</h3>
          {active > 0 && (
            <span className="hv-badge text-blue-300">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 pipeline-active" />
              {active} active
            </span>
          )}
        </div>
        <span className="sys-label">
          {error ? "Sync error" : lastSync ? `Synced ${timeAgo(lastSync.toISOString(), now)}` : "Syncing…"}
        </span>
      </header>

      {error && (
        <div className="p-3">
          <Toast tone="error">{error}</Toast>
        </div>
      )}

      {loading && runs.length === 0 ? (
        <div className="space-y-2 p-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="hv-skeleton h-14 rounded-lg" />
          ))}
        </div>
      ) : runs.length === 0 && !error ? (
        <p className="p-6 text-center text-sm text-[#6b7d96]">
          No runs yet. Start one from the form.
        </p>
      ) : (
        <ul className="max-h-[360px] divide-y divide-[#2a3548]/60 overflow-y-auto">
          {runs.map((run) => {
            const d = describe(run);
            const isNew = launchedAfter !== undefined && +new Date(run.createdAt) >= launchedAfter - 5000;
            return (
              <li key={run.id}>
                <button
                  type="button"
                  onClick={() => onSelect(run.id)}
                  aria-current={selectedId === run.id}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                    selectedId === run.id ? "bg-[#3b82f6]/10" : "hover:bg-white/[0.03]"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#f0f4f8]">
                      {d.title}
                      {isNew && (
                        <span className="ml-2 rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-blue-300">
                          new
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[#6b7d96]">
                      #{run.runNumber} · {d.subtitle ? `${d.subtitle} · ` : ""}
                      {timeAgo(run.createdAt, now)}
                      {run.actor ? ` · ${run.actor}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <RunStatusPill run={run} />
                    <span className="font-mono text-[11px] text-[#6b7d96]">
                      {formatDuration(runElapsed(run, now))}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ---------------------------- Run detail ---------------------------- */

const STEP_ICON: Record<string, string> = {
  success: "text-emerald-400",
  failure: "text-red-400",
  skipped: "text-[#4b5b73]",
  cancelled: "text-[#6b7d96]",
};

export function RunDetailPanel({
  suite,
  runId,
  describe,
  onChanged,
}: {
  suite: SuiteId;
  runId: number;
  describe: (run: RunSummary) => { title: string; subtitle?: string };
  onChanged?: () => void;
}) {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const active = run ? isRunActive(run) : true;
  const now = useNow(active);

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    const load = async () => {
      try {
        const data = await api<{ run: RunDetail }>(`/api/automation/runs/${runId}?suite=${suite}`);
        if (stopped) return;
        setRun(data.run);
        setError(null);
        if (isRunActive(data.run)) timer = window.setTimeout(load, 4000);
        else onChanged?.();
      } catch (e) {
        if (stopped) return;
        setError(e instanceof Error ? e.message : "Could not load run");
        timer = window.setTimeout(load, 8000);
      }
    };
    void load();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suite, runId]);

  const cancel = async () => {
    setCancelling(true);
    try {
      await postJson(`/api/automation/runs/${runId}/cancel?suite=${suite}`, {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setCancelling(false);
    }
  };

  const progress = useMemo(() => {
    const steps = run?.jobs.flatMap((j) => j.steps) ?? [];
    if (steps.length === 0) return 0;
    return Math.round((steps.filter((s) => s.status === "completed").length / steps.length) * 100);
  }, [run]);

  if (!run) {
    return (
      <section className="hv-panel rounded-xl p-4">
        {error ? <Toast tone="error">{error}</Toast> : <div className="hv-skeleton h-24 rounded-lg" />}
      </section>
    );
  }

  const d = describe(run);
  const outcome = runOutcome(run);

  return (
    <section className="hv-panel rounded-xl">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#2a3548] px-4 py-3.5">
        <div className="min-w-0">
          <p className="sys-label">Run #{run.runNumber}</p>
          <h3 className="mt-0.5 truncate text-base font-semibold text-[#f0f4f8]">{d.title}</h3>
          {d.subtitle && <p className="mt-0.5 text-xs text-[#8b9bb4]">{d.subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <RunStatusPill run={run} />
          {active && (
            <button type="button" onClick={cancel} disabled={cancelling} className="btn-hv-secondary rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-50">
              {cancelling ? "Cancelling…" : "Cancel"}
            </button>
          )}
          <a href={run.htmlUrl} target="_blank" rel="noopener noreferrer" className="btn-hv-secondary rounded-md px-2.5 py-1 text-xs font-medium">
            GitHub ↗
          </a>
        </div>
      </header>

      <div className="space-y-4 p-4">
        {error && <Toast tone="error">{error}</Toast>}

        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs text-[#8b9bb4]">
            <span>{active ? "In progress" : outcome === "success" ? "Completed successfully" : outcome === "cancelled" ? "Cancelled" : "Finished with errors"}</span>
            <span className="font-mono">{formatDuration(runElapsed(run, now))}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#1c2535]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                outcome === "failed" ? "bg-red-500" : outcome === "success" ? "bg-emerald-500" : "bg-blue-500"
              }`}
              style={{ width: `${active ? Math.max(progress, 4) : 100}%` }}
            />
          </div>
        </div>

        {run.jobs.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-[#8b9bb4]">
            <Spinner /> Waiting for a GitHub runner to pick this up…
          </p>
        ) : (
          run.jobs.map((job) => (
            <div key={job.id}>
              <p className="mb-2 text-xs font-semibold text-[#c5d0de]">{job.name}</p>
              <ol className="space-y-1">
                {job.steps.map((step) => (
                  <li key={step.number} className="flex items-center gap-2.5 text-sm">
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center ${STEP_ICON[step.conclusion ?? ""] ?? "text-[#6b7d96]"}`}>
                      {step.status === "in_progress" ? (
                        <Spinner className="h-3.5 w-3.5 text-blue-400" />
                      ) : step.conclusion === "success" ? (
                        "✓"
                      ) : step.conclusion === "failure" ? (
                        "✕"
                      ) : step.conclusion === "skipped" ? (
                        "–"
                      ) : (
                        "○"
                      )}
                    </span>
                    <span className={step.status === "in_progress" ? "text-[#f0f4f8]" : step.conclusion === "skipped" ? "text-[#4b5b73]" : "text-[#8b9bb4]"}>
                      {step.name}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))
        )}

        {!active && <ResultsPanel key={run.id} suite={suite} runId={run.id} />}
      </div>
    </section>
  );
}

/* ------------------------------ Results ------------------------------ */

type Sheet = {
  sheet: string;
  rows: (string | number | null)[][];
  totalRows: number;
  truncated: boolean;
};

function dl(runId: number, suite: SuiteId, f: ArtifactFile, format = "original") {
  const qs = new URLSearchParams({
    suite,
    artifactId: String(f.artifactId),
    path: f.path,
    format,
  });
  return `/api/automation/runs/${runId}/download?${qs}`;
}

export function ResultsPanel({ suite, runId }: { suite: SuiteId; runId: number }) {
  const [files, setFiles] = useState<ArtifactFile[] | null>(null);
  const [artifacts, setArtifacts] = useState<ArtifactInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ file: ArtifactFile; sheets?: Sheet[]; error?: string } | null>(null);

  useEffect(() => {
    let stopped = false;
    api<{ files: ArtifactFile[]; artifacts: ArtifactInfo[] }>(`/api/automation/runs/${runId}/files?suite=${suite}`)
      .then((d) => {
        if (stopped) return;
        setFiles(d.files);
        setArtifacts(d.artifacts);
      })
      .catch((e) => !stopped && setError(e instanceof Error ? e.message : "Could not load results"));
    return () => {
      stopped = true;
    };
  }, [suite, runId]);

  const openPreview = useCallback(
    async (file: ArtifactFile) => {
      setPreview({ file });
      try {
        const d = await api<{ sheets: Sheet[] }>(dl(runId, suite, file, "preview"));
        setPreview({ file, sheets: d.sheets });
      } catch (e) {
        setPreview({ file, error: e instanceof Error ? e.message : "Preview failed" });
      }
    },
    [runId, suite],
  );

  if (error) return <Toast tone="error">{error}</Toast>;
  if (!files)
    return (
      <p className="flex items-center gap-2 border-t border-[#2a3548] pt-4 text-sm text-[#8b9bb4]">
        <Spinner /> Loading results…
      </p>
    );

  const usable = artifacts.filter((a) => !a.expired);
  if (files.length === 0)
    return (
      <p className="border-t border-[#2a3548] pt-4 text-sm text-[#6b7d96]">
        {artifacts.some((a) => a.expired) ? "Results have expired (kept for 90 days)." : "This run did not produce any downloadable files."}
      </p>
    );

  const byArtifact = new Map<number, ArtifactFile[]>();
  files.forEach((f) => byArtifact.set(f.artifactId, [...(byArtifact.get(f.artifactId) ?? []), f]));

  return (
    <div className="space-y-3 border-t border-[#2a3548] pt-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[#f0f4f8]">Results</h4>
        <span className="sys-label">{files.length} file{files.length === 1 ? "" : "s"}</span>
      </div>

      {usable.map((artifact) => (
        <div key={artifact.id} className="overflow-hidden rounded-lg border border-[#2a3548]">
          <div className="flex items-center justify-between gap-2 bg-[#1c2535]/60 px-3 py-2">
            <p className="truncate font-mono text-xs text-[#8b9bb4]">{artifact.name}</p>
            <a
              href={`/api/automation/runs/${runId}/download?suite=${suite}&artifactId=${artifact.id}`}
              className="btn-hv-secondary shrink-0 rounded-md px-2 py-1 text-xs font-medium"
            >
              All as .zip
            </a>
          </div>
          <ul className="divide-y divide-[#2a3548]/60">
            {(byArtifact.get(artifact.id) ?? []).map((f) => (
              <li key={f.path} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[#e8ecf1]" title={f.path}>{f.path}</p>
                  <p className="text-[11px] text-[#6b7d96]">{formatBytes(f.size)}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {f.ext === "xlsx" && (
                    <button type="button" onClick={() => openPreview(f)} className="btn-hv-primary rounded-md px-2 py-1 text-xs font-medium">
                      Preview
                    </button>
                  )}
                  <a href={dl(runId, suite, f)} className="btn-hv-secondary rounded-md px-2 py-1 text-xs font-medium">
                    {f.ext === "xlsx" ? "Excel" : f.ext ? `.${f.ext}` : "Download"}
                  </a>
                  {f.ext === "xlsx" && (
                    <>
                      <a href={dl(runId, suite, f, "csv")} className="btn-hv-secondary rounded-md px-2 py-1 text-xs font-medium">CSV</a>
                      <a href={dl(runId, suite, f, "json")} className="btn-hv-secondary rounded-md px-2 py-1 text-xs font-medium">JSON</a>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {preview && <SheetPreview preview={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function fmt(v: string | number | null): string {
  if (v === null || v === "") return "";
  if (typeof v === "number")
    return v < 0
      ? `(${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
      : v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v;
}

function SheetPreview({
  preview,
  onClose,
}: {
  preview: { file: ArtifactFile; sheets?: Sheet[]; error?: string };
  onClose: () => void;
}) {
  const sheet = preview.sheets?.[0];
  return (
    <div className="overflow-hidden rounded-lg border border-[#3d4f6a] bg-[#0d1219]">
      <div className="flex items-center justify-between gap-2 border-b border-[#2a3548] px-3 py-2">
        <p className="truncate text-xs font-medium text-[#c5d0de]">
          Preview · {preview.file.path.split("/").pop()}
        </p>
        <button type="button" onClick={onClose} className="text-xs text-[#8b9bb4] hover:text-white">Close ✕</button>
      </div>
      {preview.error ? (
        <div className="p-3"><Toast tone="error">{preview.error}</Toast></div>
      ) : !sheet ? (
        <p className="flex items-center gap-2 p-4 text-sm text-[#8b9bb4]"><Spinner /> Reading spreadsheet…</p>
      ) : (
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full border-collapse text-xs">
            <tbody>
              {sheet.rows.map((row, i) => (
                <tr key={i} className="border-b border-[#1c2535]">
                  <td className="w-9 select-none bg-[#151c28] px-2 py-1 text-right font-mono text-[10px] text-[#4b5b73]">{i + 1}</td>
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={`whitespace-nowrap px-3 py-1 ${j === 0 ? "text-left text-[#e8ecf1]" : "text-right font-mono text-[#c5d0de]"}`}
                    >
                      {fmt(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {sheet.truncated && (
            <p className="p-2 text-center text-[11px] text-[#6b7d96]">
              Showing first {sheet.rows.length} of {sheet.totalRows} rows. Download for the full file.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
