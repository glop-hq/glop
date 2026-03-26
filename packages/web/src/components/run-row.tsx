"use client";

import { useRouter } from "next/navigation";
import type { Run, ArtifactInfo } from "@glop/shared";
import { PhaseBadge } from "./phase-badge";
import { ArtifactBadges } from "./artifact-badges";
import { RelativeTime } from "./relative-time";
import { FolderGit2, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";

const statusRowClass: Record<string, string> = {
  active: "",
  blocked: "bg-amber-50/50",
  stale: "opacity-60",
  completed: "opacity-70",
  failed: "bg-red-50/30",
};

const statusDotClass: Record<string, string> = {
  active: "bg-green-500 animate-pulse",
  blocked: "bg-amber-500",
  stale: "bg-gray-400",
  completed: "bg-green-500",
  failed: "bg-red-500",
};

export function RunRow({
  run,
  artifacts,
}: {
  run: Run;
  artifacts: ArtifactInfo[];
}) {
  const router = useRouter();

  return (
    <tr
      className={cn(
        "cursor-pointer border-b transition-colors hover:bg-muted/50",
        statusRowClass[run.status]
      )}
      onClick={() => router.push(`/sessions/${run.id}`)}
    >
      {/* Status dot */}
      <td className="pl-4 pr-2 py-3 w-8 align-middle text-center">
        <span
          className={cn("inline-block h-2.5 w-2.5 rounded-full", statusDotClass[run.status])}
          title={run.status}
        />
      </td>

      {/* Developer */}
      <td className="pl-2 pr-4 py-3">
        <div className="font-medium text-sm">
          {run.git_user_name || run.title || run.developer_id.slice(0, 8)}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {run.git_user_email || run.developer_id.slice(0, 8)}
        </div>
      </td>

      {/* Repo / Branch */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-sm font-mono">
          <FolderGit2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {run.repo_key}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
          <GitBranch className="h-3 w-3 shrink-0" />
          {run.branch_name}
        </div>
      </td>

      {/* Activity: phase badge + last action + artifact pills */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <PhaseBadge phase={run.phase} />
        </div>
        {run.last_action_label && (
          <div className="text-xs text-muted-foreground mt-1 truncate">
            {run.last_action_label}
          </div>
        )}
        {artifacts.length > 0 && (
          <div className="mt-1">
            <ArtifactBadges artifacts={artifacts} />
          </div>
        )}
      </td>

      {/* Updated */}
      <td className="px-4 py-3">
        <div className="text-sm text-muted-foreground">
          <RelativeTime date={run.last_event_at} />
        </div>
        <div className="text-xs text-muted-foreground/60 mt-0.5">
          <RelativeTime date={run.started_at} prefix="started" />
        </div>
      </td>
    </tr>
  );
}
