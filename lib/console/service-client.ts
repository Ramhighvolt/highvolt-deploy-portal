export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type CallResult = {
  /** The HTTP status, or 0 when the service could not be reached in time. */
  status: number;
  body: unknown;
  etag: string | null;
};

export type CallInit = {
  method?: "GET" | "POST" | "PUT";
  token?: string;
  json?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

/**
 * One call to a platform service. Bounded by a timeout, never throws, never logs a token or a body, and treats a
 * non-JSON answer as "no body" rather than an error so a proxy error page cannot crash a handler.
 */
export async function callService(f: FetchLike, baseUrl: string, path: string, init: CallInit = {}): Promise<CallResult> {
  const headers: Record<string, string> = { accept: "application/json", ...(init.headers ?? {}) };
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  if (init.json !== undefined) headers["content-type"] = "application/json";
  try {
    const res = await f(`${baseUrl}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.json === undefined ? undefined : JSON.stringify(init.json),
      signal: AbortSignal.timeout(init.timeoutMs ?? 8000),
      cache: "no-store",
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, body, etag: res.headers.get("etag") };
  } catch {
    return { status: 0, body: null, etag: null };
  }
}

/** What the browser is told when an upstream call fails: never the upstream's own text. */
export function publicStatus(upstream: number): { status: number; message: string } {
  if (upstream === 401) return { status: 401, message: "Your session has expired. Sign in again." };
  if (upstream === 403) return { status: 403, message: "You do not have permission to do that." };
  if (upstream === 404) return { status: 404, message: "Not found." };
  if (upstream === 412) return { status: 409, message: "This client changed since you opened it. Reload and try again." };
  if (upstream === 428) return { status: 409, message: "This client changed since you opened it. Reload and try again." };
  if (upstream === 422) return { status: 422, message: "That module is not available for this product." };
  if (upstream >= 400 && upstream < 500) return { status: 400, message: "The request was not accepted." };
  return { status: 502, message: "A platform service is unavailable. Try again shortly." };
}
