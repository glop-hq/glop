"use client";

import { useRouter } from "next/navigation";
import type { Run, ArtifactInfo } from "@glop/shared";
import { PhaseBadge } from "./phase-badge";
import { StatusBadge } from "./status-badge";
import { ArtifactBadges } from "./artifact-badges";
import { RelativeTime } from "./relative-time";
import { cn } from "@/lib/utils";

const statusRowClass: Record<string, string> = {
  active: "",
  blocked: "bg-amber-50/50",
  stale: "opacity-60",
  completed: "opacity-70",
  failed: "bg-red-50/30",
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
      onClick={() => router.push(`/runs/${run.id}`)}
    >
      <td className="px-4 py-3">
        <div className="font-medium text-sm">
          {run.git_user_name || run.title || run.developer_id.slice(0, 8)}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {run.git_user_email || run.developer_id.slice(0, 8)}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="text-sm font-mono">{run.repo_key}</div>
        <div className="text-xs text-muted-foreground">{run.branch_name}</div>
      </td>
      <td className="px-4 py-3">
        <PhaseBadge phase={run.phase} />
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {run.last_action_label || "-"}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        <RelativeTime date={run.last_event_at} />
      </td>
      <td className="px-4 py-3">
        <ArtifactBadges artifacts={artifacts} />
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={run.status} />
      </td>
    </tr>
  );
}
