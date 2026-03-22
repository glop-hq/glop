"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { RepoHeatmapCell } from "@glop/shared";

interface Props {
  data: RepoHeatmapCell[];
  onRepoClick?: (repoId: string) => void;
}

export function RepoHeatmapChart({ data, onRepoClick }: Props) {
  const { repos, dates, cellMap, maxSessions } = useMemo(() => {
    // Aggregate per (repo, date)
    const cellMap = new Map<string, { sessions: number; repoId: string }>();
    const repoMap = new Map<string, string>(); // repo_key -> repo_id
    const dateSet = new Set<string>();

    for (const d of data) {
      const key = `${d.repo_key}|${d.date}`;
      const existing = cellMap.get(key);
      cellMap.set(key, {
        sessions: (existing?.sessions ?? 0) + d.sessions,
        repoId: d.repo_id,
      });
      repoMap.set(d.repo_key, d.repo_id);
      dateSet.add(d.date);
    }

    const repos = Array.from(repoMap.entries())
      .map(([key, id]) => ({ key, id }))
      .sort((a, b) => a.key.localeCompare(b.key));

    const dates = Array.from(dateSet).sort();

    let maxSessions = 0;
    for (const cell of cellMap.values()) {
      if (cell.sessions > maxSessions) maxSessions = cell.sessions;
    }

    return { repos, dates, cellMap, maxSessions };
  }, [data]);

  if (repos.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        No data for this period
      </div>
    );
  }

  // Show last N dates to keep it readable
  const visibleDates = dates.slice(-21);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-fit">
        {/* Header row with dates */}
        <div className="mb-1 flex items-end gap-0.5 pl-40">
          {visibleDates.map((date) => {
            const d = new Date(date + "T00:00:00");
            const dayLabel = d.toLocaleDateString(undefined, { day: "numeric" });
            return (
              <div
                key={date}
                className="w-5 text-center text-[9px] text-muted-foreground"
              >
                {dayLabel}
              </div>
            );
          })}
        </div>

        {/* Repo rows */}
        {repos.map((repo) => (
          <div key={repo.key} className="flex items-center gap-0.5">
            <button
              onClick={() => onRepoClick?.(repo.id)}
              className="w-40 cursor-pointer truncate pr-2 text-right text-xs text-muted-foreground hover:text-foreground"
              title={repo.key}
            >
              {repo.key.split("/").pop() ?? repo.key}
            </button>
            {visibleDates.map((date) => {
              const cell = cellMap.get(`${repo.key}|${date}`);
              const sessions = cell?.sessions ?? 0;
              const intensity =
                maxSessions > 0 ? sessions / maxSessions : 0;
              return (
                <div
                  key={date}
                  className={cn(
                    "h-4 w-5 rounded-sm",
                    sessions === 0
                      ? "bg-muted"
                      : intensity < 0.25
                        ? "bg-green-200 dark:bg-green-900"
                        : intensity < 0.5
                          ? "bg-green-300 dark:bg-green-700"
                          : intensity < 0.75
                            ? "bg-green-500 dark:bg-green-500"
                            : "bg-green-700 dark:bg-green-300"
                  )}
                  title={`${repo.key} — ${date}: ${sessions} session${sessions !== 1 ? "s" : ""}`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
