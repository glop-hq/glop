"use client";

import { useMemo, useState, useCallback } from "react";
import { useLiveBoard } from "@/hooks/use-live-board";
import { RunRow } from "./run-row";
import { ColumnHeader, type SortDir } from "./column-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Radio, X } from "lucide-react";

type SortField = "developer" | "repo" | "activity" | "updated";

interface SortState {
  field: SortField | null;
  dir: SortDir;
}

interface FilterState {
  developer: Set<string>;
  repo: Set<string>;
  branch: Set<string>;
  status: Set<string>;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-6 w-24" />
        </div>
      ))}
    </div>
  );
}

function getDeveloperName(run: { git_user_name: string | null; title: string | null; developer_id: string }) {
  return run.git_user_name || run.title || run.developer_id.slice(0, 8);
}

export function LiveBoard() {
  const { data, error, loading } = useLiveBoard();
  const [sort, setSort] = useState<SortState>({ field: "updated", dir: "desc" });
  const [filters, setFilters] = useState<FilterState>({
    developer: new Set(),
    repo: new Set(),
    branch: new Set(),
    status: new Set(),
  });

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
    if (!data) return { developers: [], repos: [], branches: [], statuses: [] };
    const developers = [...new Set(data.runs.map(getDeveloperName))].sort();
    const repos = [...new Set(data.runs.map((r) => r.repo_key))].sort();
    const branches = [...new Set(data.runs.map((r) => r.branch_name))].sort();
    const statuses = [...new Set(data.runs.map((r) => r.status))].sort();
    return { developers, repos, branches, statuses };
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
    if (filters.branch.size > 0) {
      runs = runs.filter((r) => filters.branch.has(r.branch_name));
    }
    if (filters.status.size > 0) {
      runs = runs.filter((r) => filters.status.has(r.status));
    }

    if (sort.field && sort.dir) {
      const dir = sort.dir === "asc" ? 1 : -1;
      runs = [...runs].sort((a, b) => {
        switch (sort.field) {
          case "developer":
            return dir * getDeveloperName(a).localeCompare(getDeveloperName(b));
          case "repo":
            return dir * a.repo_key.localeCompare(b.repo_key);
          case "activity":
            return dir * a.phase.localeCompare(b.phase);
          case "updated":
            return (
              dir *
              (new Date(a.last_event_at).getTime() -
                new Date(b.last_event_at).getTime())
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
  for (const value of filters.branch) activeChips.push({ label: value, field: "branch", value });
  for (const value of filters.status) activeChips.push({ label: value, field: "status", value });

  const clearAllFilters = useCallback(() => {
    setFilters({
      developer: new Set(),
      repo: new Set(),
      branch: new Set(),
      status: new Set(),
    });
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

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <p>Failed to load: {error}</p>
      </div>
    );
  }

  if (!data || data.runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-muted-foreground">
        <Radio className="h-8 w-8 mb-3 opacity-40" />
        <p className="text-sm">No active runs</p>
        <p className="text-xs mt-1">
          Runs will appear here when developers use Claude with glop hooks
          installed
        </p>
      </div>
    );
  }

  return (
    <div>
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

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full table-fixed">
          <colgroup>
            <col className="w-8" />
            <col style={{ width: "22%" }} />
            <col style={{ width: "25%" }} />
            <col style={{ width: "35%" }} />
            <col style={{ width: "18%" }} />
          </colgroup>
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="pl-4 pr-2" />
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
                label="Activity"
                sortDir={sort.field === "activity" ? sort.dir : null}
                onSort={handleSort("activity")}
                filterValues={filterOptions.statuses}
                selectedFilters={filters.status}
                onFilterChange={setFilterField("status")}
              />
              <ColumnHeader
                label="Updated"
                sortDir={sort.field === "updated" ? sort.dir : null}
                onSort={handleSort("updated")}
                align="right"
              />
            </tr>
          </thead>
          <tbody>
            {filteredRuns.map((run) => (
              <RunRow key={run.id} run={run} artifacts={run.artifacts} />
            ))}
            {filteredRuns.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  No runs match the current filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
