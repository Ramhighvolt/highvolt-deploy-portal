import {
  QA_ENVIRONMENTS,
  QA_FEATURES,
  QA_MAX_FEATURES_PER_LAUNCH,
  QA_WORKFLOWS,
  XERO_REPORTS,
  XERO_TENANTS,
  isValidIsoDate,
  type SuiteId,
} from "@/lib/automation-catalog";
import { describeError, guard, jsonError, jsonOk } from "@/lib/automation-api";
import { dispatchWorkflow } from "@/lib/automation-server";

type Launch = { workflow: string; label: string; ok: boolean; error?: string };
type Planned = {
  suite: SuiteId;
  workflow: string;
  label: string;
  inputs: Record<string, string>;
};

export async function POST(request: Request) {
  const { error } = await guard(request, true);
  if (error) return error;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return jsonError("A JSON object is required", 400);

  const planned: Planned[] = [];

  if (body.suite === "xero") {
    const tenant = XERO_TENANTS.find((t) => t.id === body.tenant);
    if (!tenant) return jsonError("Unknown tenant", 400);

    if (body.action === "login") {
      planned.push({
        suite: "xero",
        workflow: tenant.loginWorkflow,
        label: `${tenant.label} login link`,
        inputs: {},
      });
    } else if (body.action === "download") {
      const report = XERO_REPORTS.find((r) => r.id === body.report);
      if (!report) return jsonError("Unknown report", 400);
      const to = String(body.toDate ?? "");
      const from = report.kind === "as-at" ? to : String(body.fromDate ?? "");
      if (!isValidIsoDate(from) || !isValidIsoDate(to))
        return jsonError("Dates must be valid calendar dates between 2018 and 2030", 400);
      if (from > to) return jsonError("From date must be on or before the To date", 400);
      const code =
        typeof body.authorizationCode === "string" ? body.authorizationCode.trim() : "";
      // Xero auth codes are short URL-safe tokens. Rejecting anything else also
      // blocks shell injection through the workflow's `echo ::add-mask::` step.
      if (code && !/^[A-Za-z0-9_-]{8,200}$/.test(code))
        return jsonError(
          "Authorization code looks invalid. Paste only the value after code= and before &",
          400,
        );
      const [fy, fm, fd] = from.split("-");
      const [ty, tm, td] = to.split("-");
      planned.push({
        suite: "xero",
        workflow: tenant.downloadWorkflow,
        label: `${tenant.label} · ${report.label}`,
        inputs: {
          authorization_code: code,
          report: report.id,
          from_year: fy,
          from_month: fm,
          from_day: fd,
          to_year: ty,
          to_month: tm,
          to_day: td,
        },
      });
    } else return jsonError("Unknown action", 400);
  } else if (body.suite === "quantum-agent") {
    const workflow = QA_WORKFLOWS.find((w) => w.id === body.workflow);
    if (!workflow) return jsonError("Unknown workflow", 400);
    const env = QA_ENVIRONMENTS.find((e) => e.id === body.environment);
    if (!env) return jsonError("Unknown environment", 400);
    const features = Array.isArray(body.features)
      ? [...new Set(body.features.map(String))]
      : [];
    if (features.length === 0) return jsonError("Select at least one feature", 400);
    if (features.length > QA_MAX_FEATURES_PER_LAUNCH)
      return jsonError(`Select at most ${QA_MAX_FEATURES_PER_LAUNCH} features per launch`, 400);
    if (features.some((f) => !QA_FEATURES.some((x) => x.id === f)))
      return jsonError("Unknown feature", 400);
    const sample = workflow.supportsSampleCard && body.sampleCardOnly === true;
    for (const feature of features) {
      const inputs: Record<string, string> = {
        environment: env.id,
        feature_tag: feature,
        notify_teams: body.notifyTeams === false ? "false" : "true",
      };
      if (workflow.supportsSampleCard) inputs.sample_card_only = sample ? "true" : "false";
      planned.push({
        suite: "quantum-agent",
        workflow: workflow.id,
        label: QA_FEATURES.find((f) => f.id === feature)?.label ?? feature,
        inputs,
      });
    }
  } else return jsonError("Unknown suite", 400);

  const dispatchedAt = new Date().toISOString();
  const launches: Launch[] = [];
  // Sequential on purpose: run creation order then matches selection order.
  for (const item of planned) {
    try {
      await dispatchWorkflow(item.suite, item.workflow, item.inputs);
      launches.push({ workflow: item.workflow, label: item.label, ok: true });
    } catch (e) {
      launches.push({
        workflow: item.workflow,
        label: item.label,
        ok: false,
        error: describeError(e).message,
      });
    }
  }
  const failed = launches.filter((l) => !l.ok);
  if (failed.length === launches.length)
    return jsonError(failed[0].error ?? "Dispatch failed", 502);
  return jsonOk({ dispatchedAt, launches });
}
