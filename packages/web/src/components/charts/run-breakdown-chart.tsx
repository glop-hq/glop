"use client";

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
import type { RunBreakdown } from "@glop/shared";

export function RunBreakdownChart({ data }: { data: RunBreakdown[] }) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No runs in this period.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(300, data.length * 32)}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={{ fontSize: 11 }}
          className="text-muted-foreground"
        />
        <YAxis
          type="category"
          dataKey="label"
          width={140}
          tick={{ fontSize: 11 }}
          className="text-muted-foreground"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "0.5rem",
            color: "hsl(var(--popover-foreground))",
          }}
          labelFormatter={(label, payload) => {
            const item = payload?.[0]?.payload as RunBreakdown | undefined;
            if (!item) return label;
            const d = new Date(item.started_at);
            return `${label} — ${d.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}`;
          }}
        />
        <Legend />
        <Bar
          dataKey="conversation_turns"
          fill="var(--chart-1)"
          name="Turns"
          radius={[0, 4, 4, 0]}
        />
        <Bar
          dataKey="commits"
          fill="var(--chart-2)"
          name="Commits"
          radius={[0, 4, 4, 0]}
        />
        <Bar
          dataKey="prs"
          fill="var(--chart-3)"
          name="PRs"
          radius={[0, 4, 4, 0]}
        />
        <Bar
          dataKey="compactions"
          fill="var(--chart-5)"
          name="Compactions"
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
