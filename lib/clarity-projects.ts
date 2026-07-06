export type ClarityProject = {
  id: string;
  label: string;
  url: string;
};

export const CLARITY_PROJECTS: ClarityProject[] = [
  {
    id: "qa-edupass-product",
    label: "Quantum Agent & Quantum Edupass (Product)",
    url: "https://clarity.microsoft.com/projects/view/xgny1btj82/dashboard",
  },
  {
    id: "quantum-agent",
    label: "Quantum Agent",
    url: "https://clarity.microsoft.com/projects/view/x8y2wer34q/dashboard",
  },
  {
    id: "quantum-edupass",
    label: "Quantum Edupass",
    url: "https://clarity.microsoft.com/projects/view/x8xxix54n8/dashboard",
  },
  {
    id: "quantum-ledgerlink",
    label: "Quantum Ledgerlink",
    url: "https://clarity.microsoft.com/projects/view/x8ym6k8y95/dashboard",
  },
  {
    id: "highvolt-analytics",
    label: "Highvolt Analytics",
    url: "https://clarity.microsoft.com/projects/view/x8ubjo5ipc/dashboard",
  },
];
