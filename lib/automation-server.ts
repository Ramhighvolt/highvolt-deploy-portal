import "server-only";
import { unzipSync } from "fflate";
import { createGitHubClient } from "@/lib/github-client";
import {
  SUITES,
  allowedWorkflows,
  isAllowedWorkflow,
  type ArtifactFile,
  type ArtifactInfo,
  type JobInfo,
  type RunDetail,
  type RunSummary,
  type SuiteId,
} from "@/lib/automation-catalog";

/** Hard caps so a huge artifact can't exhaust server memory. */
const MAX_ARTIFACT_ZIP_BYTES = 60 * 1024 * 1024;
const MAX_PREVIEW_ROWS = 400;
const MAX_PREVIEW_COLS = 30;

type RawRun = {
  id: number;
  run_number: number;
  path: string;
  name?: string | null;
  display_title?: string | null;
  status: string | null;
  conclusion: string | null;
  event: string;
  actor?: { login: string } | null;
  created_at: string;
  run_started_at?: string | null;
  updated_at: string;
  html_url: string;
};

function workflowFileOf(path: string): string {
  return path.split("/").pop()?.split("@")[0] ?? path;
}

function mapRun(run: RawRun): RunSummary {
  return {
    id: run.id,
    runNumber: run.run_number,
    workflowFile: workflowFileOf(run.path),
    workflowName: run.name ?? workflowFileOf(run.path),
    title: run.display_title ?? run.name ?? "",
    status: run.status ?? "queued",
    conclusion: run.conclusion,
    event: run.event,
    actor: run.actor?.login ?? null,
    createdAt: run.created_at,
    startedAt: run.run_started_at ?? null,
    updatedAt: run.updated_at,
    htmlUrl: run.html_url,
  };
}

export async function dispatchWorkflow(
  suite: SuiteId,
  workflow: string,
  inputs: Record<string, string>,
) {
  if (!isAllowedWorkflow(suite, workflow)) throw new Error("Workflow not allowed");
  const cfg = SUITES[suite];
  const octokit = createGitHubClient();
  await octokit.request(
    "POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches",
    {
      owner: cfg.owner,
      repo: cfg.repo,
      workflow_id: workflow,
      ref: cfg.ref,
      inputs,
    },
  );
}

