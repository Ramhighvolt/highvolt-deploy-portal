export type AppSection =
  | "overview"
  | "websites"
  | "deployments"
  | "logs"
  | "health"
  | "settings";

export const SECTION_TITLES: Record<AppSection, string> = {
  overview: "Overview",
  websites: "Websites",
  deployments: "Deployments",
  logs: "Logs",
  health: "Health",
  settings: "Settings",
};

export const SECTION_DESCRIPTIONS: Record<AppSection, string> = {
  overview: "Fleet command center and deployment activity",
  websites: "Production website fleet and deployment controls",
  deployments: "Latest GitHub Actions runs across all properties",
  logs: "Run log access and streaming module",
  health: "Property health and deployment status",
  settings: "Platform configuration and environment",
};
