"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useRunDetail } from "@/hooks/use-run-detail";
import { PhaseBadge } from "./phase-badge";
import { VisibilityBadge } from "./visibility-badge";
import { ShareDialog } from "./share-dialog";
import { ArtifactBadges } from "./artifact-badges";
import { ConversationFeed } from "./conversation-feed";
import { RelativeTime } from "./relative-time";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, GitBranch, Monitor, FileCode, Clock, Hash, FolderGit2, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RunVisibility, Run, RunStatus } from "@glop/shared";
import type { SessionWorkspace } from "@/lib/session";

const statusDotClass: Record<RunStatus, string> = {
  active: "bg-green-500 animate-pulse",
  blocked: "bg-amber-500",
  stale: "bg-gray-400",
  completed: "bg-green-500",
  failed: "bg-red-500",
};

function canShare(run: Run, userId?: string, workspaces?: SessionWorkspace[]): boolean {
  if (!userId) return false;
  if (run.owner_user_id === userId) return true;
  if (workspaces?.some((w) => w.id === run.workspace_id && w.role === "admin")) return true;
  return false;
}

export function RunDetailView({ runId }: { runId: string }) {
  const { data, error, loading } = useRunDetail(runId);
  const { data: session } = useSession();
  const router = useRouter();
  const [visibility, setVisibility] = useState<RunVisibility | null>(null);

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
  const currentVisibility = visibility ?? run.visibility;
  const workspaces = (
    (session as unknown as Record<string, unknown>)?.workspaces as SessionWorkspace[]
  ) || [];
  const showShare = canShare(run, session?.user?.id, workspaces);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2 cursor-pointer" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <span
              className={cn("h-2.5 w-2.5 rounded-full shrink-0", statusDotClass[run.status])}
              title={run.status}
            />
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
            {run.slug && (
              <span className="flex items-center gap-1 font-mono" title={run.slug}>
                <Link2 className="h-3.5 w-3.5" />
                {run.slug}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {run.status !== "completed" && run.status !== "failed" && (
            <PhaseBadge phase={run.phase} />
          )}
          <VisibilityBadge visibility={currentVisibility} />
          {showShare && (
            <ShareDialog
              run={{ ...run, visibility: currentVisibility }}
              onVisibilityChange={setVisibility}
            />
          )}
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