/** Newest runs across the suite's workflows (optionally a subset), newest first. */
export async function listRuns(
  suite: SuiteId,
  workflows: string[] | null,
  perWorkflow = 10,
): Promise<RunSummary[]> {
  const cfg = SUITES[suite];
  const octokit = createGitHubClient();
  const files = (workflows ?? allowedWorkflows(suite)).filter((w) =>
    isAllowedWorkflow(suite, w),
  );
  const results = await Promise.all(
    files.map(async (workflow) => {
      try {
        const res = await octokit.request(
          "GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs",
          {
            owner: cfg.owner,
            repo: cfg.repo,
            workflow_id: workflow,
            per_page: perWorkflow,
          },
        );
        return (res.data.workflow_runs as unknown as RawRun[]).map(mapRun);
      } catch {
        return [] as RunSummary[];
      }
    }),
  );
  return results
    .flat()
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

async function getAllowedRun(suite: SuiteId, runId: number): Promise<RawRun> {
  const cfg = SUITES[suite];
  const octokit = createGitHubClient();
  const res = await octokit.request(
    "GET /repos/{owner}/{repo}/actions/runs/{run_id}",
    { owner: cfg.owner, repo: cfg.repo, run_id: runId },
  );
  const run = res.data as unknown as RawRun;
  if (!isAllowedWorkflow(suite, workflowFileOf(run.path))) {
    throw new Error("Run does not belong to an allowed workflow");
  }
  return run;
}

export async function getRunDetail(
  suite: SuiteId,
  runId: number,
): Promise<RunDetail> {
  const cfg = SUITES[suite];
  const octokit = createGitHubClient();
  const run = await getAllowedRun(suite, runId);
  const jobsRes = await octokit.request(
    "GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs",
    { owner: cfg.owner, repo: cfg.repo, run_id: runId, per_page: 50 },
  );
  const jobs: JobInfo[] = jobsRes.data.jobs.map((job) => ({
    id: Number(job.id),
    name: job.name,
    status: job.status,
    conclusion: job.conclusion,
    startedAt: job.started_at ?? null,
    completedAt: job.completed_at ?? null,
    steps: (job.steps ?? []).map((step) => ({
      name: step.name,
      status: step.status,
      conclusion: step.conclusion ?? null,
      number: step.number,
      startedAt: step.started_at ?? null,
      completedAt: step.completed_at ?? null,
    })),
  }));
  return { ...mapRun(run), jobs };
}

export async function cancelRun(suite: SuiteId, runId: number) {
  const cfg = SUITES[suite];
  await getAllowedRun(suite, runId);
  await createGitHubClient().request(
    "POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel",
    { owner: cfg.owner, repo: cfg.repo, run_id: runId },
  );
}

export async function listArtifacts(
  suite: SuiteId,
  runId: number,
  opts: { includeLoginLinks?: boolean } = {},
): Promise<ArtifactInfo[]> {
  const cfg = SUITES[suite];
  await getAllowedRun(suite, runId);
  const res = await createGitHubClient().request(
    "GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts",
    { owner: cfg.owner, repo: cfg.repo, run_id: runId, per_page: 100 },
  );
  return res.data.artifacts
    // Refresh tokens and saved login sessions (auth-storage) are secrets: never surface them.
    .filter((a) => !/refresh-token|auth-storage|storage[-_]state/i.test(a.name))
    // Login-link artifacts are plumbing for the "Get login link" flow, not results.
    .filter((a) => opts.includeLoginLinks || !/login-url$/i.test(a.name))
    .map((a) => ({
      id: a.id,
      name: a.name,
      size: a.size_in_bytes,
      expired: a.expired,
      createdAt: a.created_at ?? null,
      expiresAt: a.expires_at ?? null,
    }));
}

async function downloadArtifactZip(
  suite: SuiteId,
  runId: number,
  artifactId: number,
): Promise<Uint8Array> {
  const artifacts = await listArtifacts(suite, runId, { includeLoginLinks: true });
  const artifact = artifacts.find((a) => a.id === artifactId);
  if (!artifact) throw new Error("Artifact not found for this run");
  if (artifact.expired) throw new Error("Artifact has expired");
  if (artifact.size > MAX_ARTIFACT_ZIP_BYTES) throw new Error("Artifact is too large");
  const cfg = SUITES[suite];
  const res = await createGitHubClient().request(
    "GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}",
    {
      owner: cfg.owner,
      repo: cfg.repo,
      artifact_id: artifactId,
      archive_format: "zip",
    },
  );
  return new Uint8Array(res.data as unknown as ArrayBuffer);
}

export async function getArtifactZip(
  suite: SuiteId,
  runId: number,
  artifactId: number,
) {
  const artifacts = await listArtifacts(suite, runId, { includeLoginLinks: true });
  const artifact = artifacts.find((a) => a.id === artifactId);
  const bytes = await downloadArtifactZip(suite, runId, artifactId);
  return { name: artifact?.name ?? `artifact-${artifactId}`, bytes };
}

function extOf(path: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(path);
  return m ? m[1].toLowerCase() : "";
}

function safeEntry(path: string): boolean {
  return !path.includes("..") && !path.startsWith("/") && !path.endsWith("/");
}

/** Every file inside every (non-secret) artifact of a run. */
export async function listArtifactFiles(
  suite: SuiteId,
  runId: number,
): Promise<ArtifactFile[]> {
  const artifacts = (await listArtifacts(suite, runId)).filter(
    (a) => !a.expired && a.size <= MAX_ARTIFACT_ZIP_BYTES,
  );
  const files = await Promise.all(
    artifacts.map(async (artifact) => {
      const zip = unzipSync(await downloadArtifactZip(suite, runId, artifact.id));
      return Object.entries(zip)
        .filter(([path]) => safeEntry(path))
        .map(([path, data]) => ({
          artifactId: artifact.id,
          artifactName: artifact.name,
          path,
          size: data.length,
          ext: extOf(path),
        }));
    }),
  );
  return files.flat();
}

export async function readArtifactFile(
  suite: SuiteId,
  runId: number,
  artifactId: number,
  path: string,
): Promise<Uint8Array> {
  if (!safeEntry(path)) throw new Error("Invalid file path");
  const zip = unzipSync(await downloadArtifactZip(suite, runId, artifactId));
  const data = zip[path];
  if (!data) throw new Error("File not found in artifact");
  return data;
}

/* ----------------------- xlsx conversion ----------------------- */

export type SheetPreview = {
  sheet: string;
  rows: (string | number | null)[][];
  totalRows: number;
  truncated: boolean;
};

type CellValue = string | number | null;

function cellToValue(value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as { result?: unknown; text?: unknown; richText?: { text: string }[] };
    if (v.result !== undefined) return cellToValue(v.result);
    if (typeof v.text === "string") return v.text;
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("");
  }
  return String(value);
}

async function readSheets(bytes: Uint8Array) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  return wb.worksheets.map((ws) => {
    const rows: CellValue[][] = [];
    // Iterate every row number so spacer (blank) rows keep their position.
    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const cells: CellValue[] = [];
      for (let c = 1; c <= ws.columnCount; c++) cells.push(cellToValue(row.getCell(c).value));
      rows.push(cells);
    }
    return { sheet: ws.name, rows };
  });
}

export async function xlsxPreview(bytes: Uint8Array): Promise<SheetPreview[]> {
  const sheets = await readSheets(bytes);
  return sheets.map(({ sheet, rows }) => ({
    sheet,
    totalRows: rows.length,
    truncated: rows.length > MAX_PREVIEW_ROWS,
    rows: rows.slice(0, MAX_PREVIEW_ROWS).map((r) => r.slice(0, MAX_PREVIEW_COLS)),
  }));
}

function csvCell(value: CellValue): string {
  const text = value === null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function xlsxToCsv(bytes: Uint8Array): Promise<string> {
  const sheets = await readSheets(bytes);
  const first = sheets[0];
  if (!first) return "";
  // Leading BOM so Excel opens UTF-8 CSVs correctly.
  return "﻿" + first.rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export async function xlsxToJson(bytes: Uint8Array): Promise<string> {
  const sheets = await readSheets(bytes);
  return JSON.stringify(sheets, null, 2);
}

/* ----------------------- in-page viewing ----------------------- */

const XML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

/** Plain text of a .docx (paragraphs and table cells), no styling. */
export function docxToText(bytes: Uint8Array): string {
  const entry = unzipSync(bytes, { filter: (f) => f.name === "word/document.xml" })[
    "word/document.xml"
  ];
  if (!entry) throw new Error("Not a valid .docx file");
  return new TextDecoder()
    .decode(entry)
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<\/w:tc>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => XML_ENTITIES[m])
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
