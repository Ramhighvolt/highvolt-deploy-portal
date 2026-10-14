"use client";

import { useState } from "react";

type DeployButtonProps = {
  websiteId: string;
  websiteName: string;
  disabled?: boolean;
};

type ButtonState = "ready" | "loading" | "started" | "error";

export default function DeployButton({
  websiteId,
  websiteName,
  disabled = false,
}: DeployButtonProps) {
  const [buttonState, setButtonState] = useState<ButtonState>("ready");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleDeploy() {
    const confirmed = window.confirm(
      `Deploy ${websiteName} to production?\n\nThis will trigger a GitHub Actions workflow.`
    );
    if (!confirmed) return;

    let releaseCommit: string | undefined;
    let confirmProduction: string | undefined;
    if (websiteId === "quantum-ledgerline") {
      releaseCommit = window.prompt("Enter the exact 40-character commit SHA from main:") ?? undefined;
      if (!releaseCommit) return;
      if (!/^[a-f0-9]{40}$/.test(releaseCommit)) {
        setButtonState("error");
        setErrorMessage("Enter a valid 40-character lowercase commit SHA.");
        return;
      }
      confirmProduction = window.prompt("Type DEPLOY to confirm this Ledgerline production release:") ?? undefined;
      if (confirmProduction !== "DEPLOY") return;
    }

    setButtonState("loading");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, ...(releaseCommit ? { releaseCommit, confirmProduction } : {}) }),
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

  const label = {
    ready: "Deploy",
    loading: "Initializing deployment...",
    started: "Queued",
    error: "Failed",
  }[buttonState];

  const classes = {
    ready: "btn-hv-primary",
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
        disabled={disabled || buttonState === "loading" || buttonState === "started"}
        className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all disabled:opacity-80 ${classes}`}
      >
        {buttonState === "loading" && (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#2a3548] border-t-[#60a5fa]" />
        )}
        {label}
      </button>
      <span className="text-xs text-[#6b7d96]">{disabled ? "Disabled by the server-side production gate" : "Production action"}</span>
      {buttonState === "started" && successMessage && (
        <span className="text-xs text-emerald-400">{successMessage}</span>
      )}
      {buttonState === "error" && errorMessage && (
        <span className="text-xs text-red-400">{errorMessage}</span>
      )}
    </div>
  );
}
