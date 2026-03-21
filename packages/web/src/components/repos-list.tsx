"use client";

import { useRouter } from "next/navigation";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useRepos } from "@/hooks/use-repos";
import { ScoreBadge } from "./score-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderGit2, AlertTriangle, AlertCircle } from "lucide-react";

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

export function ReposList() {
  const router = useRouter();
  const { currentWorkspace } = useWorkspaces();
  const { repos, loading } = useRepos(currentWorkspace?.id || "");

  if (!currentWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <FolderGit2 className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm">Select a workspace to view repos</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (repos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <FolderGit2 className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm">No repos found</p>
        <p className="mt-1 text-xs">
          Repos appear automatically when developers use Claude Code
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left text-xs font-medium text-muted-foreground">
            <th className="px-4 py-3">Repository</th>
            <th className="px-4 py-3 text-center">Score</th>
            <th className="px-4 py-3 text-center">Findings</th>
            <th className="px-4 py-3 text-center">Runs</th>
            <th className="px-4 py-3 text-right">Last Scanned</th>
          </tr>
        </thead>
        <tbody>
          {repos.map((repo) => (
            <tr
              key={repo.id}
              className="cursor-pointer border-b transition-colors hover:bg-muted/50"
              onClick={() => router.push(`/repos/${repo.id}`)}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <FolderGit2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">
                      {repo.display_name || repo.repo_key.split("/").pop()}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {repo.repo_key}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-center">
                <ScoreBadge score={repo.latest_scan_score} size="sm" />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-center gap-3 text-xs">
                  {repo.critical_count > 0 && (
                    <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                      <AlertCircle className="h-3 w-3" />
                      {repo.critical_count}
                    </span>
                  )}
                  {repo.warning_count > 0 && (
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3" />
                      {repo.warning_count}
                    </span>
                  )}
                  {repo.critical_count === 0 &&
                    repo.warning_count === 0 &&
                    repo.latest_scan_score !== null && (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        All clear
                      </span>
                    )}
                  {repo.latest_scan_score === null && (
                    <span className="text-muted-foreground">Not scanned</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-center text-sm text-muted-foreground">
                {repo.run_count}
              </td>
              <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                {repo.latest_scan_at
                  ? formatRelativeTime(repo.latest_scan_at)
                  : "Never"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
