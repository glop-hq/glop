"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { InsightsDashboard } from "./insights-dashboard";
import { AdoptionDashboard } from "./dashboard/adoption-dashboard";
import { FrictionAnalytics } from "./dashboard/friction-analytics";
import { ContributionsDashboard } from "./dashboard/contributions-dashboard";
import { ContextHealthDashboard } from "./dashboard/context-health-dashboard";

const tabs = [
  { id: "sessions", label: "Sessions" },
  { id: "adoption", label: "Adoption" },
  { id: "friction", label: "Friction" },
  { id: "contributions", label: "Contributions" },
  { id: "context-health", label: "Context Health" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function InsightsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("sessions");

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Insights</h1>
        <p className="text-sm text-muted-foreground">
          Session analytics, adoption trends, and team performance
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b mb-6">
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "cursor-pointer px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                activeTab === tab.id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "sessions" && <InsightsDashboard />}
      {activeTab === "adoption" && <AdoptionDashboard embedded />}
      {activeTab === "friction" && <FrictionAnalytics embedded />}
      {activeTab === "contributions" && <ContributionsDashboard embedded />}
      {activeTab === "context-health" && <ContextHealthDashboard embedded />}
    </div>
  );
}
