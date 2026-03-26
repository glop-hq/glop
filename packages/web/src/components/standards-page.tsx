"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Shield } from "lucide-react";
import { SkillsList } from "./skills-list";
import { StandardsUsageDashboard } from "./dashboard/standards-usage-dashboard";

const tabs = [
  { id: "skills", label: "Skills & Commands" },
  { id: "usage", label: "Standards Usage" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function StandardsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("skills");

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Standards</h1>
          <p className="text-sm text-muted-foreground">
            Skills, commands, and standards across your workspace
          </p>
        </div>
        <Link
          href="/standards/mcps"
          className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Shield className="h-4 w-4" />
          MCP Servers
        </Link>
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
      {activeTab === "skills" && <SkillsList />}
      {activeTab === "usage" && <StandardsUsageDashboard embedded />}
    </div>
  );
}
