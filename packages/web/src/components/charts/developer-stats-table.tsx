"use client";

import { useState, useMemo } from "react";
import { ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { DeveloperStats } from "@glop/shared";

const PAGE_SIZE = 10;

type SortKey =
  | "developer_name"
  | "run_count"
  | "avg_conversation_turns"
  | "avg_turns_before_first_commit"
  | "commits_per_run"
  | "prs_per_run"
  | "compactions_per_run";

function InlineBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  if (max === 0) return <span className="text-muted-foreground">0</span>;
  const pct = (value / max) * 100;
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 shrink-0 tabular-nums text-sm">{value.toFixed(1)}</span>
      <div className="h-2 flex-1 rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function DeveloperStatsTable({ data }: { data: DeveloperStats[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("developer_name");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(0);

  const maxes = useMemo(
    () => ({
      commits_per_run: Math.max(...data.map((d) => d.commits_per_run), 0.1),
      prs_per_run: Math.max(...data.map((d) => d.prs_per_run), 0.1),
      compactions_per_run: Math.max(...data.map((d) => d.compactions_per_run), 0.1),
    }),
    [data]
  );

  const sorted = useMemo(() => {
    const arr = [...data];
    arr.sort((a, b) => {
      let cmp: number;
      if (sortKey === "developer_name") {
        cmp = a.developer_name.localeCompare(b.developer_name);
      } else {
        cmp = a[sortKey] - b[sortKey];
      }
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [data, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
    setPage(0);
  }

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No developer data available.
      </p>
    );
  }

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col style={{ width: 173 }} />
            <col style={{ width: 63 }} />
            <col style={{ width: 105 }} />
            <col style={{ width: 132 }} />
            <col />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 pr-3 font-medium">
                <button
                  className="inline-flex cursor-pointer items-center gap-1 hover:text-foreground"
                  onClick={() => toggleSort("developer_name")}
                >
                  Developer
                  <ArrowUpDown
                    className={`h-3 w-3 ${sortKey === "developer_name" ? "text-foreground" : "text-muted-foreground/50"}`}
                  />
                </button>
              </th>
              {([
                { key: "run_count", label: "Runs", cls: "pr-3" },
                { key: "avg_conversation_turns", label: "Avg Turns", cls: "pr-3 whitespace-nowrap" },
                { key: "avg_turns_before_first_commit", label: "Pre-Commit", cls: "pr-3 whitespace-nowrap" },
                { key: "commits_per_run", label: "Commits/Run", cls: "pr-8" },
                { key: "prs_per_run", label: "PRs/Run", cls: "pr-8" },
                { key: "compactions_per_run", label: "Compactions/Run", cls: "pr-6" },
              ] as const).map((col) => (
                <th key={col.key} className={`pb-2 ${col.cls} font-medium`}>
                  <button
                    className="inline-flex cursor-pointer items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort(col.key)}
                  >
                    {col.label}
                    <ArrowUpDown
                      className={`h-3 w-3 ${sortKey === col.key ? "text-foreground" : "text-muted-foreground/50"}`}
                    />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((dev) => (
              <tr key={dev.developer_name} className="border-b last:border-0">
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {dev.developer_avatar_url ? (
                      <img
                        src={dev.developer_avatar_url}
                        alt={dev.developer_name}
                        className="h-6 w-6 shrink-0 rounded-full"
                      />
                    ) : (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                        {dev.developer_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="truncate font-medium">{dev.developer_name}</span>
                  </div>
                </td>
                <td className="py-2 pr-3 tabular-nums">{dev.run_count}</td>
                <td className="py-2 pr-3 tabular-nums">
                  {dev.avg_conversation_turns.toFixed(1)}
                </td>
                <td className="py-2 pr-3 tabular-nums">
                  {dev.avg_turns_before_first_commit > 0
                    ? dev.avg_turns_before_first_commit.toFixed(1)
                    : "—"}
                </td>
                <td className="py-2 pr-8">
                  <InlineBar
                    value={dev.commits_per_run}
                    max={maxes.commits_per_run}
                    color="var(--chart-2)"
                  />
                </td>
                <td className="py-2 pr-8">
                  <InlineBar
                    value={dev.prs_per_run}
                    max={maxes.prs_per_run}
                    color="var(--chart-2)"
                  />
                </td>
                <td className="py-2 pr-8">
                  <InlineBar
                    value={dev.compactions_per_run}
                    max={maxes.compactions_per_run}
                    color="var(--chart-5)"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-3 mt-1">
          <span className="text-xs text-muted-foreground">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 0}
              className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages - 1}
              className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
