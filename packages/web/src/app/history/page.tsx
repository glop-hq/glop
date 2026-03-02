"use client";

import { useState } from "react";
import { NavHeader } from "@/components/nav-header";
import { HistoryTable } from "@/components/history-table";
import { cn } from "@/lib/utils";

const tabs = [
  { key: "mine" as const, label: "Private" },
  { key: "team" as const, label: "Shared" },
];

export default function HistoryPage() {
  const [scope, setScope] = useState<"mine" | "team">("mine");

  return (
    <div className="min-h-screen">
      <NavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-4">
          <h1 className="text-lg font-semibold">Past Runs</h1>
          <p className="text-sm text-muted-foreground">
            Completed and failed development sessions
          </p>
        </div>
        <div className="mb-4 flex gap-4 border-b">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setScope(tab.key)}
              className={cn(
                "cursor-pointer px-1 pb-2 text-sm font-medium transition-colors",
                scope === tab.key
                  ? "border-b-2 border-foreground text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <HistoryTable scope={scope} />
      </main>
    </div>
  );
}
