export type ConsoleConfig = {
  loginUrl: string;
  commerceUrl: string;
  /** The product whose clients this Console shows (the Commerce app id). */
  appId: string;
  /** The Login app id operators sign in to: its own app, never "platform" (which service accounts use). */
  platformAppId: string;
  secureCookies: boolean;
};

type Env = Record<string, string | undefined>;

/** The Console is off unless explicitly switched on, so deploying the code changes nothing by itself. */
export function consoleEnabled(env: Env = process.env): boolean {
  return env.CONSOLE_ENABLED === "true";
}

function serviceUrl(name: string, value: string | undefined): string {
  if (!value || !value.trim()) {
    throw new Error(`${name} is required when the Console is enabled`);
  }
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`${name} is not a valid URL`);
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error(`${name} must use https (http is allowed for localhost only)`);
  }
  return url.origin;
}

export function loadConsoleConfig(env: Env = process.env): ConsoleConfig {
  const appId = (env.CONSOLE_APP_ID ?? "quantum-quber").trim();
  const platformAppId = (env.CONSOLE_PLATFORM_APP_ID ?? "console").trim();
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(appId)) {
    throw new Error("CONSOLE_APP_ID is not a valid app id");
  }
  return {
    loginUrl: serviceUrl("CONSOLE_LOGIN_URL", env.CONSOLE_LOGIN_URL),
    commerceUrl: serviceUrl("CONSOLE_COMMERCE_URL", env.CONSOLE_COMMERCE_URL),
    appId,
    platformAppId,
    secureCookies: env.NODE_ENV === "production" || env.CONSOLE_SECURE_COOKIES === "true",
  };
}
