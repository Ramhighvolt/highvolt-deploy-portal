"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import type { ArtifactFile } from "@/lib/automation-catalog";
import { Spinner, Toast, api, formatBytes } from "./shared";

/* What the portal can show in-page, by file extension. */
export type ViewKind = "sheet" | "image" | "html" | "markdown" | "text";

const KIND_BY_EXT: Record<string, ViewKind> = {
  xlsx: "sheet",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  html: "html",
  md: "markdown",
  docx: "text",
  txt: "text",
  log: "text",
  json: "text",
  csv: "text",
  xml: "text",
  yml: "text",
  yaml: "text",
};

export function viewKind(ext: string): ViewKind | null {
  return KIND_BY_EXT[ext] ?? null;
}

export const KIND_LABEL: Record<ViewKind, string> = {
  sheet: "Spreadsheet",
  image: "Image",
  html: "HTML report",
  markdown: "Markdown",
  text: "Text",
};

type Sheet = {
  sheet: string;
  rows: (string | number | null)[][];
  totalRows: number;
  truncated: boolean;
};

type Loaded =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "sheet"; sheets: Sheet[] }
  | { state: "text"; kind: "html" | "markdown" | "text"; text: string; truncated: boolean };

function fileUrl(runId: number, suite: string, f: ArtifactFile, format: string) {
  const qs = new URLSearchParams({
    suite,
    artifactId: String(f.artifactId),
    path: f.path,
    format,
  });
  return `/api/automation/runs/${runId}/download?${qs}`;
}

/* ------------------------------ Viewer ------------------------------ */

export default function FileViewer({
  files,
  index,
  suite,
  runId,
  onIndex,
  onClose,
}: {
  files: ArtifactFile[];
  index: number;
  suite: string;
  runId: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const file = files[index];
  const kind = viewKind(file.ext) as ViewKind;
  const name = file.path.split("/").pop() ?? file.path;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && index < files.length - 1) onIndex(index + 1);
      else if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [index, files.length, onIndex, onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-2 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${name}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex h-full max-h-[900px] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-[#3d4f6a] bg-[#0d1219] shadow-2xl">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#2a3548] bg-[#151c28] px-3 py-2.5 sm:px-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[#f0f4f8]" title={file.path}>{name}</p>
            <p className="truncate text-[11px] text-[#6b7d96]">
              {KIND_LABEL[kind]} · {formatBytes(file.size)} · {file.path}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => onIndex(index - 1)}
              className="btn-hv-secondary rounded-md px-2 py-1 text-xs disabled:opacity-40"
              aria-label="Previous file"
            >
              ←
            </button>
            <span className="min-w-[3rem] text-center font-mono text-[11px] text-[#8b9bb4]">
              {index + 1} / {files.length}
            </span>
            <button
              type="button"
              disabled={index === files.length - 1}
              onClick={() => onIndex(index + 1)}
              className="btn-hv-secondary rounded-md px-2 py-1 text-xs disabled:opacity-40"
              aria-label="Next file"
            >
              →
            </button>
            <a
              href={fileUrl(runId, suite, file, "original")}
              className="btn-hv-primary ml-1 rounded-md px-2.5 py-1 text-xs font-medium"
            >
              Download
            </a>
            <button
              type="button"
              onClick={onClose}
              className="btn-hv-secondary rounded-md px-2.5 py-1 text-xs"
              aria-label="Close preview"
            >
              Close ✕
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {/* key remounts the body per file, so loading state resets cleanly */}
          <ViewerBody key={`${file.artifactId}:${file.path}`} file={file} kind={kind} suite={suite} runId={runId} />
        </div>
      </div>
    </div>
  );
}

