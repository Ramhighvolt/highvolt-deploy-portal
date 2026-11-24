import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { consoleEnabled } from "@/lib/console/config";

export const metadata: Metadata = { title: "Console", robots: { index: false, follow: false } };

export default function ConsoleRoot({ children }: { children: React.ReactNode }) {
  if (!consoleEnabled()) notFound();
  return <>{children}</>;
}
