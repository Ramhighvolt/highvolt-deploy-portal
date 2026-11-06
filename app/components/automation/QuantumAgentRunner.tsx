"use client";

import { useMemo, useState } from "react";
import {
  QA_ENVIRONMENTS,
  QA_FEATURES,
  QA_MAX_FEATURES_PER_LAUNCH,
  QA_WORKFLOWS,
  type RunSummary,
} from "@/lib/automation-catalog";
import { RunDetailPanel, RunList } from "./RunsPanel";
import { Field, Segmented, Spinner, Toast, inputCls, postJson, useLiveRuns } from "./shared";

const FEATURE_LABEL = new Map(QA_FEATURES.map((f) => [f.id, f.label]));
const ENV_LABEL = new Map<string, string>(QA_ENVIRONMENTS.map((e) => [e.id, e.label]));

/** Run titles are "<Suite> · <feature> · <env>" (set by run-name in the workflow). */
function describeRun(run: RunSummary) {
  const wf = QA_WORKFLOWS.find((w) => w.id === run.workflowFile);
  const parts = run.title.split(" · ");
  if (parts.length === 3 && FEATURE_LABEL.has(parts[1])) {
    return {
      title: FEATURE_LABEL.get(parts[1])!,
      subtitle: `${ENV_LABEL.get(parts[2]) ?? parts[2]} · ${wf?.label ?? parts[0]}${run.event === "schedule" ? " · scheduled" : ""}`,
    };
  }
  return { title: wf?.label ?? run.workflowName, subtitle: run.event === "schedule" ? "Scheduled" : undefined };
}

