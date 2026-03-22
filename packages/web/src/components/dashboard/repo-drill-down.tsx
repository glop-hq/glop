"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useRepoDashboard } from "@/hooks/use-repo-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const width = 84;
  const height = 20;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - (v / max) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke="hsl(var(--chart-1))"
        strokeWidth={1.5}
      />
    </svg>
  );
}

function ReadinessScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted-foreground">—</span>;
  const color =
    score >= 70
      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      : score >= 40
        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", color)}>
      {score}
    </span>
  );
}

export function RepoDrillDown({ repoId }: { repoId: string }) {
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");
  const { currentWorkspace } = useWorkspaces();
  const { data, loading } = useRepoDashboard(
    currentWorkspace?.id,
    repoId,
    period
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            {loading ? (
              <Skeleton className="h-7 w-48" />
            ) : (
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">
                  {data?.repo.display_name ?? data?.repo.repo_key ?? "Repo"}
                </h1>
                <ReadinessScoreBadge score={data?.summary.readiness_score ?? null} />
                {data?.repo.language && (
                  <Badge variant="secondary">{data.repo.language}</Badge>
                )}
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {data?.repo.repo_key}
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
        <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
          <KpiStat
            title="Sessions"
            value={String(data?.summary.sessions ?? 0)}
            loading={loading}
            change={data?.summary.sessions_change}
          />
          <KpiStat
            title="Developers"
            value={String(data?.summary.developers ?? 0)}
            loading={loading}
          />
          <KpiStat
            title="Readiness"
            value={
              data?.summary.readiness_score != null
                ? `${data.summary.readiness_score}/100`
                : "—"
            }
            loading={loading}
          />
          <KpiStat
            title="AI Commits"
            value={String(data?.summary.commits ?? 0)}
            loading={loading}
          />
          <KpiStat
            title="AI PRs"
            value={String(data?.summary.prs ?? 0)}
            loading={loading}
          />
        </div>
      </Card>

      {/* Developer Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Developer Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : data?.developer_breakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No developer activity in this period
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Developer</th>
                    <th className="pb-2 font-medium">Sessions</th>
                    <th className="pb-2 font-medium">Commits</th>
                    <th className="pb-2 font-medium">PRs</th>
                    <th className="pb-2 font-medium">Last Active</th>
                    <th className="pb-2 font-medium">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.developer_breakdown.map((dev) => (
                    <tr
                      key={dev.developer_id}
                      className="border-b last:border-0"
                    >
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          {dev.avatar_url ? (
                            <img
                              src={dev.avatar_url}
                              alt={dev.display_name}
                              className="h-6 w-6 rounded-full"
                            />
                          ) : (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                              {dev.display_name.charAt(0).toUpperCase()}
                            </span>
                          )}
                          <span className="font-medium">{dev.display_name}</span>
                        </div>
                      </td>
                      <td className="py-2">{dev.sessions}</td>
                      <td className="py-2">{dev.commits}</td>
                      <td className="py-2">{dev.prs}</td>
                      <td className="py-2 text-muted-foreground">
                        {new Date(dev.last_active).toLocaleDateString()}
                      </td>
                      <td className="py-2">
                        <Sparkline data={dev.sparkline} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Friction & Success */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Top Friction Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : data?.friction_summary.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No friction detected
              </p>
            ) : (
              <div className="space-y-2">
                {data?.friction_summary.slice(0, 5).map((f) => (
                  <div
                    key={f.category}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <span className="text-sm">{f.category.replace(/_/g, " ")}</span>
                    <Badge variant="secondary">{f.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Success Patterns
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : data?.success_patterns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No success patterns detected
              </p>
            ) : (
              <div className="space-y-2">
                {data?.success_patterns.map((p, i) => (
                  <div
                    key={i}
                    className="rounded-md border px-3 py-2 text-sm"
                  >
                    {p}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : data?.activity_timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No activity in this period
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data?.activity_timeline}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                  tickFormatter={(d: string) =>
                    new Date(d + "T00:00:00").toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })
                  }
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                  allowDecimals={false}
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
                  dataKey="sessions"
                  fill="hsl(var(--chart-1))"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
