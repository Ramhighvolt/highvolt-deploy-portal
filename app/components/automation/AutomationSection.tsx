"use client";

import { useState, type ReactNode } from "react";
import QuantumAgentRunner from "./QuantumAgentRunner";
import XeroRunner from "./XeroRunner";

type View = "hub" | "xero" | "quantum-agent";

const CARDS: {
  id: Exclude<View, "hub">;
  title: string;
  description: string;
  chips: string[];
  icon: ReactNode;
}[] = [
  {
    id: "xero",
    title: "Xero Report Automation",
    description:
      "Download Profit & Loss, Balance Sheet and more for Pactify, Clima or Other. Files land here and in OneDrive.",
    chips: ["3 tenants", "8 reports", "Excel · CSV · JSON"],
    icon: <span className="text-sm font-bold text-[#60a5fa]">X</span>,
  },
  {
    id: "quantum-agent",
    title: "Quantum Agent",
    description:
      "Run the UI test suite on Staging, Preview or QA. Pick one feature or everything, then watch it live.",
    chips: ["27 features", "Live progress", "Reports + screenshots"],
    icon: <span className="text-sm font-bold text-[#60a5fa]">QA</span>,
  },
];

export default function AutomationSection() {
  const [view, setView] = useState<View>("hub");

  if (view !== "hub") {
    const card = CARDS.find((c) => c.id === view)!;
    return (
      <div className="space-y-5">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
          <button type="button" onClick={() => setView("hub")} className="flex items-center gap-1.5 text-[#8b9bb4] transition-colors hover:text-[#60a5fa]">
            <span aria-hidden>←</span> Automation
          </button>
          <span className="text-[#4b5b73]">/</span>
          <span className="font-medium text-[#f0f4f8]">{card.title}</span>
        </nav>
        {view === "xero" ? <XeroRunner /> : <QuantumAgentRunner />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#8b9bb4]">
        {CARDS.length} automations · click a card to open it. Runs execute on GitHub Actions and update here live.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {CARDS.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => setView(card.id)}
            className="hv-card group flex min-h-[148px] flex-col gap-3 rounded-xl px-5 py-5 text-left"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#2a3548] bg-[#1c2535] transition-transform duration-200 group-hover:scale-105">
                {card.icon}
              </div>
              <h3 className="min-w-0 flex-1 text-base font-semibold leading-snug text-[#f0f4f8]">{card.title}</h3>
              <span className="text-[#6b7d96] transition-all group-hover:translate-x-0.5 group-hover:text-[#60a5fa]" aria-hidden>→</span>
            </div>
            <p className="text-sm leading-relaxed text-[#8b9bb4]">{card.description}</p>
            <div className="mt-auto flex flex-wrap gap-1.5">
              {card.chips.map((c) => (
                <span key={c} className="hv-badge text-[#8b9bb4]">{c}</span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
