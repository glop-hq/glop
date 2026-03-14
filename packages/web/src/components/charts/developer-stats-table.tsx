"use client";

import type { DeveloperStats } from "@glop/shared";

export function DeveloperStatsTable({ data }: { data: DeveloperStats[] }) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No developer data available.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">Developer</th>
            <th className="pb-2 pr-4 text-right font-medium">Runs</th>
            <th className="pb-2 pr-4 text-right font-medium">Avg Turns</th>
            <th className="pb-2 pr-4 text-right font-medium">
              Turns Before Commit
            </th>
            <th className="pb-2 pr-4 text-right font-medium">Commits/Run</th>
            <th className="pb-2 pr-4 text-right font-medium">PRs/Run</th>
            <th className="pb-2 text-right font-medium">Compactions/Run</th>
          </tr>
        </thead>
        <tbody>
          {data.map((dev) => (
            <tr key={dev.developer_name} className="border-b last:border-0">
              <td className="py-2 pr-4 font-medium">{dev.developer_name}</td>
              <td className="py-2 pr-4 text-right">{dev.run_count}</td>
              <td className="py-2 pr-4 text-right">
                {dev.avg_conversation_turns.toFixed(1)}
              </td>
              <td className="py-2 pr-4 text-right">
                {dev.avg_turns_before_first_commit > 0
                  ? dev.avg_turns_before_first_commit.toFixed(1)
                  : "—"}
              </td>
              <td className="py-2 pr-4 text-right">
                {dev.commits_per_run.toFixed(1)}
              </td>
              <td className="py-2 pr-4 text-right">
                {dev.prs_per_run.toFixed(1)}
              </td>
              <td className="py-2 text-right">
                {dev.compactions_per_run.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