function ViewerBody({
  file,
  kind,
  suite,
  runId,
}: {
  file: ArtifactFile;
  kind: ViewKind;
  suite: string;
  runId: number;
}) {
  const [data, setData] = useState<Loaded>({ state: "loading" });
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    if (kind === "image") return;
    let stopped = false;
    const run = async () => {
      try {
        if (kind === "sheet") {
          const d = await api<{ sheets: Sheet[] }>(fileUrl(runId, suite, file, "preview"));
          if (!stopped) setData({ state: "sheet", sheets: d.sheets });
        } else {
          const d = await api<{ kind: "html" | "markdown" | "text"; text: string; truncated: boolean }>(
            fileUrl(runId, suite, file, "view"),
          );
          if (!stopped) setData({ state: "text", kind: d.kind, text: d.text, truncated: d.truncated });
        }
      } catch (e) {
        if (!stopped) setData({ state: "error", message: e instanceof Error ? e.message : "Preview failed" });
      }
    };
    void run();
    return () => {
      stopped = true;
    };
  }, [file, kind, suite, runId]);

  if (kind === "image") {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#080c12] p-3">
        {imgFailed ? (
          <Toast tone="error">Could not load this image. Try Download.</Toast>
        ) : (
          <img
            src={fileUrl(runId, suite, file, "view")}
            alt={file.path}
            onError={() => setImgFailed(true)}
            className="max-h-full max-w-full rounded border border-[#2a3548] object-contain"
          />
        )}
      </div>
    );
  }
  if (data.state === "loading")
    return (
      <p className="flex items-center gap-2 p-6 text-sm text-[#8b9bb4]">
        <Spinner /> Loading preview…
      </p>
    );
  if (data.state === "error")
    return (
      <div className="p-4">
        <Toast tone="error">{data.message}</Toast>
      </div>
    );
  if (data.state === "sheet") return <SheetView sheets={data.sheets} />;

  return (
    <>
      {data.kind === "html" ? (
        <HtmlView html={data.text} />
      ) : data.kind === "markdown" ? (
        <div className="mx-auto max-w-3xl px-5 py-5">
          <Markdown text={data.text} />
        </div>
      ) : (
        <TextView text={data.text} ext={file.ext} />
      )}
      {data.truncated && (
        <p className="border-t border-[#2a3548] p-2 text-center text-[11px] text-[#6b7d96]">
          Preview cut short because the file is very large. Download for the full file.
        </p>
      )}
    </>
  );
}

/* ------------------------------ Sheet ------------------------------ */

function fmtCell(v: string | number | null): string {
  if (v === null || v === "") return "";
  if (typeof v === "number") {
    const s = Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return v < 0 ? `(${s})` : s;
  }
  return v;
}

