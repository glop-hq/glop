"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { RepoActivityPoint } from "@glop/shared";

interface Props {
  data: RepoActivityPoint[];
  onRepoClick?: (repoId: string) => void;
}

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(210 60% 55%)",
  "hsl(340 65% 55%)",
  "hsl(160 55% 45%)",
  "hsl(45 80% 50%)",
  "hsl(280 55% 55%)",
];

export function ActivityByRepoChart({ data, onRepoClick }: Props) {
  const { chartData, repos } = useMemo(() => {
    // Get unique repos
    const repoSet = new Map<string, string>(); // repo_key -> repo_id
    for (const d of data) {
      repoSet.set(d.repo_key, d.repo_id);
    }
    const repos = Array.from(repoSet.entries()).map(([key, id]) => ({
      key,
      id,
    }));

    // Pivot: one row per date, one key per repo
    const dateMap = new Map<string, Record<string, number>>();
    for (const d of data) {
      const entry = dateMap.get(d.date) ?? {};
      entry[d.repo_key] = (entry[d.repo_key] ?? 0) + d.sessions;
      dateMap.set(d.date, entry);
    }

    const chartData = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => {
        const d = new Date(date + "T00:00:00");
        return {
          label: d.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
          ...values,
        };
      });

    return { chartData, repos };
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        No data for this period
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12 }}
          className="fill-muted-foreground"
        />
        <YAxis
          tick={{ fontSize: 12 }}
          className="fill-muted-foreground"
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: "12px",
          }}
        />
        <Legend />
        {repos.map((repo, i) => (
          <Bar
            key={repo.key}
            dataKey={repo.key}
            name={repo.key.split("/").pop() ?? repo.key}
            stackId="repos"
            fill={CHART_COLORS[i % CHART_COLORS.length]}
            className="cursor-pointer"
            onClick={() => onRepoClick?.(repo.id)}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
