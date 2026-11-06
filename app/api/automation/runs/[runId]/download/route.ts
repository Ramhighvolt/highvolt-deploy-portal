import { describeError, guard, jsonError, parseId, parseSuite } from "@/lib/automation-api";
import {
  docxToText,
  getArtifactZip,
  readArtifactFile,
  xlsxPreview,
  xlsxToCsv,
  xlsxToJson,
} from "@/lib/automation-server";

const MIME: Record<string, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
  json: "application/json; charset=utf-8",
  html: "text/html; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  log: "text/plain; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
  md: "text/markdown; charset=utf-8",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp"]);
const TEXT_EXT = new Set(["md", "txt", "log", "json", "csv", "xml", "yml", "yaml", "html"]);
const MAX_VIEW_CHARS = 1_500_000;
const MAX_VIEW_IMAGE_BYTES = 12 * 1024 * 1024;

function attachment(name: string) {
  const safe = name.replace(/[^\w.\- ]+/g, "_");
  return `attachment; filename="${safe}"`;
}

/**
 * GET ?suite&artifactId[&path][&format=original|csv|json|preview]
 * No `path`: the whole artifact as a .zip. With `path`: one file, optionally
 * converted from .xlsx to csv / json, or a JSON preview for the UI.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ runId: string }> },
) {
  const { error } = await guard(request, false);
  if (error) return error;
  const url = new URL(request.url);
  const suite = parseSuite(url.searchParams.get("suite"));
  const runId = parseId((await ctx.params).runId);
  const artifactId = parseId(url.searchParams.get("artifactId"));
  if (!suite || !runId || !artifactId) return jsonError("Invalid request", 400);
  const path = url.searchParams.get("path");
  const format = url.searchParams.get("format") ?? "original";
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

  try {
    if (!path) {
      const { name, bytes } = await getArtifactZip(suite, runId, artifactId);
      return new Response(Buffer.from(bytes), {
        headers: {
          ...headers,
          "Content-Type": "application/zip",
          "Content-Disposition": attachment(`${name}.zip`),
        },
      });
    }
    const bytes = await readArtifactFile(suite, runId, artifactId, path);
    const base = path.split("/").pop() ?? "file";
    const stem = base.replace(/\.[^.]+$/, "");
    const ext = (/\.([a-z0-9]+)$/i.exec(base)?.[1] ?? "").toLowerCase();
    const isXlsx = ext === "xlsx";

    if (format === "view") {
      // In-page viewing. Raster images are served inline (never SVG); every
      // other type is returned as data and rendered safely by the client.
      if (IMAGE_EXT.has(ext)) {
        if (bytes.length > MAX_VIEW_IMAGE_BYTES)
          return jsonError("Image is too large to preview. Download it instead.", 413);
        return new Response(Buffer.from(bytes), {
          headers: {
            ...headers,
            "Content-Type": MIME[ext],
            "Content-Disposition": "inline",
            "Content-Security-Policy": "default-src 'none'; sandbox",
          },
        });
      }
      if (ext === "docx" || TEXT_EXT.has(ext)) {
        const full = ext === "docx" ? docxToText(bytes) : new TextDecoder().decode(bytes);
        const truncated = full.length > MAX_VIEW_CHARS;
        return Response.json(
          {
            success: true,
            kind: ext === "html" ? "html" : ext === "md" ? "markdown" : "text",
            text: truncated ? full.slice(0, MAX_VIEW_CHARS) : full,
            truncated,
          },
          { headers },
        );
      }
      return jsonError("No in-page preview for this file type. Download it instead.", 400);
    }
    if (format === "preview") {
      if (!isXlsx) return jsonError("Preview is only available for .xlsx files", 400);
      return Response.json({ success: true, sheets: await xlsxPreview(bytes) }, { headers });
    }
    if (format === "csv" && isXlsx) {
      return new Response(await xlsxToCsv(bytes), {
        headers: {
          ...headers,
          "Content-Type": MIME.csv,
          "Content-Disposition": attachment(`${stem}.csv`),
        },
      });
    }
    if (format === "json" && isXlsx) {
      return new Response(await xlsxToJson(bytes), {
        headers: {
          ...headers,
          "Content-Type": MIME.json,
          "Content-Disposition": attachment(`${stem}.json`),
        },
      });
    }
    if (format !== "original") return jsonError("Unsupported format for this file", 400);
    // Always a download, never rendered on the portal origin (HTML reports).
    return new Response(Buffer.from(bytes), {
      headers: {
        ...headers,
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Content-Disposition": attachment(base),
      },
    });
  } catch (e) {
    const { message, status } = describeError(e);
    return jsonError(message, status);
  }
}