export default function QuantumAgentRunner() {
  const { runs, error, loading, lastSync, boost } = useLiveRuns("quantum-agent");
  const [environment, setEnvironment] = useState<(typeof QA_ENVIRONMENTS)[number]["id"]>("staging");
  const [workflow, setWorkflow] = useState<string>(QA_WORKFLOWS[0].id);
  const [features, setFeatures] = useState<string[]>(["all"]);
  const [query, setQuery] = useState("");
  const [notifyTeams, setNotifyTeams] = useState(true);
  const [sampleOnly, setSampleOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [launchedAt, setLaunchedAt] = useState<number | undefined>();
  const [expectSelect, setExpectSelect] = useState(false);

  const wf = QA_WORKFLOWS.find((w) => w.id === workflow)!;
  const isAll = features.includes("all");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, typeof QA_FEATURES>();
    for (const f of QA_FEATURES) {
      if (f.id === "all") continue;
      if (q && !f.label.toLowerCase().includes(q) && !f.group.toLowerCase().includes(q)) continue;
      map.set(f.group, [...(map.get(f.group) ?? []), f]);
    }
    return [...map.entries()];
  }, [query]);

  // After a single launch, follow the new run automatically (derived, no effect).
  const autoRun =
    expectSelect && launchedAt
      ? runs.find((r) => r.workflowFile === workflow && +new Date(r.createdAt) >= launchedAt - 5000)
      : undefined;
  const current = selected ?? autoRun?.id ?? null;

  const toggle = (id: string) =>
    setFeatures((cur) => {
      const without = cur.filter((f) => f !== "all");
      return without.includes(id) ? without.filter((f) => f !== id) : [...without, id];
    });

  const toggleGroup = (ids: string[]) =>
    setFeatures((cur) => {
      const without = cur.filter((f) => f !== "all");
      const allIn = ids.every((i) => without.includes(i));
      return allIn ? without.filter((f) => !ids.includes(f)) : [...new Set([...without, ...ids])];
    });

  const tooMany = !isAll && features.length > QA_MAX_FEATURES_PER_LAUNCH;
  const empty = features.length === 0;
  const runCount = isAll ? 1 : features.length;

  const start = async () => {
    if (empty || tooMany) return;
    setBusy(true);
    setMessage(null);
    try {
      const t = Date.now();
      const res = await postJson<{ launches: { ok: boolean; error?: string }[] }>("/api/automation/dispatch", {
        suite: "quantum-agent",
        workflow,
        environment,
        features,
        notifyTeams,
        sampleCardOnly: wf.supportsSampleCard && sampleOnly,
      });
      const failed = res.launches.filter((l) => !l.ok).length;
      setLaunchedAt(t);
      setSelected(null);
      setExpectSelect(res.launches.length === 1);
      setMessage(
        failed
          ? { tone: "error", text: `${res.launches.length - failed} started, ${failed} could not be started.` }
          : { tone: "success", text: `${res.launches.length} run${res.launches.length > 1 ? "s" : ""} started on ${ENV_LABEL.get(environment)}. Each posts its own Teams card.` },
      );
      boost();
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Could not start the run" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
      <section className="hv-panel rounded-xl p-5">
        <h3 className="text-base font-semibold text-[#f0f4f8]">Run Quantum Agent tests</h3>
        <p className="mt-1 text-xs text-[#8b9bb4]">Automated UI tests against the Quantum Agent app.</p>

        <div className="mt-5 space-y-4">
          <Field label="Environment">
            <Segmented label="Environment" value={environment} onChange={setEnvironment} options={QA_ENVIRONMENTS.map((e) => ({ id: e.id, label: e.label }))} />
          </Field>

          <Field label="Run type" hint={wf.description}>
            <select value={workflow} onChange={(e) => setWorkflow(e.target.value)} className={inputCls}>
              {QA_WORKFLOWS.map((w) => (
                <option key={w.id} value={w.id}>{w.label}</option>
              ))}
            </select>
          </Field>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="sys-label">Features</span>
              <span className="text-xs text-[#6b7d96]">
                {isAll ? "Full suite" : `${features.length} selected`}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setFeatures(isAll ? [] : ["all"])}
              aria-pressed={isAll}
              className={`mb-2 flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
                isAll ? "border-blue-500/40 bg-blue-500/15 text-blue-100" : "btn-hv-secondary"
              }`}
            >
              <span>Full suite <span className="font-normal text-[#8b9bb4]">· all UI tests in one run</span></span>
              <span aria-hidden>{isAll ? "✓" : ""}</span>
            </button>

            <div className={isAll ? "pointer-events-none opacity-40" : ""} aria-disabled={isAll}>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search features…"
                className={`${inputCls} mb-2`}
                aria-label="Search features"
              />
              <div className="max-h-[300px] space-y-3 overflow-y-auto rounded-lg border border-[#2a3548] bg-[#0d1219] p-3">
                {groups.length === 0 && <p className="text-sm text-[#6b7d96]">No features match.</p>}
                {groups.map(([group, items]) => {
                  const ids = items.map((i) => i.id);
                  const allIn = ids.every((i) => features.includes(i));
                  return (
                    <div key={group}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="sys-label">{group}</span>
                        <button type="button" onClick={() => toggleGroup(ids)} className="text-[11px] text-[#60a5fa] hover:underline">
                          {allIn ? "Clear" : "Select all"}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((f) => {
                          const on = features.includes(f.id);
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => toggle(f.id)}
                              aria-pressed={on}
                              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                                on ? "border-blue-500/40 bg-blue-500/15 text-blue-100" : "btn-hv-secondary"
                              }`}
                            >
                              {on && "✓ "}{f.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {tooMany && <p className="mt-1.5 text-xs text-amber-300">Pick at most {QA_MAX_FEATURES_PER_LAUNCH} features, or use the full suite.</p>}
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#2a3548] bg-[#0d1219] px-3.5 py-3">
            <input type="checkbox" checked={notifyTeams} onChange={(e) => setNotifyTeams(e.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-500" />
            <span>
              <span className="block text-sm text-[#e8ecf1]">Notify Microsoft Teams</span>
              <span className="block text-xs text-[#6b7d96]">Post a summary card when each run finishes.</span>
            </span>
          </label>

          {wf.supportsSampleCard && (
            <details className="rounded-lg border border-[#2a3548] bg-[#0d1219] px-3.5 py-2.5">
              <summary className="cursor-pointer text-xs text-[#8b9bb4]">Advanced</summary>
              <label className="mt-3 flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={sampleOnly} onChange={(e) => setSampleOnly(e.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-500" />
                <span className="text-xs text-[#8b9bb4]">Only post a sample Teams card (webhook check). Tests are skipped.</span>
              </label>
            </details>
          )}

          {message && <Toast tone={message.tone} onClose={() => setMessage(null)}>{message.text}</Toast>}

          <button
            type="button"
            onClick={start}
            disabled={busy || empty || tooMany}
            className="btn-hv-primary flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <><Spinner /> Starting…</> : empty ? "Select a feature" : sampleOnly && wf.supportsSampleCard ? "Post sample card" : runCount > 1 ? `Run ${runCount} test groups` : "Run tests"}
          </button>
        </div>
      </section>

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
        {current && <RunDetailPanel key={current} suite="quantum-agent" runId={current} describe={describeRun} />}
      </div>
    </div>
  );
}
