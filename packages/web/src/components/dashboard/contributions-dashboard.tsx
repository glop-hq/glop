"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useContributions } from "@/hooks/use-contributions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
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

export function ContributionsDashboard() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");
  const { currentWorkspace } = useWorkspaces();
  const { data, loading } = useContributions(currentWorkspace?.id, period);

  const chartData = data?.by_repo
    .filter((r) => r.ai_commits > 0 || r.ai_prs > 0)
    .slice(0, 15)
    .map((r) => ({
      name: r.repo_key.split("/").pop() ?? r.repo_key,
      commits: r.ai_commits,
      prs: r.ai_prs,
    }));

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/overview"
            className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">AI Contributions</h1>
            <p className="text-sm text-muted-foreground">
              Commits and PRs produced via Glop sessions
            </p>
          </div>
        </div>
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

      {/* Summary Cards */}
      <Card>
        <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0">
          <KpiStat
            title="AI Commits"
            value={String(data?.summary.total_ai_commits ?? 0)}
            loading={loading}
            change={data?.summary.ai_commits_change}
          />
          <KpiStat
            title="AI PRs"
            value={String(data?.summary.total_ai_prs ?? 0)}
            loading={loading}
            change={data?.summary.ai_prs_change}
          />
          <KpiStat
            title="Sessions with Output"
            value={String(data?.summary.sessions_with_commits ?? 0)}
            loading={loading}
          />
          <KpiStat
            title="Total Sessions"
            value={String(data?.summary.total_sessions ?? 0)}
            loading={loading}
          />
        </div>
      </Card>

      {/* Chart */}
      {chartData && chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              AI Output by Repo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
                <XAxis type="number" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                  width={120}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar
                  dataKey="commits"
                  name="Commits"
                  fill="hsl(var(--chart-1))"
                  stackId="output"
                />
                <Bar
                  dataKey="prs"
                  name="PRs"
                  fill="hsl(var(--chart-2))"
                  stackId="output"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Per-repo table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Per-Repo Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : data?.by_repo.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data in this period</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Repo</th>
                    <th className="pb-2 font-medium">AI Commits</th>
                    <th className="pb-2 font-medium">AI PRs</th>
                    <th className="pb-2 font-medium">Sessions</th>
                    <th className="pb-2 font-medium">Sessions w/ Commits</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.by_repo.map((repo) => (
                    <tr key={repo.repo_id} className="border-b last:border-0">
                      <td className="py-2">
                        <Link
                          href={`/repos/${repo.repo_id}`}
                          className="cursor-pointer font-medium text-foreground underline-offset-2 hover:underline"
                        >
                          {repo.display_name ?? repo.repo_key}
                        </Link>
                      </td>
                      <td className="py-2">{repo.ai_commits}</td>
                      <td className="py-2">{repo.ai_prs}</td>
                      <td className="py-2">{repo.sessions}</td>
                      <td className="py-2">{repo.sessions_with_commits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
