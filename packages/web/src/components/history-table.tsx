"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { HistoryResponse, Run } from "@glop/shared";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { ColumnHeader, type SortDir } from "./column-header";
import { RelativeTime } from "./relative-time";
import { VisibilityBadge } from "./visibility-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, FolderGit2, GitBranch, GitCommitHorizontal, GitPullRequest, X } from "lucide-react";
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
  completed: "bg-gray-400",
  failed: "bg-red-500",
};

type SortField = "developer" | "repo" | "title" | "duration" | "visibility" | "completed";

interface SortState {
  field: SortField | null;
  dir: SortDir;
}

interface FilterState {
  developer: Set<string>;
  repo: Set<string>;
  visibility: Set<string>;
}

function getDeveloperName(run: Run): string {
  return run.git_user_name || run.developer_id.slice(0, 8);
}

function getVisibilityLabel(run: Run): string {
  if (run.visibility === "workspace") return "Team";
  if (run.shared_link_state === "active") return "Link";
  return "Private";
}

function getDurationMs(run: Run): number {
  if (!run.completed_at) return 0;
  return new Date(run.completed_at).getTime() - new Date(run.started_at).getTime();
}

export function HistoryTable() {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortState>({ field: "completed", dir: "desc" });
  const [filters, setFilters] = useState<FilterState>({
    developer: new Set(),
    repo: new Set(),
    visibility: new Set(),
  });
  const router = useRouter();
  const { currentWorkspace } = useWorkspaces();

  const fetchData = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/history?limit=50&workspace_id=${currentWorkspace.id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setFilterField = useCallback(
    (field: keyof FilterState) => (values: Set<string>) => {
      setFilters((prev) => ({ ...prev, [field]: values }));
    },
    []
  );

  const handleSort = useCallback(
    (field: SortField) => (dir: SortDir) => {
      setSort(dir ? { field, dir } : { field: null, dir: null });
    },
    []
  );

  const filterOptions = useMemo(() => {
    if (!data) return { developers: [], repos: [], visibilities: [] };
    const developers = [...new Set(data.runs.map(getDeveloperName))].sort();
    const repos = [...new Set(data.runs.map((r) => r.repo_key))].sort();
    const visibilities = [...new Set(data.runs.map(getVisibilityLabel))].sort();
    return { developers, repos, visibilities };
  }, [data]);

  const filteredRuns = useMemo(() => {
    if (!data) return [];
    let runs = data.runs;

    if (filters.developer.size > 0) {
      runs = runs.filter((r) => filters.developer.has(getDeveloperName(r)));
    }
    if (filters.repo.size > 0) {
      runs = runs.filter((r) => filters.repo.has(r.repo_key));
    }
    if (filters.visibility.size > 0) {
      runs = runs.filter((r) => filters.visibility.has(getVisibilityLabel(r)));
    }

    if (sort.field && sort.dir) {
      const dir = sort.dir === "asc" ? 1 : -1;
      runs = [...runs].sort((a, b) => {
        switch (sort.field) {
          case "developer":
            return dir * getDeveloperName(a).localeCompare(getDeveloperName(b));
          case "repo":
            return dir * a.repo_key.localeCompare(b.repo_key);
          case "title":
            return dir * (a.title || "").localeCompare(b.title || "");
          case "duration":
            return dir * (getDurationMs(a) - getDurationMs(b));
          case "visibility":
            return dir * getVisibilityLabel(a).localeCompare(getVisibilityLabel(b));
          case "completed":
            return (
              dir *
              (new Date(a.completed_at || a.last_event_at).getTime() -
                new Date(b.completed_at || b.last_event_at).getTime())
            );
          default:
            return 0;
        }
      });
    }

    return runs;
  }, [data, filters, sort]);

  // Collect active filter chips
  const activeChips: { label: string; field: keyof FilterState; value: string }[] = [];
  for (const value of filters.developer) activeChips.push({ label: value, field: "developer", value });
  for (const value of filters.repo) activeChips.push({ label: value, field: "repo", value });
  for (const value of filters.visibility) activeChips.push({ label: value, field: "visibility", value });

  const clearAllFilters = useCallback(() => {
    setFilters({ developer: new Set(), repo: new Set(), visibility: new Set() });
  }, []);

  const removeChip = useCallback(
    (field: keyof FilterState, value: string) => {
      setFilters((prev) => {
        const next = new Set(prev[field]);
        next.delete(value);
        return { ...prev, [field]: next };
      });
    },
    []
  );

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-4 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          {filteredRuns.length}
          {filteredRuns.length !== (data?.runs.length ?? 0) && ` of ${data?.runs.length}`}
          {" "}runs
        </p>
      </div>

      <div className="rounded-lg border bg-card">
        {/* Active filter chips */}
        {activeChips.length > 0 && (
          <div className="flex items-center gap-1.5 px-4 py-2 border-b">
            <span className="text-xs text-muted-foreground mr-1">Filters:</span>
            {activeChips.map((chip) => (
              <button
                key={`${chip.field}-${chip.value}`}
                onClick={() => removeChip(chip.field, chip.value)}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-accent text-accent-foreground hover:bg-accent/80 transition-colors cursor-pointer"
              >
                {chip.label}
                <X className="h-3 w-3" />
              </button>
            ))}
            <button
              onClick={clearAllFilters}
              className="text-xs text-muted-foreground hover:text-foreground ml-1 transition-colors cursor-pointer"
            >
              Clear all
            </button>
          </div>
        )}

        {!data || data.runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-muted-foreground">
            <Clock className="h-8 w-8 mb-3 opacity-40" />
            <p className="text-sm">No completed runs yet</p>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-8" />
              <col style={{ width: "26%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "16%" }} />
            </colgroup>
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="pl-4 pr-2" />
                <ColumnHeader
                  label="Task"
                  sortDir={sort.field === "title" ? sort.dir : null}
                  onSort={handleSort("title")}
                />
                <ColumnHeader
                  label="Developer"
                  sortDir={sort.field === "developer" ? sort.dir : null}
                  onSort={handleSort("developer")}
                  filterValues={filterOptions.developers}
                  selectedFilters={filters.developer}
                  onFilterChange={setFilterField("developer")}
                />
                <ColumnHeader
                  label="Repo / Branch"
                  sortDir={sort.field === "repo" ? sort.dir : null}
                  onSort={handleSort("repo")}
                  filterValues={filterOptions.repos}
                  selectedFilters={filters.repo}
                  onFilterChange={setFilterField("repo")}
                />
                <ColumnHeader
                  label="Duration"
                  sortDir={sort.field === "duration" ? sort.dir : null}
                  onSort={handleSort("duration")}
                />
                <ColumnHeader
                  label="Visibility"
                  sortDir={sort.field === "visibility" ? sort.dir : null}
                  onSort={handleSort("visibility")}
                  filterValues={filterOptions.visibilities}
                  selectedFilters={filters.visibility}
                  onFilterChange={setFilterField("visibility")}
                />
                <ColumnHeader
                  label="Completed"
                  sortDir={sort.field === "completed" ? sort.dir : null}
                  onSort={handleSort("completed")}
                  align="right"
                />
              </tr>
            </thead>
            <tbody>
              {filteredRuns.map((run) => (
                <tr
                  key={run.id}
                  className={cn(
                    "border-b cursor-pointer transition-colors hover:bg-muted/50",
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

                  {/* Task */}
                  <td className="pl-2 pr-4 py-3 text-sm">
                    <div className="truncate">{run.title || "-"}</div>
                    {run.artifacts && run.artifacts.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {[...run.artifacts].sort((a, b) => (a.artifact_type === "pr" ? -1 : b.artifact_type === "pr" ? 1 : 0)).map((a) => {
                          if (a.artifact_type === "commit") {
                            const content = (
                              <>
                                <GitCommitHorizontal className="h-3 w-3" />
                                {a.external_id?.slice(0, 7)}
                              </>
                            );
                            return a.url ? (
                              <a
                                key={a.id}
                                href={a.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                                title={a.label || undefined}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {content}
                              </a>
                            ) : (
                              <span
                                key={a.id}
                                className="inline-flex items-center gap-1 text-xs rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground"
                                title={a.label || undefined}
                              >
                                {content}
                              </span>
                            );
                          }
                          if (a.artifact_type === "pr") {
                            return (
                              <a
                                key={a.id}
                                href={a.url || undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                                title={a.label || undefined}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <GitPullRequest className="h-3 w-3" />
                                #{a.external_id}
                              </a>
                            );
                          }
                          return null;
                        })}
                      </div>
                    )}
                  </td>

                  {/* Developer */}
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm truncate">
                      {run.git_user_name || run.developer_id.slice(0, 8)}
                    </div>
                    {run.git_user_email && (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {run.git_user_email}
                      </div>
                    )}
                  </td>

                  {/* Repo / Branch */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-sm font-mono truncate">
                      <FolderGit2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{run.repo_key}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <GitBranch className="h-3 w-3 shrink-0" />
                      <span className="truncate">{run.branch_name}</span>
                    </div>
                  </td>

                  {/* Duration */}
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDuration(run.started_at, run.completed_at)}
                  </td>

                  {/* Visibility */}
                  <td className="px-4 py-3">
                    <VisibilityBadge
                      visibility={run.visibility}
                      sharedLinkActive={run.shared_link_state === "active"}
                      iconOnly
                    />
                  </td>

                  {/* Completed */}
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {run.completed_at ? (
                      <RelativeTime date={run.completed_at} />
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
              {filteredRuns.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    No runs match the current filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </>
  );
}
