/**
 * Catalog of GitHub Actions automations exposed in the "Automation" page.
 *
 * Everything the browser may ask for is allow-listed here (suites, workflow
 * files, option values). The server re-validates every request against this
 * catalog, so the client can never choose an arbitrary repo / workflow / input.
 * Safe to import from both client and server code (no secrets in here).
 */

export type SuiteId = "xero" | "quantum-agent";

export type SuiteConfig = {
  id: SuiteId;
  owner: string;
  repo: string;
  ref: string;
};

export const SUITES: Record<SuiteId, SuiteConfig> = {
  xero: {
    id: "xero",
    owner: "HighVolt-Analytics",
    repo: "xero-report-automation",
    ref: "main",
  },
  "quantum-agent": {
    id: "quantum-agent",
    owner: "HighVolt-Analytics",
    repo: "Automation_Quantum_Agent",
    ref: "main",
  },
};

export function isSuiteId(value: unknown): value is SuiteId {
  return value === "xero" || value === "quantum-agent";
}

/* ----------------------------- Xero ----------------------------- */

export type XeroTenantId = "pactify" | "clima" | "other";

export const XERO_TENANTS: {
  id: XeroTenantId;
  label: string;
  downloadWorkflow: string;
  loginWorkflow: string;
  loginArtifact: string;
  oneDrive: string;
}[] = [
  {
    id: "pactify",
    label: "Pactify",
    downloadWorkflow: "download-report.yml",
    loginWorkflow: "show-xero-login.yml",
    loginArtifact: "xero-login-url",
    oneDrive: "Xero Reports/Pactify",
  },
  {
    id: "clima",
    label: "Clima",
    downloadWorkflow: "download-report-clima.yml",
    loginWorkflow: "show-xero-login-clima.yml",
    loginArtifact: "clima-login-url",
    oneDrive: "Xero Reports/Clima",
  },
  {
    id: "other",
    label: "Other",
    downloadWorkflow: "download-report-other-tenant.yml",
    loginWorkflow: "show-xero-login-other-tenant.yml",
    loginArtifact: "other-tenant-login-url",
    oneDrive: "Xero Reports/Other",
  },
];

export type XeroReportKind = "range" | "as-at";

export const XERO_REPORTS: {
  id: string;
  label: string;
  kind: XeroReportKind;
  needsContact?: boolean;
}[] = [
  { id: "ProfitAndLoss", label: "Profit and Loss", kind: "range" },
  { id: "BalanceSheet", label: "Balance Sheet", kind: "as-at" },
  { id: "BankSummary", label: "Bank Summary", kind: "range" },
  { id: "TrialBalance", label: "Trial Balance", kind: "as-at" },
  { id: "ExecutiveSummary", label: "Executive Summary", kind: "as-at" },
  { id: "BudgetSummary", label: "Budget Summary", kind: "as-at" },
  {
    id: "AgedReceivablesByContact",
    label: "Aged Receivables by Contact",
    kind: "range",
    needsContact: true,
  },
  {
    id: "AgedPayablesByContact",
    label: "Aged Payables by Contact",
    kind: "range",
    needsContact: true,
  },
];

export const XERO_YEARS = Array.from({ length: 13 }, (_, i) => 2018 + i);

/** Workflows only accept the year dropdown range 2018-2030. */
export function isValidIsoDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 2018 || y > 2030) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === mo - 1 &&
    dt.getUTCDate() === d
  );
}

/* ------------------------- Quantum Agent ------------------------- */

export const QA_ENVIRONMENTS = [
  { id: "staging", label: "Staging" },
  { id: "preview", label: "Preview" },
  { id: "qa", label: "QA" },
] as const;

export const QA_WORKFLOWS = [
  {
    id: "post-teams-test.yml",
    label: "Test run + Teams card",
    description: "Day-to-day run. Posts a summary card to Teams.",
    supportsSampleCard: true,
  },
  {
    id: "m1-qa-suite.yml",
    label: "M1 / Monday QA suite",
    description: "Same inputs as the Monday scheduled suite.",
    supportsSampleCard: false,
  },
] as const;

