"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, FolderGit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useRepoDetail } from "@/hooks/use-repo-detail";
import { ScoreBadge } from "./score-badge";
import { RepoDetail } from "./repo-detail";
import { RepoDrillDown } from "./dashboard/repo-drill-down";
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

const tabs = [
  { id: "readiness", label: "Readiness" },
  { id: "analytics", label: "Analytics" },
  { id: "context-health", label: "Context Health" },
] as const;

type TabId = (typeof tabs)[number]["id"];

// --- Repo Context Health (inline, scoped to repo) ---

interface RepoContextHealthData {
  period: string;
  summary: {
    pct_sessions_compacted: number;
    avg_compactions_per_session: number;
    avg_duration_before_first_compaction_min: number | null;
    avg_peak_utilization_pct: number | null;
    pct_sessions_above_80: number | null;
    total_sessions_with_data: number;
    trend: {
      date: string;
      pct_compacted: number;
      avg_compactions: number;
      avg_peak_utilization_pct: number | null;
    }[];
  };
  recommendation: {
    repo_id: string;
    repo_key: string;
    recommended_max_duration_min: number | null;
    confidence: string;
    sample_size: number;
    reasoning: string | null;
  } | null;
}

function useRepoContextHealth(
  workspaceId: string | undefined,
  repoId: string,
  period: AnalyticsPeriod
) {
  const [data, setData] = useState<RepoContextHealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const params = new URLSearchParams({
        workspace_id: workspaceId,
        period,
      });
      const res = await fetch(
        `/api/v1/dashboard/repos/${repoId}/context-health?${params}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, repoId, period]);

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetchData();
  }, [fetchData]);

  return { data, loading };
}

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

function RepoContextHealthTab({
  repoId,
}: {
  repoId: string;
}) {
  const { currentWorkspace } = useWorkspaces();
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");
  const { data, loading } = useRepoContextHealth(
    currentWorkspace?.id,
    repoId,
    period
  );

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex justify-end">
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
        <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
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
            value={data ? `${data.summary.avg_compactions_per_session}` : "—"}
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

      {/* Recommendation */}
      {data?.recommendation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Session Length Recommendation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border p-4 space-y-1">
              <div className="flex items-center gap-2">
                {data.recommendation.recommended_max_duration_min && (
                  <span className="text-lg font-bold">
                    {data.recommendation.recommended_max_duration_min} min
                  </span>
                )}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    data.recommendation.confidence === "high"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : data.recommendation.confidence === "medium"
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                  )}
                >
                  {data.recommendation.confidence} confidence
                </span>
                <span className="text-xs text-muted-foreground">
                  ({data.recommendation.sample_size} sessions)
                </span>
              </div>
              {data.recommendation.reasoning && (
                <p className="text-sm text-muted-foreground">
                  {data.recommendation.reasoning}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// --- Main Unified Repo Detail ---

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function UnifiedRepoDetail({ repoId }: { repoId: string }) {
  const [activeTab, setActiveTab] = useState<TabId>("readiness");
  const { data, loading } = useRepoDetail(repoId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/repos"
            className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to repos
          </Link>
          {loading ? (
            <Skeleton className="h-7 w-48" />
          ) : data ? (
            <div className="flex items-center gap-3">
              <FolderGit2 className="h-6 w-6 text-muted-foreground" />
              <div>
                <h1 className="text-lg font-semibold">
                  {data.repo.display_name || data.repo.repo_key.split("/").pop()}
                </h1>
                <p className="text-sm text-muted-foreground font-mono">
                  {data.repo.repo_key}
                </p>
              </div>
            </div>
          ) : null}
        </div>
        {data?.latest_scan && (
          <div className="text-center">
            <ScoreBadge score={data.latest_scan.score ?? null} size="lg" />
            {data.latest_scan.completed_at && (
              <p className="mt-1 text-xs text-muted-foreground">
                {formatRelativeTime(data.latest_scan.completed_at)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b">
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
      {activeTab === "readiness" && <RepoDetail repoId={repoId} embedded />}
      {activeTab === "analytics" && (
        <RepoDrillDown repoId={repoId} embedded />
      )}
      {activeTab === "context-health" && (
        <RepoContextHealthTab repoId={repoId} />
      )}
    </div>
  );
}
