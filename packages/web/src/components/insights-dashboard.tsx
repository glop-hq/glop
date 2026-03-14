"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useAnalytics } from "@/hooks/use-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RunsTimeSeriesChart } from "@/components/charts/runs-time-series-chart";
import { ActivityBreakdownChart } from "@/components/charts/activity-breakdown-chart";
import { RunBreakdownChart } from "@/components/charts/run-breakdown-chart";
import { DeveloperStatsTable } from "@/components/charts/developer-stats-table";
import { TopReposChart } from "@/components/charts/top-repos-chart";
import { BusiestHoursChart } from "@/components/charts/busiest-hours-chart";
import type { AnalyticsPeriod } from "@glop/shared";

const periods: { value: AnalyticsPeriod; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
];

function KpiCard({
  title,
  value,
  loading,
}: {
  title: string;
  value: string;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <p className="text-2xl font-bold">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  loading,
  children,
  className,
}: {
  title: string;
  loading: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-[300px] w-full" /> : children}
      </CardContent>
    </Card>
  );
}

export function InsightsDashboard() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("7d");
  const { currentWorkspace } = useWorkspaces();
  const { data, loading, error } = useAnalytics(currentWorkspace?.id, period);

  const hasData = data && data.summary.total_runs > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Insights</h1>
        <div className="flex items-center gap-1 rounded-lg border p-1">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1 text-sm font-medium transition-colors",
                period === p.value
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load analytics: {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && !hasData && (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <BarChart3 className="mb-4 h-12 w-12" />
          <p className="text-lg font-medium">No data yet</p>
          <p className="text-sm">
            Run some Claude Code sessions to see insights here.
          </p>
        </div>
      )}

      {/* KPI Cards */}
      {(loading || hasData) && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <KpiCard
              title="Total Runs"
              value={data ? data.summary.total_runs.toLocaleString() : ""}
              loading={loading}
            />
            <KpiCard
              title="Avg Conversation Turns"
              value={
                data ? data.summary.avg_conversation_turns.toString() : ""
              }
              loading={loading}
            />
            <KpiCard
              title="Turns Before Commit"
              value={
                data
                  ? data.summary.avg_turns_before_first_commit > 0
                    ? data.summary.avg_turns_before_first_commit.toString()
                    : "—"
                  : ""
              }
              loading={loading}
            />
            <KpiCard
              title="Commits / Run"
              value={data ? data.summary.commits_per_run.toString() : ""}
              loading={loading}
            />
            <KpiCard
              title="PRs / Run"
              value={data ? data.summary.prs_per_run.toString() : ""}
              loading={loading}
            />
            <KpiCard
              title="Compactions / Run"
              value={data ? data.summary.compactions_per_run.toString() : ""}
              loading={loading}
            />
          </div>

          {/* Runs per Day - full width */}
          <ChartCard title="Runs per Day" loading={loading}>
            {data && <RunsTimeSeriesChart data={data.runs_per_day} />}
          </ChartCard>

          {/* Per-run Breakdown - full width */}
          <ChartCard title="Per-run Breakdown" loading={loading}>
            {data && <RunBreakdownChart data={data.run_breakdown} />}
          </ChartCard>

          {/* Developer Breakdown - admin only, full width */}
          {data?.developer_stats && (
            <ChartCard title="Developer Breakdown" loading={loading}>
              <DeveloperStatsTable data={data.developer_stats} />
            </ChartCard>
          )}

          {/* 2-column grid */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="Activity Breakdown" loading={loading}>
              {data && (
                <ActivityBreakdownChart data={data.activity_breakdown} />
              )}
            </ChartCard>
            <ChartCard title="Busiest Hours" loading={loading}>
              {data && <BusiestHoursChart data={data.busiest_hours} />}
            </ChartCard>
            <ChartCard title="Top Repos" loading={loading}>
              {data && <TopReposChart data={data.top_repos} />}
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
