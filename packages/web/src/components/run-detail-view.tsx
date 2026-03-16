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
import { Tooltip } from "@/components/ui/tooltip";
import Link from "next/link";
import { ArrowLeft, ArrowRight, GitBranch, FileCode, Clock, FolderGit2, Info, MessageSquare, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Run, RunStatus, ShareRunResponse } from "@glop/shared";
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
  const [visibility, setVisibility] = useState<"private" | "workspace" | null>(null);
  const [sharedLinkActive, setSharedLinkActive] = useState<boolean | null>(null);

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
  const currentVisibility = visibility ?? (run.visibility === "workspace" ? "workspace" : "private");
  const currentLinkActive = sharedLinkActive ?? (run.shared_link_state === "active");

  // Compute run stats from events
  const conversationTurns = events.filter(
    (e) => e.event_type === "run.prompt" || e.event_type === "run.response"
  ).length;
  const compactionCount = events.filter(
    (e) => e.event_type === "run.context_compacted"
  ).length;

  const handleShareChange = (resp: ShareRunResponse) => {
    setVisibility(resp.visibility);
    setSharedLinkActive(resp.shared_link_active);
  };

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
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1 font-mono min-w-0">
              <FolderGit2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{run.repo_key}</span>
            </span>
            <span className="flex items-center gap-1 font-mono min-w-0">
              <GitBranch className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{run.branch_name}</span>
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <RelativeTime date={run.started_at} />
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <MessageSquare className="h-3.5 w-3.5 shrink-0" />
              {conversationTurns} {conversationTurns === 1 ? "turn" : "turns"}
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <FileCode className="h-3.5 w-3.5 shrink-0" />
              {run.file_count} {run.file_count === 1 ? "file" : "files"}
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <Layers className="h-3.5 w-3.5 shrink-0" />
              {compactionCount} {compactionCount === 1 ? "compaction" : "compactions"}
            </span>
          </div>
          {artifacts.length > 0 && (
            <div className="mt-2">
              <ArtifactBadges artifacts={artifacts} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Tooltip
            content={[
              `Developer: ${run.git_user_name || run.developer_id.slice(0, 8)}`,
              run.slug ? `Slug: ${run.slug}` : null,
            ].filter(Boolean).join("\n")}
          >
            <span className="text-muted-foreground hover:text-foreground transition-colors cursor-default">
              <Info className="h-4 w-4" />
            </span>
          </Tooltip>
          {run.status !== "completed" && run.status !== "failed" && (
            <PhaseBadge phase={run.phase} />
          )}
          <VisibilityBadge visibility={currentVisibility} sharedLinkActive={currentLinkActive} />
          {showShare && (
            <ShareDialog
              run={{ ...run, visibility: currentVisibility }}
              sharedLinkActive={currentLinkActive}
              onShareChange={handleShareChange}
            />
          )}
        </div>
      </div>

      {/* Continuation links */}
      {(data.parent_run || data.child_runs) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {data.parent_run && (
            <Link
              href={`/runs/${data.parent_run.id}`}
              className="flex items-center gap-1 hover:text-foreground cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Continued from {data.parent_run.id.slice(0, 8)}
            </Link>
          )}
          {data.child_runs?.map((child) => (
            <Link
              key={child.id}
              href={`/runs/${child.id}`}
              className="flex items-center gap-1 hover:text-foreground cursor-pointer"
            >
              Continued in {child.id.slice(0, 8)}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ))}
        </div>
      )}

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
