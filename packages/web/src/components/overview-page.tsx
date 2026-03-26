"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Radio } from "lucide-react";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useDashboard } from "@/hooks/use-dashboard";
import { useLiveBoard } from "@/hooks/use-live-board";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AdoptionTrendChart } from "./dashboard/adoption-trend-chart";
import { CoachingTipsCard } from "./dashboard/coaching-tips-card";
import { SuggestionsCard } from "./dashboard/suggestions-card";
import type { AnalyticsPeriod } from "@glop/shared";

const periods: { value: AnalyticsPeriod; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
];

function KpiStat({
  title,
  value,
  loading,
  change,
}: {
  title: string;
  value: string;
  loading: boolean;
  change?: number | null;
}) {
  return (
    <div className="space-y-1 px-6 py-4">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {loading ? (
        <Skeleton className="h-7 w-20" />
      ) : (
        <div className="flex items-baseline gap-2">
          <p className="text-xl font-bold">{value}</p>
          {change != null && (
            <span
              className={cn(
                "text-xs font-medium",
                change > 0
                  ? "text-green-600 dark:text-green-400"
                  : change < 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-muted-foreground"
              )}
            >
              {change > 0 ? "+" : ""}
              {change}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function OverviewPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");
  const { currentWorkspace } = useWorkspaces();
  const { data, loading } = useDashboard(currentWorkspace?.id, period);
  const { data: liveData } = useLiveBoard(currentWorkspace?.id);

  const activeCount = liveData?.runs.length ?? 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-sm text-muted-foreground">
            AI coding adoption across your workspace
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Live sessions badge */}
          <Link
            href="/sessions"
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted",
              activeCount > 0
                ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
                : "text-muted-foreground"
            )}
          >
            <Radio className={cn("h-3.5 w-3.5", activeCount > 0 && "animate-pulse")} />
            {activeCount} live {activeCount === 1 ? "session" : "sessions"}
          </Link>
          {/* Period selector */}
          <div className="flex rounded-lg border bg-muted p-0.5">
            {periods.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={cn(
                  "cursor-pointer rounded-md px-3 py-1 text-sm font-medium transition-colors",
                  period === p.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <Card>
        <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-2 lg:grid-cols-4 lg:divide-y-0">
          <KpiStat
            title="Active Developers"
            value={String(data?.summary.active_developers ?? 0)}
            loading={loading}
            change={data?.summary.active_developers_change}
          />
          <KpiStat
            title="Total Sessions"
            value={String(data?.summary.total_sessions ?? 0)}
            loading={loading}
            change={data?.summary.total_sessions_change}
          />
          <KpiStat
            title="Effectiveness"
            value={data ? `${data.summary.avg_effectiveness}%` : "0%"}
            loading={loading}
            change={data?.summary.avg_effectiveness_change}
          />
          <KpiStat
            title="AI Commits"
            value={String(data?.summary.ai_commits ?? 0)}
            loading={loading}
            change={data?.summary.ai_commits_change}
          />
        </div>
      </Card>

      {/* Adoption Trend (compact) */}
      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : data ? (
            <AdoptionTrendChart data={data.adoption_trend} period={period} />
          ) : null}
        </CardContent>
      </Card>

      {/* Coaching & Suggestions */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CoachingTipsCard workspaceId={currentWorkspace?.id} />
        <SuggestionsCard workspaceId={currentWorkspace?.id} />
      </div>
    </div>
  );
}
