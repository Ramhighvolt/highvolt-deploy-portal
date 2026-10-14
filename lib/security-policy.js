const ALLOWED_DISPATCH_FIELDS = new Set([
  "websiteId",
  "releaseCommit",
  "confirmProduction",
]);

export function authorizeLogin(login, operatorAllowlist) {
  if (typeof login !== "string" || login.length === 0) {
    return { status: 401, role: null };
  }

  const operators = new Set(
    String(operatorAllowlist ?? "")
      .split(",")
      .map((value) => value.trim().replace(/^@/, "").toLowerCase())
      .filter(Boolean),
  );

  return operators.has(login.toLowerCase())
    ? { status: 200, role: "operator" }
    : { status: 403, role: null };
}

export function validateDispatchBody(body, websites) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "A JSON object is required" };
  }

  if (Object.keys(body).some((key) => !ALLOWED_DISPATCH_FIELDS.has(key))) {
    return { ok: false, error: "Unsupported dispatch field" };
  }

  if (typeof body.websiteId !== "string") {
    return { ok: false, error: "Website selection is required" };
  }

  const website = websites.find((site) => site.id === body.websiteId);
  if (!website) return { ok: false, error: "Website not found" };

  if (
    (body.releaseCommit !== undefined && typeof body.releaseCommit !== "string") ||
    (body.confirmProduction !== undefined && typeof body.confirmProduction !== "string")
  ) {
    return { ok: false, error: "Invalid release confirmation" };
  }

  return { ok: true, website };
}

export function productionDispatchError(website, cutoverEnabled, releaseCommit, confirmation) {
  if ("deploymentEnabled" in website && !website.deploymentEnabled) {
    return { status: 423, error: "Production deployment is paused during migration preparation" };
  }

  if (website.id !== "quantum-ledgerline") return null;

  if (cutoverEnabled !== "true") {
    return { status: 423, error: "Ledgerline production dispatch is blocked by the server-side migration gate" };
  }

  if (!/^[a-f0-9]{40}$/.test(releaseCommit ?? "") || confirmation !== "DEPLOY") {
    return { status: 400, error: "Ledgerline production dispatch requires an exact commit and explicit DEPLOY confirmation" };
  }

  return null;
}

export function isSameOriginRequest(requestUrl, origin, fetchSite) {
  if (typeof origin !== "string") return false;
  try {
    if (new URL(requestUrl).origin !== new URL(origin).origin) return false;
  } catch {
    return false;
  }
  return fetchSite === null || fetchSite === undefined || fetchSite === "same-origin";
}

