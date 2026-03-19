"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TopRepo } from "@glop/shared";

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

function shortenRepoKey(key: string, maxLen = 18): string {
  const { org, repo } = parseRepo(key);
  if (!org) return repo;
  const full = `${org}/${repo}`;
  if (full.length <= maxLen) return full;
  // Keep repo, truncate org
  const available = maxLen - repo.length - 1; // -1 for "/"
  if (available <= 2) return repo;
  return `${org.slice(0, available - 1)}../${repo}`;
}

export function TopReposChart({ data }: { data: TopRepo[] }) {
  const formatted = data.map((d) => ({
    ...d,
    label: shortenRepoKey(d.repo_key),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={formatted} layout="vertical">
        <CartesianGrid
          strokeDasharray="3 3"
          className="stroke-border"
          horizontal={false}
          strokeOpacity={0.5}
        />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          axisLine={false}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={120}
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          axisLine={false}
          tickLine={false}
          tickMargin={8}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          contentStyle={{
            backgroundColor: "var(--popover)",
            border: "none",
            borderRadius: "0.5rem",
            color: "var(--popover-foreground)",
            boxShadow:
              "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          }}
        />
        <Bar dataKey="run_count" fill="var(--chart-4)" name="Runs" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
