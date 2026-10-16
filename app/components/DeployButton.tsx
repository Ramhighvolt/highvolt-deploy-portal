"use client";

import { useState } from "react";

type DeployButtonProps = {
  websiteId: string;
  websiteName: string;
  disabled?: boolean;
};

type ButtonState = "ready" | "review" | "loading" | "started" | "error";

type ResolvedRelease = { sha: string; shortSha: string; message: string; committedAt: string | null };

const GATED_WEBSITES = new Set(["quantum-ledgerline", "quantum-visa-manager"]);

function releaseEndpoint(websiteId: string): string | null {
  if (websiteId === "quantum-ledgerline") return "/api/deploy/ledgerline-release";
  if (websiteId === "quantum-visa-manager") return "/api/deploy/qvm-release";
  return null;
}

export default function DeployButton({
  websiteId,
  websiteName,
  disabled = false,
}: DeployButtonProps) {
  const [buttonState, setButtonState] = useState<ButtonState>("ready");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [release, setRelease] = useState<ResolvedRelease | null>(null);

  async function handleDeploy() {
    const endpoint = releaseEndpoint(websiteId);
    if (endpoint) {
      setButtonState("loading");
      setErrorMessage("");
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !data.success || !data.release) throw new Error(data.error || "Unable to resolve the current release");
        setRelease(data.release as ResolvedRelease);
        setButtonState("review");
      } catch (error) {
        setButtonState("error");
        setErrorMessage(error instanceof Error ? error.message : "Unable to resolve the current release");
      }
      return;
    }

    const confirmed = window.confirm(
      `Deploy ${websiteName} to production?\n\nThis will trigger a GitHub Actions workflow.`
    );
    if (!confirmed) return;

    setButtonState("loading");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Deployment failed to start");
      }

      setButtonState("started");
      setSuccessMessage(
        `Deployment queued by ${data.deployerEmail ?? "unknown user"}`
      );
    } catch (error) {
      setButtonState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Deployment failed"
      );
    }
  }

  async function confirmGatedDeployment() {
    if (!release) return;
    setButtonState("loading");
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const response = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, releaseCommit: release.sha, confirmProduction: "DEPLOY" }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Deployment failed to start");
      setButtonState("started");
      setSuccessMessage(`Deployment queued by ${data.deployerEmail ?? "unknown user"}`);
    } catch (error) {
      setButtonState("error");
      setErrorMessage(error instanceof Error ? error.message : "Deployment failed");
    }
  }

  function cancelReview() {
    setRelease(null);
    setButtonState("ready");
    setErrorMessage("");
  }

  const label = {
    ready: "Deploy",
    review: "Review ready",
    loading: "Initializing deployment...",
    started: "Queued",
    error: "Failed",
  }[buttonState];

  const classes = {
    ready: "btn-hv-primary",
    review: "border-amber-400/30 bg-amber-400/10 text-amber-200 cursor-default",
    loading: "border-[#2a3548] bg-[#1c2535] text-[#8b9bb4] cursor-wait",
    started:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 cursor-default",
    error: "border-red-500/30 bg-red-500/10 text-red-400",
  }[buttonState];

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleDeploy}
        disabled={disabled || buttonState === "loading" || buttonState === "started" || buttonState === "review"}
        className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all disabled:opacity-80 ${classes}`}
      >
        {buttonState === "loading" && (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#2a3548] border-t-[#60a5fa]" />
        )}
        {label}
      </button>
      <span className="text-xs text-[#6b7d96]">{disabled ? "Disabled by the server-side production gate" : "Production action"}</span>
      {buttonState === "review" && release && GATED_WEBSITES.has(websiteId) && (
        <div className="mt-2 max-w-md rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-sm" role="group" aria-label={`Review ${websiteName} production release`}>
          <p className="font-semibold text-amber-200">Review current main release</p>
          <p className="mt-1 text-[#c5d0de]">Commit <code className="font-mono text-white">{release.shortSha}</code></p>
          <p className="mt-1 break-words text-[#c5d0de]">{release.message}</p>
          {release.committedAt && <p className="mt-1 text-xs text-[#8b9bb4]">Committed {new Date(release.committedAt).toLocaleString()}</p>}
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={confirmGatedDeployment} className="btn-hv-primary rounded-lg px-3 py-1.5 text-xs font-semibold">Confirm deployment</button>
            <button type="button" onClick={cancelReview} className="btn-hv-secondary rounded-lg px-3 py-1.5 text-xs">Cancel</button>
          </div>
        </div>
      )}
      {buttonState === "started" && successMessage && (
        <span className="text-xs text-emerald-400">{successMessage}</span>
      )}
      {buttonState === "error" && errorMessage && (
        <span className="text-xs text-red-400">{errorMessage}</span>
      )}
    </div>
  );
}
