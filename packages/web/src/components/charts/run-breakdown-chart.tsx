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
        <CartesianGrid
          strokeDasharray="3 3"
          className="stroke-border"
          horizontal={false}
          strokeOpacity={0.5}
        />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={{ fontSize: 11 }}
          className="text-muted-foreground"
          axisLine={false}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={140}
          tick={{ fontSize: 11 }}
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
          radius={[0, 8, 8, 0]}
        />
        <Bar
          dataKey="commits"
          fill="var(--chart-2)"
          name="Commits"
          radius={[0, 8, 8, 0]}
        />
        <Bar
          dataKey="prs"
          fill="var(--chart-3)"
          name="PRs"
          radius={[0, 8, 8, 0]}
        />
        <Bar
          dataKey="compactions"
          fill="var(--chart-5)"
          name="Compactions"
          radius={[0, 8, 8, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
