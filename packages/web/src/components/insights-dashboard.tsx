"use client";

import { useState, useRef, useEffect } from "react";
import { BarChart3, ChevronDown, Table, ScatterChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useAnalytics } from "@/hooks/use-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RunsTimeSeriesChart } from "@/components/charts/runs-time-series-chart";
import { DeveloperStatsTable } from "@/components/charts/developer-stats-table";
import { TopReposChart } from "@/components/charts/top-repos-chart";
import { BusiestHoursChart } from "@/components/charts/busiest-hours-chart";
import { RunsTable } from "@/components/charts/runs-table";
import { EfficiencyScatterChart } from "@/components/charts/efficiency-scatter-chart";
import type { AnalyticsPeriod } from "@glop/shared";

const periods: { value: AnalyticsPeriod; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
];

type RunsView = "table" | "scatter";

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
  actions,
}: {
  title: string;
  loading: boolean;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {actions}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-[300px] w-full" /> : children}
      </CardContent>
    </Card>
  );
}

function DeveloperSelect({
  developers,
  value,
  onChange,
}: {
  developers: { user_id: string; developer_name: string; avatar_url: string | null }[];
  value: string | undefined;
  onChange: (id: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = developers.find((d) => d.user_id === value);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
          value
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {selected?.avatar_url ? (
          <img
            src={selected.avatar_url}
            alt={selected.developer_name}
            className="h-5 w-5 rounded-full"
          />
        ) : null}
        {selected ? selected.developer_name : "Everyone"}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 min-w-[180px] rounded-lg border bg-popover p-1 shadow-md">
          <button
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
            className={cn(
              "w-full cursor-pointer rounded-md px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted",
              !value && "bg-muted font-medium"
            )}
          >
            Everyone
          </button>
          {developers.map((dev) => (
            <button
              key={dev.user_id}
              onClick={() => {
                onChange(dev.user_id);
                setOpen(false);
              }}
              className={cn(
                "w-full cursor-pointer rounded-md px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                value === dev.user_id && "bg-muted font-medium"
              )}
            >
              <span className="flex items-center gap-2">
                {dev.avatar_url ? (
                  <img
                    src={dev.avatar_url}
                    alt={dev.developer_name}
                    className="h-5 w-5 rounded-full"
                  />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                    {dev.developer_name.charAt(0).toUpperCase()}
                  </span>
                )}
                {dev.developer_name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function InsightsDashboard() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("7d");
  const [developerId, setDeveloperId] = useState<string | undefined>();
  const [runsView, setRunsView] = useState<RunsView>("table");
  const { currentWorkspace } = useWorkspaces();
  const { data, loading, error } = useAnalytics(
    currentWorkspace?.id,
    period,
    developerId
  );

  const hasData = data && data.summary.total_runs > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Insights</h1>
        <div className="flex items-center gap-3">
          {/* Developer filter */}
          {data && data.developers.length > 0 && (
            <DeveloperSelect
              developers={data.developers}
              value={developerId}
              onChange={setDeveloperId}
            />
          )}
          {/* Period selector */}
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

          {/* Runs breakdown — table or scatter, with view toggle */}
          <ChartCard
            title="Runs"
            loading={loading}
            actions={
              <div className="flex items-center gap-1 rounded-lg border p-0.5">
                <button
                  onClick={() => setRunsView("table")}
                  className={cn(
                    "cursor-pointer rounded-md p-1.5 transition-colors",
                    runsView === "table"
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Table view"
                >
                  <Table className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setRunsView("scatter")}
                  className={cn(
                    "cursor-pointer rounded-md p-1.5 transition-colors",
                    runsView === "scatter"
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Efficiency scatter"
                >
                  <ScatterChart className="h-3.5 w-3.5" />
                </button>
              </div>
            }
          >
            {data &&
              (runsView === "table" ? (
                <RunsTable data={data.run_breakdown} />
              ) : (
                <EfficiencyScatterChart data={data.run_breakdown} />
              ))}
          </ChartCard>

          {/* Developer Breakdown - full width */}
          {data?.developer_stats && !developerId && (
            <ChartCard title="Developer Breakdown" loading={loading}>
              <DeveloperStatsTable data={data.developer_stats} />
            </ChartCard>
          )}

          {/* 2-column grid */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
