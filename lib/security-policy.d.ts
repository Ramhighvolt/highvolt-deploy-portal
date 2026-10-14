export type AuthorizationDecision =
  | { status: 200; role: "operator" }
  | { status: 401 | 403; role: null };

export function authorizeLogin(
  login: string | null | undefined,
  operatorAllowlist: string | undefined,
): AuthorizationDecision;

export function validateDispatchBody<T extends { id: string }>(
  body: unknown,
  websites: readonly T[],
):
  | { ok: true; website: T }
  | { ok: false; error: string };

export function productionDispatchError(
  website: { id: string; deploymentEnabled?: boolean },
  cutoverEnabled: string | undefined,
  releaseCommit: string | undefined,
  confirmation: string | undefined,
): { status: 400 | 423; error: string } | null;

export function isSameOriginRequest(
  requestUrl: string,
  origin: string | null,
  fetchSite: string | null,
): boolean;