export const QA_FEATURES: { id: string; label: string; group: string }[] = [
  { id: "all", label: "Full suite (all UI tests)", group: "Suite" },
  { id: "login", label: "Login", group: "Access" },
  { id: "forgot_password", label: "Forgot Password", group: "Access" },
  { id: "signup", label: "Signup", group: "Access" },
  { id: "quantum_dashboard", label: "Quantum Dashboard", group: "Core" },
  { id: "credits", label: "Credits", group: "Core" },
  { id: "conversations", label: "Conversations", group: "Core" },
  { id: "leads", label: "Leads", group: "Core" },
  { id: "bookings", label: "Bookings", group: "Core" },
  { id: "customers", label: "Customers", group: "Core" },
  { id: "marketing_collateral", label: "Marketing Collateral", group: "Growth" },
  { id: "lead_intelligence", label: "Lead Intelligence", group: "Growth" },
  { id: "email_automation", label: "Email Automation", group: "Automation" },
  { id: "workflow_automation", label: "Workflow Automation", group: "Automation" },
  { id: "lead_automation", label: "Lead Automation", group: "Automation" },
  { id: "monitoring_agent", label: "Monitoring Agent", group: "Automation" },
  { id: "receptionist_workflow", label: "Receptionist Workflow", group: "Automation" },
  { id: "employees", label: "Employees", group: "Admin" },
  { id: "pending_approvals", label: "Pending Approvals", group: "Admin" },
  { id: "phone_numbers", label: "Phone Numbers", group: "Admin" },
  { id: "knowledge", label: "Knowledge", group: "Data" },
  { id: "data_library", label: "Data Library", group: "Data" },
  { id: "db_connections", label: "DB Connections", group: "Data" },
  { id: "smart_answers", label: "Smart Answers", group: "Data" },
  { id: "inbox", label: "Inbox", group: "Account" },
  { id: "notifications", label: "Notifications", group: "Account" },
  { id: "my_profile", label: "My Profile", group: "Account" },
  { id: "settings", label: "Settings", group: "Account" },
];

/** Max features per single launch (each one becomes its own workflow run). */
export const QA_MAX_FEATURES_PER_LAUNCH = 8;

/* --------------------- Workflow allow-list ---------------------- */

export function allowedWorkflows(suite: SuiteId): string[] {
  if (suite === "xero") {
    return XERO_TENANTS.flatMap((t) => [t.downloadWorkflow, t.loginWorkflow]);
  }
  return QA_WORKFLOWS.map((w) => w.id);
}

export function isAllowedWorkflow(suite: SuiteId, workflow: string): boolean {
  return allowedWorkflows(suite).includes(workflow);
}

/* ------------------------- Shared types ------------------------- */

export type RunSummary = {
  id: number;
  runNumber: number;
  workflowFile: string;
  workflowName: string;
  title: string;
  status: string; // queued | in_progress | completed | ...
  conclusion: string | null; // success | failure | cancelled | ...
  event: string;
  actor: string | null;
  createdAt: string;
  startedAt: string | null;
  updatedAt: string;
  htmlUrl: string;
};

export type StepInfo = {
  name: string;
  status: string;
  conclusion: string | null;
  number: number;
  startedAt: string | null;
  completedAt: string | null;
};

export type JobInfo = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  steps: StepInfo[];
};

export type RunDetail = RunSummary & { jobs: JobInfo[] };

export type ArtifactFile = {
  artifactId: number;
  artifactName: string;
  path: string;
  size: number;
  ext: string;
};

export type ArtifactInfo = {
  id: number;
  name: string;
  size: number;
  expired: boolean;
  createdAt: string | null;
  expiresAt: string | null;
};

export function isRunActive(run: Pick<RunSummary, "status">): boolean {
  return run.status !== "completed";
}

export function runOutcome(
  run: Pick<RunSummary, "status" | "conclusion">,
): "queued" | "running" | "success" | "failed" | "cancelled" {
  if (run.status === "completed") {
    if (run.conclusion === "success") return "success";
    if (run.conclusion === "cancelled" || run.conclusion === "skipped")
      return "cancelled";
    return "failed";
  }
  return run.status === "in_progress" ? "running" : "queued";
}
