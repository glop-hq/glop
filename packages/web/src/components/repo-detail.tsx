"use client";

import Link from "next/link";
import { useRepoDetail } from "@/hooks/use-repo-detail";
import { ScoreBadge } from "./score-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FolderGit2,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  MinusCircle,
  Clock,
} from "lucide-react";

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

function CheckStatusIcon({
  status,
}: {
  status: "pass" | "warn" | "fail" | "skip";
}) {
  switch (status) {
    case "pass":
      return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    case "warn":
      return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    case "fail":
      return <XCircle className="h-5 w-5 text-red-500" />;
    case "skip":
      return <MinusCircle className="h-5 w-5 text-muted-foreground" />;
  }
}

function severityOrder(severity: string): number {
  if (severity === "critical") return 0;
  if (severity === "warning") return 1;
  return 2;
}

export function RepoDetail({ repoId }: { repoId: string }) {
  const { data, loading, error } = useRepoDetail(repoId);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-sm">{error || "Repo not found"}</p>
      </div>
    );
  }

  const { repo, run_count, latest_scan, scan_history, recent_runs } = data;
  const checks = latest_scan?.checks ?? [];

  // Sort checks: critical first, then by status (fail > warn > pass > skip)
  const sortedChecks = [...checks].sort((a, b) => {
    const sevDiff = severityOrder(a.severity) - severityOrder(b.severity);
    if (sevDiff !== 0) return sevDiff;
    const statusOrder = { fail: 0, warn: 1, skip: 2, pass: 3 };
    return (
      (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4)
    );
  });

  const criticalFails = checks.filter(
    (c) => c.severity === "critical" && c.status !== "pass"
  ).length;
  const warningFails = checks.filter(
    (c) => c.severity === "warning" && c.status !== "pass"
  ).length;

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
          <div className="flex items-center gap-3">
            <FolderGit2 className="h-6 w-6 text-muted-foreground" />
            <div>
              <h1 className="text-lg font-semibold">
                {repo.display_name || repo.repo_key.split("/").pop()}
              </h1>
              <p className="text-sm text-muted-foreground font-mono">
                {repo.repo_key}
              </p>
            </div>
          </div>
        </div>
        <div className="text-center">
          <ScoreBadge score={latest_scan?.score ?? null} size="lg" />
          {latest_scan?.completed_at && (
            <p className="mt-1 text-xs text-muted-foreground">
              {formatRelativeTime(latest_scan.completed_at)}
            </p>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="px-4 py-3">
            <p className="text-2xl font-semibold">{latest_scan?.score ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Readiness Score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-4 py-3">
            <p className="text-2xl font-semibold text-red-600 dark:text-red-400">
              {criticalFails}
            </p>
            <p className="text-xs text-muted-foreground">Critical Issues</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-4 py-3">
            <p className="text-2xl font-semibold text-amber-600 dark:text-amber-400">
              {warningFails}
            </p>
            <p className="text-xs text-muted-foreground">Warnings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-4 py-3">
            <p className="text-2xl font-semibold">{run_count}</p>
            <p className="text-xs text-muted-foreground">Total Runs</p>
          </CardContent>
        </Card>
      </div>

      {/* Findings */}
      {latest_scan ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Findings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sortedChecks.map((check) => (
              <div
                key={check.id || check.check_id}
                className="flex items-start gap-3 rounded-lg border p-3"
              >
                <CheckStatusIcon status={check.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium">{check.title}</h4>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {check.score}/{check.weight}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {check.description}
                  </p>
                  {check.recommendation &&
                    check.status !== "pass" && (
                      <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                        → {check.recommendation}
                      </p>
                    )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <AlertCircle className="mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm">No scan results yet</p>
            <p className="mt-1 text-xs">
              Run <code className="rounded bg-muted px-1">glop scan</code> in
              this repo to see readiness findings
            </p>
          </CardContent>
        </Card>
      )}

      {/* Scan History */}
      {scan_history.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Scan History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {scan_history.map((scan) => (
                <div
                  key={scan.id}
                  className="flex items-center justify-between rounded border px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <ScoreBadge score={scan.score} size="sm" />
                    <span className="text-muted-foreground">
                      Score: {scan.score ?? "—"}/100
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {scan.completed_at
                      ? formatRelativeTime(scan.completed_at)
                      : scan.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Runs */}
      {recent_runs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recent_runs.map((run) => (
                <Link
                  key={run.id}
                  href={`/runs/${run.id}`}
                  className="flex items-center justify-between rounded border px-3 py-2 text-sm transition-colors hover:bg-muted/50 cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">
                      {run.title || "Untitled session"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                    <span>{run.git_user_name || run.developer_id}</span>
                    <span>{run.event_count} events</span>
                    <span>{formatRelativeTime(run.started_at)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