function SheetView({ sheets }: { sheets: Sheet[] }) {
  const [active, setActive] = useState(0);
  const sheet = sheets[active] ?? sheets[0];
  if (!sheet) return <p className="p-4 text-sm text-[#8b9bb4]">This spreadsheet is empty.</p>;
  return (
    <div>
      {sheets.length > 1 && (
        <div className="flex gap-1 border-b border-[#2a3548] px-3 pt-2">
          {sheets.map((s, i) => (
            <button
              key={s.sheet}
              type="button"
              onClick={() => setActive(i)}
              className={`rounded-t-md px-3 py-1 text-xs ${i === active ? "bg-[#1c2535] text-white" : "text-[#8b9bb4] hover:text-white"}`}
            >
              {s.sheet}
            </button>
          ))}
        </div>
      )}
      <table className="w-full border-collapse text-xs">
        <tbody>
          {sheet.rows.map((row, i) => (
            <tr key={i} className="border-b border-[#1c2535]">
              <td className="w-9 select-none bg-[#151c28] px-2 py-1 text-right font-mono text-[10px] text-[#4b5b73]">
                {i + 1}
              </td>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`whitespace-nowrap px-3 py-1 ${j === 0 ? "text-left text-[#e8ecf1]" : "text-right font-mono text-[#c5d0de]"}`}
                >
                  {fmtCell(cell)}
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
  );
}

/* ------------------------------ Text ------------------------------ */

function TextView({ text, ext }: { text: string; ext: string }) {
  let shown = text;
  if (ext === "json") {
    try {
      shown = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      /* show as-is */
    }
  }
  return (
    <pre className="whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-[#c5d0de]">
      {shown || "(empty file)"}
    </pre>
  );
}

/* ------------------------------ HTML ------------------------------ */

// Report HTML is untrusted: it runs in an opaque-origin sandbox (no portal
// cookies or DOM) with a CSP that blocks every network request.
const HTML_CSP =
  "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:; script-src 'unsafe-inline'; media-src data:";

function HtmlView({ html }: { html: string }) {
  const doc = `<meta http-equiv="Content-Security-Policy" content="${HTML_CSP}"><base target="_blank">${html}`;
  return (
    <iframe
      title="Report preview"
      sandbox="allow-scripts"
      srcDoc={doc}
      referrerPolicy="no-referrer"
      className="h-full min-h-[60vh] w-full border-0 bg-white"
    />
  );
}

/* ----------------------------- Markdown ----------------------------- */

// Minimal, safe renderer: builds React elements only (no innerHTML), and only
// ever links http(s) URLs.
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (m[1]) out.push(<code key={k++} className="rounded bg-[#1c2535] px-1 py-0.5 font-mono text-[0.9em] text-[#9bd1ff]">{t.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={k++} className="font-semibold text-white">{t.slice(2, -2)}</strong>);
    else if (m[3]) out.push(<em key={k++}>{t.slice(1, -1)}</em>);
    else {
      const link = /^\[([^\]]+)\]\((.+)\)$/.exec(t);
      if (link)
        out.push(
          <a key={k++} href={link[2]} target="_blank" rel="noopener noreferrer" className="text-[#58a6ff] underline">
            {link[1]}
          </a>,
        );
    }
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function splitRow(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.trimStart().startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) code.push(lines[i++]);
      i++;
      blocks.push(
        <pre key={key++} className="my-3 overflow-x-auto rounded-lg border border-[#2a3548] bg-[#080c12] p-3 font-mono text-xs text-[#c5d0de]">
          {code.join("\n")}
        </pre>,
      );
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const cls =
        level === 1
          ? "mb-3 mt-5 text-xl font-bold text-white"
          : level === 2
            ? "mb-2 mt-5 border-b border-[#2a3548] pb-1 text-lg font-semibold text-white"
            : "mb-2 mt-4 text-sm font-semibold text-[#e8ecf1]";
      blocks.push(<p key={key++} role="heading" aria-level={level} className={cls}>{inline(h[2])}</p>);
      i++;
      continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      blocks.push(<hr key={key++} className="my-4 border-[#2a3548]" />);
      i++;
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(splitRow(lines[i++]));
      blocks.push(
        <div key={key++} className="my-3 overflow-x-auto rounded-lg border border-[#2a3548]">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-[#1c2535]">
              <tr>{head.map((c, j) => <th key={j} className="px-3 py-1.5 text-left font-semibold text-[#e8ecf1]">{inline(c)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-t border-[#2a3548]">
                  {r.map((c, j) => <td key={j} className="px-3 py-1.5 text-[#c5d0de]">{inline(c)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, ""));
        i++;
      }
      const Tag = ordered ? "ol" : "ul";
      blocks.push(
        <Tag key={key++} className={`my-2 space-y-1 pl-5 text-sm text-[#c5d0de] ${ordered ? "list-decimal" : "list-disc"}`}>
          {items.map((it, j) => <li key={j}>{inline(it)}</li>)}
        </Tag>,
      );
      continue;
    }
    if (line.startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) quote.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(
        <blockquote key={key++} className="my-3 border-l-2 border-[#3d4f6a] pl-3 text-sm italic text-[#8b9bb4]">
          {inline(quote.join(" "))}
        </blockquote>,
      );
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6}\s|```|>|\s*([-*+]|\d+\.)\s+)/.test(lines[i])
    )
      para.push(lines[i++]);
    blocks.push(
      <p key={key++} className="my-2 text-sm leading-relaxed text-[#c5d0de]">
        {para.map((p, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {inline(p)}
          </Fragment>
        ))}
      </p>,
    );
  }
  return <>{blocks}</>;
}
