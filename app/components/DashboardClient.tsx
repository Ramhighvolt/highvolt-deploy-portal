"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DeploymentsSection, {
  type DeployFilter,
} from "./DeploymentsSection";
import Header from "./Header";
import HealthSection from "./HealthSection";
import LogsSection from "./LogsSection";
import OverviewSection from "./OverviewSection";
import SettingsSection from "./SettingsSection";
import Sidebar from "./Sidebar";
import SyncWarning from "./SyncWarning";
import WebsitesSection from "./WebsitesSection";
import { type AppSection } from "@/lib/navigation";
import { getStatusVariant, type WebsiteStatus } from "@/lib/status";

type StatusResponse = {
  success: boolean;
  websites: WebsiteStatus[];
  error?: string;
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export default function DashboardClient() {
  const [activeSection, setActiveSection] = useState<AppSection>("overview");
  const [deployFilter, setDeployFilter] = useState<DeployFilter>("all");
  const [websites, setWebsites] = useState<WebsiteStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncWarning, setSyncWarning] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const mountedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchStatus = useCallback(async (isInitial = false) => {
    abortControllerRef.current?.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (!isInitial) setIsRefreshing(true);

    try {
      const response = await fetch("/api/status", {
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data: StatusResponse = await response.json();
      if (!data.success) throw new Error(data.error || "Status unavailable");

      if (!mountedRef.current || controller.signal.aborted) return;

      setWebsites(data.websites);
      setLastRefresh(new Date());
      setSyncWarning(false);
    } catch (error) {
      if (!mountedRef.current || controller.signal.aborted || isAbortError(error)) {
        return;
      }
      setSyncWarning(true);
    } finally {
      if (!mountedRef.current || controller.signal.aborted) return;
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchStatus(true);

    const interval = window.setInterval(() => fetchStatus(false), 15000);

    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
      window.clearInterval(interval);
    };
  }, [fetchStatus]);

  const healthyCount = websites.filter(
    (s) => getStatusVariant(s.githubStatus) === "success"
  ).length;
  const deployingCount = websites.filter(
    (s) => getStatusVariant(s.githubStatus) === "deploying"
  ).length;
  const attentionCount = websites.filter(
    (s) => getStatusVariant(s.githubStatus) === "failed"
  ).length;

  const sectionProps = {
    websites,
    loading,
    isRefreshing,
    onRefresh: () => fetchStatus(false),
    onNavigate: setActiveSection,
    healthyCount,
    deployingCount,
    attentionCount,
  };

  return (
    <div className="deploy-os-bg relative min-h-screen text-[#f0f4f8]">
      <Sidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />

      <div className="relative z-10 lg:pl-[260px]">
        <Header
          activeSection={activeSection}
          lastRefresh={lastRefresh}
          websites={websites}
          isRefreshing={isRefreshing}
        />

        <SyncWarning visible={syncWarning && !loading} />

        <main className="section-enter px-5 py-6 pb-24 lg:px-8 lg:pb-6">
          <div className="mx-auto max-w-[1200px]">
            {activeSection === "overview" && (
              <OverviewSection {...sectionProps} />
            )}
            {activeSection === "websites" && (
              <WebsitesSection {...sectionProps} />
            )}
            {activeSection === "deployments" && (
              <DeploymentsSection
                {...sectionProps}
                filter={deployFilter}
                onFilterChange={setDeployFilter}
              />
            )}
            {activeSection === "logs" && <LogsSection {...sectionProps} />}
            {activeSection === "health" && <HealthSection {...sectionProps} />}
            {activeSection === "settings" && <SettingsSection />}
          </div>
        </main>
      </div>
    </div>
  );
}
