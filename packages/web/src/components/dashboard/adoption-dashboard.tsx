"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useDashboard } from "@/hooks/use-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AdoptionTrendChart } from "./adoption-trend-chart";
import { ActivityByRepoChart } from "./activity-by-repo-chart";
import { SessionOutcomeChart } from "./session-outcome-chart";
import { RepoHeatmapChart } from "./repo-heatmap-chart";
import { DigestSettings } from "./digest-settings";
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

export function AdoptionDashboard() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");
  const { currentWorkspace } = useWorkspaces();
  const { data, loading } = useDashboard(currentWorkspace?.id, period);
  const router = useRouter();

  const handleRepoClick = (repoId: string) => {
    router.push(`/dashboard/repos/${repoId}`);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            AI coding adoption across your workspace
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Summary Cards */}
      <Card>
        <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
          <KpiStat
            title="Active Developers"
            value={String(data?.summary.active_developers ?? 0)}
            loading={loading}
            change={data?.summary.active_developers_change}
          />
          <KpiStat
            title="Active Repos"
            value={String(data?.summary.active_repos ?? 0)}
            loading={loading}
            change={data?.summary.active_repos_change}
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
          <KpiStat
            title="AI PRs"
            value={String(data?.summary.ai_prs ?? 0)}
            loading={loading}
            change={data?.summary.ai_prs_change}
          />
        </div>
      </Card>

      {/* Readiness (if available) */}
      {data?.summary.avg_readiness != null && (
        <div className="text-sm text-muted-foreground">
          Average readiness score: <span className="font-medium text-foreground">{data.summary.avg_readiness}</span>/100
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Adoption Trend"
          loading={loading}
          className="lg:col-span-2"
        >
          {data && (
            <AdoptionTrendChart data={data.adoption_trend} period={period} />
          )}
        </ChartCard>

        <ChartCard title="Activity by Repo" loading={loading}>
          {data && (
            <ActivityByRepoChart
              data={data.activity_by_repo}
              onRepoClick={handleRepoClick}
            />
          )}
        </ChartCard>

        <ChartCard title="Session Outcomes" loading={loading}>
          {data && <SessionOutcomeChart data={data.session_outcomes} />}
        </ChartCard>
      </div>

      {/* Heatmap — full width */}
      <ChartCard title="Repo Activity Heatmap" loading={loading}>
        {data && (
          <RepoHeatmapChart
            data={data.repo_heatmap}
            onRepoClick={handleRepoClick}
          />
        )}
      </ChartCard>

      {/* Quick Links */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/dashboard/insights"
          className="cursor-pointer rounded-lg border p-4 transition-colors hover:bg-muted"
        >
          <p className="font-medium">Friction & Success Insights</p>
          <p className="text-sm text-muted-foreground">
            See where AI coding struggles and thrives
          </p>
        </Link>
        <Link
          href="/dashboard/contributions"
          className="cursor-pointer rounded-lg border p-4 transition-colors hover:bg-muted"
        >
          <p className="font-medium">AI Contributions</p>
          <p className="text-sm text-muted-foreground">
            Commits and PRs produced via Glop sessions
          </p>
        </Link>
      </div>

      {/* Digest Settings */}
      <DigestSettings />
    </div>
  );
}
