"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useStandardsUsage } from "@/hooks/use-standards-usage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { AnalyticsPeriod, StandardUsageRow } from "@glop/shared";

const periods: { value: AnalyticsPeriod; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
];

const TYPE_COLORS: Record<string, string> = {
  skill: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  command:
    "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  hook: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  agent:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

function KpiStat({
  title,
  value,
  loading,
  change,
  subtitle,
}: {
  title: string;
  value: string;
  loading: boolean;
  change?: number | null;
  subtitle?: string;
}) {
  return (
    <div className="space-y-1 px-6 py-4">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {loading ? (
        <Skeleton className="h-7 w-20" />
      ) : (
        <>
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
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </>
      )}
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        TYPE_COLORS[type] ?? "bg-gray-100 text-gray-800"
      )}
    >
      {type}
    </span>
  );
}

function StandardsTable({
  standards,
  loading,
}: {
  standards: StandardUsageRow[];
  loading: boolean;
}) {
  if (loading) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  if (standards.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        No standard usage detected yet. Skills and commands invoked during
        sessions will appear here.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">Name</th>
            <th className="pb-2 pr-4 font-medium">Type</th>
            <th className="pb-2 pr-4 font-medium text-right">Invocations</th>
            <th className="pb-2 pr-4 font-medium text-right">Developers</th>
            <th className="pb-2 pr-4 font-medium text-right">
              Repos (Active / Installed)
            </th>
            <th className="pb-2 pr-4 font-medium text-right">Effectiveness</th>
            <th className="pb-2 font-medium text-right">Last Used</th>
          </tr>
        </thead>
        <tbody>
          {standards.map((s) => (
            <tr
              key={`${s.standard_name}-${s.standard_type}`}
              className="cursor-pointer border-b last:border-0 hover:bg-muted/50"
            >
              <td className="py-2.5 pr-4 font-medium">{s.standard_name}</td>
              <td className="py-2.5 pr-4">
                <TypeBadge type={s.standard_type} />
              </td>
              <td className="py-2.5 pr-4 text-right tabular-nums">
                {s.invocation_count.toLocaleString()}
              </td>
              <td className="py-2.5 pr-4 text-right tabular-nums">
                {s.unique_developers}
              </td>
              <td className="py-2.5 pr-4 text-right tabular-nums">
                {s.active_repos} / {s.installed_repos || "—"}
              </td>
              <td className="py-2.5 pr-4 text-right tabular-nums">
                {s.effectiveness_score != null ? (
                  <span
                    className={cn(
                      "font-medium",
                      s.effectiveness_score >= 70
                        ? "text-green-600 dark:text-green-400"
                        : s.effectiveness_score >= 40
                          ? "text-yellow-600 dark:text-yellow-400"
                          : "text-muted-foreground"
                    )}
                  >
                    {s.effectiveness_score}%
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="py-2.5 text-right text-muted-foreground">
                {new Date(s.last_used_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StandardsUsageDashboard({ embedded }: { embedded?: boolean } = {}) {
  const { currentWorkspace } = useWorkspaces();
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");
  const { data, loading } = useStandardsUsage(currentWorkspace?.id, period);

  // Compute gap chart data grouped by type
  const gapData = data
    ? (() => {
        const byType: Record<
          string,
          { type: string; installed: number; active: number }
        > = {};
        for (const s of data.standards) {
          const t = s.standard_type;
          if (!byType[t]) byType[t] = { type: t, installed: 0, active: 0 };
          byType[t].installed += s.installed_repos;
          byType[t].active += s.active_repos;
        }
        return Object.values(byType);
      })()
    : [];

  // Top performers and underperformers
  const withEffectiveness = (data?.standards ?? []).filter(
    (s) => s.effectiveness_score != null
  );
  const topPerformers = [...withEffectiveness]
    .sort((a, b) => (b.effectiveness_score ?? 0) - (a.effectiveness_score ?? 0))
    .slice(0, 5);
  const underperformers = [...withEffectiveness]
    .sort((a, b) => (a.effectiveness_score ?? 0) - (b.effectiveness_score ?? 0))
    .slice(0, 5);

  return (
    <div className={cn("space-y-6", !embedded && "mx-auto max-w-7xl px-4 py-8 sm:px-6")}>
      {/* Header */}
      <div className="flex items-center justify-between">
        {!embedded && (
          <div className="flex items-center gap-3">
            <Link
              href="/standards"
              className="cursor-pointer rounded-md p-1 hover:bg-muted"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Standards Usage</h1>
              <p className="text-sm text-muted-foreground">
                Track how skills, commands, and agents are used across your
                workspace
              </p>
            </div>
          </div>
        )}
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
        <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-2 lg:grid-cols-4">
          <KpiStat
            title="Total Invocations"
            value={
              data ? data.summary.total_invocations.toLocaleString() : "—"
            }
            loading={loading}
            change={data?.summary.total_invocations_change}
          />
          <KpiStat
            title="Active Standards"
            value={data ? String(data.summary.active_standards) : "—"}
            loading={loading}
            subtitle="used in period"
          />
          <KpiStat
            title="Installed Standards"
            value={data ? String(data.summary.installed_standards) : "—"}
            loading={loading}
            subtitle="across all repos"
          />
          <KpiStat
            title="Adoption Rate"
            value={data ? `${data.summary.adoption_rate}%` : "—"}
            loading={loading}
            subtitle="active / installed"
          />
        </div>
      </Card>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Usage Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usage Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : data && data.trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data.trend}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) =>
                      new Date(v).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })
                    }
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="invocations"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
                No usage data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Installed vs Active Gap */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Installed vs Active by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : gapData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={gapData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="type"
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar
                    dataKey="installed"
                    fill="hsl(var(--chart-2))"
                    name="Installed"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="active"
                    fill="hsl(var(--chart-1))"
                    name="Active"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
                No data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Standards Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Standards</CardTitle>
        </CardHeader>
        <CardContent>
          <StandardsTable
            standards={data?.standards ?? []}
            loading={loading}
          />
        </CardContent>
      </Card>

      {/* Top Performers / Underperformers */}
      {withEffectiveness.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Performers</CardTitle>
            </CardHeader>
            <CardContent>
              {topPerformers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Not enough data yet
                </p>
              ) : (
                <div className="space-y-3">
                  {topPerformers.map((s) => (
                    <div
                      key={s.standard_name}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <TypeBadge type={s.standard_type} />
                        <span className="text-sm font-medium">
                          {s.standard_name}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">
                        {s.effectiveness_score}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Underperformers</CardTitle>
            </CardHeader>
            <CardContent>
              {underperformers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Not enough data yet
                </p>
              ) : (
                <div className="space-y-3">
                  {underperformers.map((s) => (
                    <div
                      key={s.standard_name}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <TypeBadge type={s.standard_type} />
                        <span className="text-sm font-medium">
                          {s.standard_name}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">
                        {s.effectiveness_score}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
