"use client";

import { useRunDetail } from "@/hooks/use-run-detail";
import { PhaseBadge } from "./phase-badge";
import { StatusBadge } from "./status-badge";
import { ArtifactBadges } from "./artifact-badges";
import { ConversationFeed } from "./conversation-feed";
import { RelativeTime } from "./relative-time";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, GitBranch, Monitor, FileCode, Clock, Hash, FolderGit2 } from "lucide-react";
import Link from "next/link";

export function RunDetailView({ runId }: { runId: string }) {
  const { data, error, loading } = useRunDetail(runId);

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <p>Failed to load run: {error || "Not found"}</p>
      </div>
    );
  }

  const { run, events, artifacts } = data;
  const isLive = run.status === "active" || run.status === "stale";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/live">
            <Button variant="ghost" size="sm" className="mb-2 -ml-2">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <h1 className="text-xl font-semibold">
            {run.title || `Run ${run.id.slice(0, 8)}`}
          </h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Monitor className="h-3.5 w-3.5" />
              {run.git_user_name || run.developer_id.slice(0, 8)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <RelativeTime date={run.started_at} />
            </span>
            <span className="flex items-center gap-1 font-mono">
              <FolderGit2 className="h-3.5 w-3.5" />
              {run.repo_key}
            </span>
            <span className="flex items-center gap-1 font-mono">
              <GitBranch className="h-3.5 w-3.5" />
              {run.branch_name}
            </span>
            <span className="flex items-center gap-1">
              <FileCode className="h-3.5 w-3.5" />
              {run.file_count} files
            </span>
            {run.session_id && (
              <span className="flex items-center gap-1 font-mono" title={run.session_id}>
                <Hash className="h-3.5 w-3.5" />
                {run.session_id.slice(0, 8)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isLive && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </span>
          )}
          <PhaseBadge phase={run.phase} />
          <StatusBadge status={run.status} />
        </div>
      </div>

      {/* Summary */}
      {run.summary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{run.summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Artifacts */}
      {artifacts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Artifacts</CardTitle>
          </CardHeader>
          <CardContent>
            <ArtifactBadges artifacts={artifacts} />
          </CardContent>
        </Card>
      )}

      {/* Conversation Feed */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              Session Feed ({events.length} events)
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ConversationFeed
            events={events}
            developerName={run.title?.replace(/ working on .*$/, "") || undefined}
            runStatus={run.status}
          />
        </CardContent>
      </Card>
    </div>
  );
}
