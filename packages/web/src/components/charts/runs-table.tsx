"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowUpDown } from "lucide-react";
import type { RunBreakdown } from "@glop/shared";

type SortKey =
  | "started_at"
  | "conversation_turns"
  | "commits"
  | "prs"
  | "compactions";

function shortenRepo(key: string): string {
  const parts = key.split("/");
  if (parts.length >= 3) return parts.slice(-2).join("/");
  return key;
}

function InlineBar({ value, max }: { value: number; max: number }) {
  if (max === 0) return <span className="text-muted-foreground">0</span>;
  const pct = (value / max) * 100;
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 text-right tabular-nums text-sm">{value}</span>
      <div className="h-2 flex-1 rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground/25"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function RunsTable({ data }: { data: RunBreakdown[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("started_at");
  const [sortAsc, setSortAsc] = useState(false);

  const maxes = useMemo(
    () => ({
      conversation_turns: Math.max(...data.map((d) => d.conversation_turns), 1),
      commits: Math.max(...data.map((d) => d.commits), 1),
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

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No runs in this period.
      </p>
    );
  }

  const columns: { key: SortKey; label: string }[] = [
    { key: "started_at", label: "Date" },
    { key: "conversation_turns", label: "Turns" },
    { key: "commits", label: "Commits" },
    { key: "prs", label: "PRs" },
    { key: "compactions", label: "Compactions" },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">Run</th>
            <th className="pb-2 pr-4 font-medium">Repo</th>
            <th className="pb-2 pr-4 font-medium">Developer</th>
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
          {sorted.map((run) => {
            const d = new Date(run.started_at);
            return (
              <tr
                key={run.run_id}
                className="border-b last:border-0 hover:bg-muted/50"
              >
                <td className="py-2 pr-4">
                  <Link
                    href={`/runs/${run.run_id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {run.label}
                  </Link>
                </td>
                <td className="py-2 pr-4 text-muted-foreground">
                  {shortenRepo(run.repo_key)}
                </td>
                <td className="py-2 pr-4 text-muted-foreground">
                  {run.developer_name}
                </td>
                <td className="py-2 pr-2 text-muted-foreground">
                  {d.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td className="w-28 py-2 pr-2">
                  <InlineBar
                    value={run.conversation_turns}
                    max={maxes.conversation_turns}
                  />
                </td>
                <td className="w-28 py-2 pr-2">
                  <InlineBar value={run.commits} max={maxes.commits} />
                </td>
                <td className="w-28 py-2 pr-2">
                  <InlineBar value={run.prs} max={maxes.prs} />
                </td>
                <td className="w-28 py-2 pr-2">
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
  );
}
