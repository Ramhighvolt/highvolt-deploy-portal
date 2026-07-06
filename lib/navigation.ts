export type AppSection =
  | "overview"
  | "websites"
  | "deployments"
  | "logs"
  | "health"
  | "clarity"
  | "super-admin"
  | "github-repos"
  | "settings";

export const SECTION_TITLES: Record<AppSection, string> = {
  overview: "Overview",
  websites: "Websites",
  deployments: "Deployments",
  logs: "Logs",
  health: "Health",
  clarity: "Clarity",
  "super-admin": "Super Admin",
  "github-repos": "GitHub Repos",
  settings: "Settings",
};

export const SECTION_DESCRIPTIONS: Record<AppSection, string> = {
  overview: "Fleet command center and deployment activity",
  websites: "Production website fleet and deployment controls",
  deployments: "Latest GitHub Actions runs across all properties",
  logs: "Run log access and streaming module",
  health: "Property health and deployment status",
  clarity: "Microsoft Clarity analytics across production properties",
  "super-admin": "Super Admin portal access for production properties",
  "github-repos": "GitHub repositories for production properties",
  settings: "Platform configuration and environment",
};
