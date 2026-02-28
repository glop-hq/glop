"use client";

import { useMemo, useState } from "react";
import { useLiveBoard } from "@/hooks/use-live-board";
import { RunRow } from "./run-row";
import { Skeleton } from "@/components/ui/skeleton";
import { Radio } from "lucide-react";
import type { RunPhase, RunStatus } from "@glop/shared";

type SortField = "updated" | "started";

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

function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

export function LiveBoard() {
  const { data, error, loading } = useLiveBoard();
  const [developerFilter, setDeveloperFilter] = useState("");
  const [repoFilter, setRepoFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortField, setSortField] = useState<SortField>("updated");

  const filterOptions = useMemo(() => {
    if (!data) return { developers: [], repos: [], branches: [], statuses: [] };
    const developers = [
      ...new Set(
        data.runs.map(
          (r) => r.git_user_name || r.title || r.developer_id.slice(0, 8)
        )
      ),
    ];
    const repos = [...new Set(data.runs.map((r) => r.repo_key))];
    const branches = [...new Set(data.runs.map((r) => r.branch_name))];
    const statuses = [...new Set(data.runs.map((r) => r.status))];
    return { developers, repos, branches, statuses };
  }, [data]);

  const filteredRuns = useMemo(() => {
    if (!data) return [];
    let runs = data.runs;

    if (developerFilter) {
      runs = runs.filter(
        (r) =>
          (r.git_user_name || r.title || r.developer_id.slice(0, 8)) ===
          developerFilter
      );
    }
    if (repoFilter) {
      runs = runs.filter((r) => r.repo_key === repoFilter);
    }
    if (branchFilter) {
      runs = runs.filter((r) => r.branch_name === branchFilter);
    }
    if (statusFilter) {
      runs = runs.filter((r) => r.status === statusFilter);
    }

    runs = [...runs].sort((a, b) => {
      if (sortField === "started") {
        return (
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
        );
      }
      return (
        new Date(b.last_event_at).getTime() -
        new Date(a.last_event_at).getTime()
      );
    });

    return runs;
  }, [data, developerFilter, repoFilter, branchFilter, statusFilter, sortField]);

  const hasActiveFilters =
    developerFilter || repoFilter || branchFilter || statusFilter;

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
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/20">
        <FilterSelect
          value={developerFilter}
          onChange={setDeveloperFilter}
          options={filterOptions.developers}
          placeholder="All developers"
        />
        <FilterSelect
          value={repoFilter}
          onChange={setRepoFilter}
          options={filterOptions.repos}
          placeholder="All repos"
        />
        <FilterSelect
          value={branchFilter}
          onChange={setBranchFilter}
          options={filterOptions.branches}
          placeholder="All branches"
        />
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={filterOptions.statuses}
          placeholder="All statuses"
        />
        {hasActiveFilters && (
          <button
            onClick={() => {
              setDeveloperFilter("");
              setRepoFilter("");
              setBranchFilter("");
              setStatusFilter("");
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Sort:</span>
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="updated">Last updated</option>
            <option value="started">Started</option>
          </select>
        </div>
      </div>

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
              <th className="pl-2 pr-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Developer
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Repo / Branch
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Activity
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Updated
              </th>
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
