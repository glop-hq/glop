"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useFrictionInsights } from "@/hooks/use-friction-insights";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { AnalyticsPeriod, FrictionInsight, FrictionStatus } from "@glop/shared";

const periods: { value: AnalyticsPeriod; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
];

const STATUS_OPTIONS: { value: FrictionStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "resolved", label: "Resolved" },
  { value: "wont_fix", label: "Won't Fix" },
];

function SeverityBadge({ severity }: { severity: number }) {
  const color =
    severity >= 7
      ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      : severity >= 5
        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
        : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
  const label = severity >= 7 ? "High" : severity >= 5 ? "Medium" : "Low";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", color)}>
      {label}
    </span>
  );
}

function FrictionCard({
  insight,
  workspaceId,
  onStatusChange,
}: {
  insight: FrictionInsight;
  workspaceId: string;
  onStatusChange: () => void;
}) {
  const [updating, setUpdating] = useState(false);

  const handleStatusChange = async (status: FrictionStatus) => {
    setUpdating(true);
    try {
      await fetch(`/api/v1/dashboard/insights/${insight.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, status }),
      });
      onStatusChange();
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <SeverityBadge severity={insight.severity} />
            <span className="text-sm font-medium">
              {insight.category.replace(/_/g, " ")}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {insight.description}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold">{Math.round(insight.impact_score)}</p>
          <p className="text-xs text-muted-foreground">impact</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{insight.frequency} occurrence{insight.frequency !== 1 ? "s" : ""}</span>
        {insight.repo_key && (
          <>
            <span>·</span>
            {insight.repo_id ? (
              <Link
                href={`/repos/${insight.repo_id}`}
                className="cursor-pointer text-foreground underline-offset-2 hover:underline"
              >
                {insight.repo_key}
              </Link>
            ) : (
              <span>{insight.repo_key}</span>
            )}
          </>
        )}
        {insight.affected_areas.length > 0 && (
          <>
            <span>·</span>
            <span>{insight.affected_areas.join(", ")}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <select
          value={insight.status}
          onChange={(e) => handleStatusChange(e.target.value as FrictionStatus)}
          disabled={updating}
          className="cursor-pointer rounded-md border bg-background px-2 py-1 text-xs"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function FrictionAnalytics() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");
  const { currentWorkspace } = useWorkspaces();
  const { data, loading, refetch } = useFrictionInsights(
    currentWorkspace?.id,
    period
  );

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
            <h1 className="text-2xl font-bold">Friction & Success Insights</h1>
            <p className="text-sm text-muted-foreground">
              Where AI coding struggles and where it thrives
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

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Friction Points */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Top Friction Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : data?.friction_points.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No friction points detected in this period
              </p>
            ) : (
              <div className="space-y-3">
                {data?.friction_points.map((insight) => (
                  <FrictionCard
                    key={insight.id}
                    insight={insight}
                    workspaceId={currentWorkspace?.id ?? ""}
                    onStatusChange={refetch}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Success Patterns */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Success Patterns
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : data?.success_patterns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No success patterns detected in this period
              </p>
            ) : (
              <div className="space-y-3">
                {data?.success_patterns.map((pattern, i) => (
                  <div
                    key={i}
                    className="rounded-lg border p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{pattern.pattern}</p>
                      <Badge variant="secondary">
                        {pattern.count}x
                      </Badge>
                    </div>
                    {pattern.areas.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Areas: {pattern.areas.join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Hotspot Map */}
      {data && data.hotspot_map.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Code Area Hotspots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.hotspot_map.map((entry) => {
                const frictionRatio =
                  entry.session_count > 0
                    ? entry.friction_count / entry.session_count
                    : 0;
                return (
                  <div
                    key={entry.area}
                    className={cn(
                      "rounded-lg border p-3",
                      frictionRatio > 1
                        ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
                        : frictionRatio > 0.5
                          ? "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950"
                          : ""
                    )}
                  >
                    <p className="text-sm font-medium">{entry.area}</p>
                    <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                      <span>{entry.session_count} sessions</span>
                      <span>{entry.friction_count} friction events</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
