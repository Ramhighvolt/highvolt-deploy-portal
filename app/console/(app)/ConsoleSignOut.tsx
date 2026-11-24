"use client";

export default function ConsoleSignOut() {
  return (
    <button
      type="button"
      className="rounded-lg border border-[#2a3548] px-3 py-1.5 text-xs font-semibold text-[#f0f4f8] hover:bg-[#1c2535]"
      onClick={async () => {
        try {
          await fetch("/api/console/logout", { method: "POST", credentials: "same-origin" });
        } finally {
          window.location.assign("/console/login");
        }
      }}
    >
      Sign out
    </button>
  );
}
