"use client";

import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useMcpDetail } from "@/hooks/use-mcp-detail";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { AnalyticsPeriod, McpStatus } from "@glop/shared";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const periods: { value: AnalyticsPeriod; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
];

const STATUS_COLORS: Record<McpStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  flagged: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  blocked: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const STATUS_OPTIONS: McpStatus[] = ["pending", "approved", "flagged", "blocked"];

export function McpDetail() {
  const params = useParams();
  const searchParams = useSearchParams();
  const mcpId = params.id as string;
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");
  const { currentWorkspace } = useWorkspaces();
  const workspaceId =
    searchParams.get("workspace_id") ?? currentWorkspace?.id;
  // Admin enforcement is server-side; show controls to all members
  const isAdmin = true;

  const { data, loading, refetch } = useMcpDetail(mcpId, workspaceId, period);

  const [updating, setUpdating] = useState(false);

  const handleStatusChange = async (status: string) => {
    if (!workspaceId) return;
    setUpdating(true);
    try {
      await fetch(`/api/v1/mcps/${mcpId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, status }),
      });
      refetch();
    } finally {
      setUpdating(false);
    }
  };

  const mcp = data?.mcp;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/standards/mcps"
            className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            {loading ? (
              <Skeleton className="h-7 w-48" />
            ) : (
              <h1 className="text-2xl font-bold">
                {mcp?.display_name || mcp?.aliases[0] || mcp?.canonical_id}
              </h1>
            )}
            {mcp && (
              <p className="text-sm text-muted-foreground">
                {mcp.canonical_id}
              </p>
            )}
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

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      ) : mcp ? (
        <>
          {/* Info Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {isAdmin ? (
                    <select
                      value={mcp.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      disabled={updating}
                      className="cursor-pointer mt-1 rounded-md border bg-background px-2 py-1 text-sm"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className={cn(
                        "mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                        STATUS_COLORS[mcp.status]
                      )}
                    >
                      {mcp.status}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Transport</p>
                  <p className="text-sm font-medium mt-1">{mcp.transport.toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Calls</p>
                  <p className="text-sm font-medium mt-1">{mcp.usage_count}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Error Rate</p>
                  <p className="text-sm font-medium mt-1">
                    {mcp.usage_count > 0
                      ? `${Math.round((mcp.error_count / mcp.usage_count) * 100)}%`
                      : "—"}
                  </p>
                </div>
              </div>
              {mcp.description && (
                <p className="mt-4 text-sm text-muted-foreground">
                  {mcp.description}
                </p>
              )}
              {mcp.setup_guidance && (
                <div className="mt-4 rounded-lg bg-muted p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Setup Guidance
                  </p>
                  <p className="text-sm">{mcp.setup_guidance}</p>
                </div>
              )}
              {mcp.status_note && (
                <p className="mt-2 text-xs text-muted-foreground italic">
                  Note: {mcp.status_note}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Usage Chart */}
          {data.usage_timeline.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Usage Over Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.usage_timeline}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v: string) =>
                        new Date(v).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })
                      }
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar
                      dataKey="calls"
                      fill="hsl(var(--chart-1))"
                      radius={[4, 4, 0, 0]}
                      name="Calls"
                    />
                    <Bar
                      dataKey="errors"
                      fill="hsl(var(--chart-5))"
                      radius={[4, 4, 0, 0]}
                      name="Errors"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Tools, Repos, Developers */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Tools */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Tools ({mcp.tools.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {mcp.tools.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tools recorded</p>
                ) : (
                  <div className="space-y-2">
                    {mcp.tools.map((tool) => (
                      <div
                        key={tool.id}
                        className="flex items-center justify-between rounded-lg border p-2"
                      >
                        <span className="text-sm font-mono truncate">
                          {tool.tool_name}
                        </span>
                        <Badge variant="secondary" className="shrink-0">
                          {tool.call_count} calls
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Repos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Repos ({data.repos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.repos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No repo usage</p>
                ) : (
                  <div className="space-y-2">
                    {data.repos.map((repo) => (
                      <div
                        key={repo.repo_id}
                        className="flex items-center justify-between rounded-lg border p-2"
                      >
                        <span className="text-sm truncate">{repo.repo_key}</span>
                        <Badge variant="secondary" className="shrink-0">
                          {repo.call_count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Developers */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Developers ({data.developers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.developers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No developer usage</p>
                ) : (
                  <div className="space-y-2">
                    {data.developers.map((dev) => (
                      <div
                        key={dev.developer_id}
                        className="flex items-center justify-between rounded-lg border p-2"
                      >
                        <span className="text-sm truncate">
                          {dev.display_name ?? "Unknown"}
                        </span>
                        <Badge variant="secondary" className="shrink-0">
                          {dev.call_count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">MCP not found</p>
      )}
    </div>
  );
}
