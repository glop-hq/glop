"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { RunBreakdown } from "@glop/shared";

const PAGE_SIZE = 30;

type SortKey =
  | "started_at"
  | "conversation_turns"
  | "commits"
  | "lines_changed"
  | "prs"
  | "compactions";

function parseRepo(key: string): { org: string; repo: string } {
  const parts = key.split("/");
  if (parts.length >= 3) {
    return { org: parts[parts.length - 2], repo: parts[parts.length - 1] };
  }
  if (parts.length === 2) {
    return { org: parts[0], repo: parts[1] };
  }
  return { org: "", repo: key };
}

function RepoName({ repoKey }: { repoKey: string }) {
  const { org, repo } = parseRepo(repoKey);
  const full = org ? `${org}/${repo}` : repo;
  return (
    <span className="flex min-w-0" title={full}>
      {org && (
        <>
          <span className="truncate text-muted-foreground">{org}</span>
          <span className="shrink-0 text-muted-foreground">/</span>
        </>
      )}
      <span className="shrink-0">{repo}</span>
    </span>
  );
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

function InlineBar({ value, max }: { value: number; max: number }) {
  if (max === 0) return <span className="text-muted-foreground">0</span>;
  const pct = (value / max) * 100;
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 text-right tabular-nums text-sm" title={value.toLocaleString()}>{formatCompact(value)}</span>
      <div className="h-2 flex-1 rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground/15"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function RunsTable({ data }: { data: RunBreakdown[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("started_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);

  const maxes = useMemo(
    () => ({
      conversation_turns: Math.max(...data.map((d) => d.conversation_turns), 1),
      commits: Math.max(...data.map((d) => d.commits), 1),
      lines_changed: Math.max(...data.map((d) => d.lines_changed), 1),
      prs: Math.max(...data.map((d) => d.prs), 1),
      compactions: Math.max(...data.map((d) => d.compactions), 1),
    }),
    [data]
  );

  const sorted = useMemo(() => {
    const arr = [...data];
    arr.sort((a, b) => {
      let cmp: number;
      if (sortKey === "started_at") {
        cmp = new Date(a.started_at).getTime() - new Date(b.started_at).getTime();
      } else {
        cmp = a[sortKey] - b[sortKey];
      }
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [data, sortKey, sortAsc]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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
        No runs in this period.
      </p>
    );
  }

  const columns: { key: SortKey; label: string }[] = [
    { key: "conversation_turns", label: "Turns" },
    { key: "commits", label: "Commits" },
    { key: "lines_changed", label: "Lines" },
    { key: "prs", label: "PRs" },
    { key: "compactions", label: "Compactions" },
  ];

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[150px]" />
            <col className="w-[170px]" />
            <col className="w-[180px]" />
            <col />
            <col />
            <col />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 pr-2 font-medium">
                <button
                  className="inline-flex cursor-pointer items-center gap-1 hover:text-foreground"
                  onClick={() => toggleSort("started_at")}
                >
                  Date
                  <ArrowUpDown
                    className={`h-3 w-3 ${sortKey === "started_at" ? "text-foreground" : "text-muted-foreground/50"}`}
                  />
                </button>
              </th>
              <th className="pb-2 pr-2 font-medium">Developer</th>
              <th className="pb-2 pr-2 font-medium">Repo</th>
              {columns.map((col) => (
                <th key={col.key} className="pb-2 pr-2 font-medium">
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
            {paged.map((run) => {
              const d = new Date(run.started_at);
              return (
                <tr
                  key={run.run_id}
                  className="border-b last:border-0 hover:bg-muted/50"
                >
                  <td className="py-2 pr-2 text-muted-foreground whitespace-nowrap">
                    {d.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    {d.toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {run.developer_avatar_url ? (
                        <img
                          src={run.developer_avatar_url}
                          alt={run.developer_name}
                          className="h-6 w-6 shrink-0 rounded-full"
                        />
                      ) : (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                          {run.developer_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="truncate font-medium">{run.developer_name}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-2">
                    <Link
                      href={`/sessions/${run.run_id}`}
                      className="flex min-w-0 font-medium text-foreground hover:underline"
                    >
                      <RepoName repoKey={run.repo_key} />
                    </Link>
                  </td>
                  <td className="py-2 pr-2">
                    <InlineBar
                      value={run.conversation_turns}
                      max={maxes.conversation_turns}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <InlineBar value={run.commits} max={maxes.commits} />
                  </td>
                  <td className="py-2 pr-2">
                    <InlineBar value={run.lines_changed} max={maxes.lines_changed} />
                  </td>
                  <td className="py-2 pr-2">
                    <InlineBar value={run.prs} max={maxes.prs} />
                  </td>
                  <td className="py-2 pr-2">
                    <InlineBar
                      value={run.compactions}
                      max={maxes.compactions}
                    />
                  </td>
                </tr>
              );
            })}
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
