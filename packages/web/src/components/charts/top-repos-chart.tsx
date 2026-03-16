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

function shortenRepoKey(key: string): string {
  // e.g. "github.com/org/repo" -> "org/repo"
  const parts = key.split("/");
  if (parts.length >= 3) {
    return parts.slice(-2).join("/");
  }
  return key;
}

export function TopReposChart({ data }: { data: TopRepo[] }) {
  const formatted = data.map((d) => ({
    ...d,
    label: shortenRepoKey(d.repo_key),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={formatted} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
        />
        <YAxis
          type="category"
          dataKey="label"
          width={120}
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "0.5rem",
            color: "hsl(var(--popover-foreground))",
          }}
        />
        <Bar dataKey="run_count" fill="var(--chart-4)" name="Runs" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
