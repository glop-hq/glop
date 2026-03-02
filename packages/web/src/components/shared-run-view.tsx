"use client";

import { PhaseBadge } from "./phase-badge";
import { StatusBadge } from "./status-badge";
import { ArtifactBadges } from "./artifact-badges";
import { ConversationFeed } from "./conversation-feed";
import { RelativeTime } from "./relative-time";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GitBranch, Monitor, FileCode, Clock, FolderGit2, Link2, AlertTriangle } from "lucide-react";
import type { SharedRunDetailResponse } from "@glop/shared";

export function SharedRunView({ data }: { data: SharedRunDetailResponse }) {
  const { run, events, artifacts } = data;

  return (
    <div className="min-h-screen bg-background">
      {/* Shared view banner */}
      <div className="border-b bg-green-50">
        <div className="mx-auto flex h-10 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2 text-sm text-green-700">
            <Link2 className="h-4 w-4" />
            <span className="font-medium">Shared view</span>
            <span className="text-green-600/70">- Read only</span>
          </div>
          {run.shared_link_expires_at && (
            <div className="flex items-center gap-1.5 text-xs text-green-600/70">
              <AlertTriangle className="h-3 w-3" />
              Expires {new Date(run.shared_link_expires_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-5xl p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold">
              {run.title || `Run ${run.id.slice(0, 8)}`}
            </h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Monitor className="h-3.5 w-3.5" />
                {run.git_user_name || "Developer"}
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
            </div>
          </div>
          <div className="flex items-center gap-3">
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
            <CardTitle className="text-sm">
              Session Feed ({events.length} events)
            </CardTitle>
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
    </div>
  );
}
