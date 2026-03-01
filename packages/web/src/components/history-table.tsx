"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { HistoryResponse, Run, ArtifactInfo } from "@glop/shared";
import { PhaseBadge } from "./phase-badge";
import { StatusBadge } from "./status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return "-";
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  const diffMs = end - start;

  if (diffMs < 60000) return `${Math.round(diffMs / 1000)}s`;
  if (diffMs < 3600000) return `${Math.round(diffMs / 60000)}m`;
  return `${(diffMs / 3600000).toFixed(1)}h`;
}

export function HistoryTable() {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const res = await fetch("/api/v1/history?limit=50");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {data?.total || 0} completed runs
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchData(true)}
          disabled={refreshing}
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5 mr-1", refreshing && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

      {!data || data.runs.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 text-muted-foreground">
          <Clock className="h-8 w-8 mb-3 opacity-40" />
          <p className="text-sm">No completed runs yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Developer
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Repo / Branch
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Title
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Completed
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {data.runs.map((run) => (
                <tr
                  key={run.id}
                  className="border-b cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() => router.push(`/runs/${run.id}`)}
                >
                  <td className="px-4 py-3 text-sm">
                    {run.git_user_name || run.developer_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-mono">{run.repo_key}</span>
                    <span className="text-xs text-muted-foreground ml-1">
                      {run.branch_name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {run.title || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDuration(run.started_at, run.completed_at)}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {run.completed_at
                      ? new Date(run.completed_at).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={run.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
