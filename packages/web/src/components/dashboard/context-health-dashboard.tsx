"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useContextHealth } from "@/hooks/use-context-health";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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
  subtitle,
}: {
  title: string;
  value: string;
  loading: boolean;
  subtitle?: string;
}) {
  return (
    <div className="space-y-1 px-6 py-4">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {loading ? (
        <Skeleton className="h-7 w-20" />
      ) : (
        <>
          <p className="text-xl font-bold">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </>
      )}
    </div>
  );
}

export function ContextHealthDashboard() {
  const { currentWorkspace } = useWorkspaces();
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");
  const { data, loading } = useContextHealth(currentWorkspace?.id, period);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/overview"
            className="cursor-pointer rounded-md p-1 hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Context Health</h1>
            <p className="text-sm text-muted-foreground">
              Compaction rates and session length recommendations
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

      {/* KPI Cards */}
      <Card>
        <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-3 lg:grid-cols-6">
          <KpiStat
            title="Avg Peak Utilization"
            value={
              data?.summary.avg_peak_utilization_pct != null
                ? `${data.summary.avg_peak_utilization_pct}%`
                : "—"
            }
            loading={loading}
            subtitle="of context window"
          />
          <KpiStat
            title="Sessions > 80%"
            value={
              data?.summary.pct_sessions_above_80 != null
                ? `${data.summary.pct_sessions_above_80}%`
                : "—"
            }
            loading={loading}
            subtitle="hit danger zone"
          />
          <KpiStat
            title="Sessions Compacted"
            value={data ? `${data.summary.pct_sessions_compacted}%` : "—"}
            loading={loading}
          />
          <KpiStat
            title="Avg Compactions"
            value={
              data ? `${data.summary.avg_compactions_per_session}` : "—"
            }
            loading={loading}
            subtitle="per session"
          />
          <KpiStat
            title="Time to 1st Compaction"
            value={
              data?.summary.avg_duration_before_first_compaction_min != null
                ? `${data.summary.avg_duration_before_first_compaction_min} min`
                : "—"
            }
            loading={loading}
          />
          <KpiStat
            title="Sessions Tracked"
            value={data ? `${data.summary.total_sessions_with_data}` : "—"}
            loading={loading}
          />
        </div>
      </Card>

      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Context Health Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : data && data.summary.trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.summary.trend}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                  unit="%"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value, name) => [
                    value != null ? `${value}%` : "—",
                    name,
                  ]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="pct_compacted"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={false}
                  name="% Compacted"
                />
                <Line
                  type="monotone"
                  dataKey="avg_peak_utilization_pct"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  dot={false}
                  name="Avg Peak Utilization"
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No context health data yet. Data appears as sessions complete.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Repo Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Context Health by Repo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : data && data.by_repo.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Repo</th>
                    <th className="pb-2 pr-4 font-medium">Sessions</th>
                    <th className="pb-2 pr-4 font-medium">Avg Peak</th>
                    <th className="pb-2 pr-4 font-medium">&gt; 80%</th>
                    <th className="pb-2 pr-4 font-medium">% Compacted</th>
                    <th className="pb-2 pr-4 font-medium">
                      Avg Compactions
                    </th>
                    <th className="pb-2 font-medium">Avg Time to 1st</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_repo.map((repo) => (
                    <tr key={repo.repo_id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">
                        {repo.repo_key.split("/").pop()}
                      </td>
                      <td className="py-2 pr-4">
                        {repo.total_sessions_with_data}
                      </td>
                      <td className="py-2 pr-4">
                        {repo.avg_peak_utilization_pct != null ? (
                          <span
                            className={cn(
                              repo.avg_peak_utilization_pct > 80
                                ? "text-red-600 dark:text-red-400"
                                : repo.avg_peak_utilization_pct > 60
                                  ? "text-yellow-600 dark:text-yellow-400"
                                  : "text-green-600 dark:text-green-400"
                            )}
                          >
                            {repo.avg_peak_utilization_pct}%
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {repo.pct_sessions_above_80 != null
                          ? `${repo.pct_sessions_above_80}%`
                          : "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={cn(
                            repo.pct_sessions_compacted > 50
                              ? "text-red-600 dark:text-red-400"
                              : repo.pct_sessions_compacted > 25
                                ? "text-yellow-600 dark:text-yellow-400"
                                : "text-green-600 dark:text-green-400"
                          )}
                        >
                          {repo.pct_sessions_compacted}%
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        {repo.avg_compactions_per_session}
                      </td>
                      <td className="py-2">
                        {repo.avg_duration_before_first_compaction_min != null
                          ? `${repo.avg_duration_before_first_compaction_min} min`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No repo data yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recommendations */}
      {data && data.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Session Length Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recommendations.map((rec) => (
              <div
                key={rec.repo_id}
                className="rounded-lg border p-4 space-y-1"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {rec.repo_key.split("/").pop()}
                  </span>
                  {rec.recommended_max_duration_min && (
                    <span className="text-lg font-bold">
                      {rec.recommended_max_duration_min} min
                    </span>
                  )}
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      rec.confidence === "high"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : rec.confidence === "medium"
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                    )}
                  >
                    {rec.confidence} confidence
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({rec.sample_size} sessions)
                  </span>
                </div>
                {rec.reasoning && (
                  <p className="text-sm text-muted-foreground">
                    {rec.reasoning}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
